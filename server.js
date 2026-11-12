/*
 * Tiny Commons — server.
 *
 * A single zero-dependency Node process that:
 *   1. serves the static front-end from ./public, and
 *   2. is the authority behind POST /api/game (rooms, players, the clock).
 *
 * Rooms live in memory and expire after 24 hours, so a restart clears all
 * games — which is exactly what a tiny, accountless party game wants.
 *
 * Run it with:  node server.js   (then open http://localhost:3000)
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const engine = require("./public/engine.js");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

/* ----------------------------------------------------------------------------
 * In-memory store
 * ------------------------------------------------------------------------- */

const rooms = new Map(); // code -> game state (plus a .version counter)
const sessions = new Map(); // bearer token -> { code, playerId }

// Room codes avoid easily-confused characters (no 0/O, 1/I).
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function newCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  } while (rooms.has(code));
  return code;
}

function cleanName(raw) {
  const name = String(raw ?? "").trim().slice(0, 18);
  if (!name) throw new engine.GameError("Please choose a nickname.");
  return name;
}

function getRoom(code) {
  const room = rooms.get(code);
  if (!room) return null;
  if (Date.now() > room.expiresAt) {
    rooms.delete(code);
    return null;
  }
  return room;
}

// Sweep out expired rooms and their orphaned tokens once an hour.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) if (now > room.expiresAt) rooms.delete(code);
  for (const [token, s] of sessions) if (!rooms.has(s.code)) sessions.delete(token);
}, 3600000).unref?.();

/* ----------------------------------------------------------------------------
 * API: POST /api/game
 * ------------------------------------------------------------------------- */

function handleGame(body, token) {
  const now = Date.now();
  const type = body && body.type;

  // --- Open-door actions: create a room or join one. No token required. ---
  if (type === "create") {
    const name = cleanName(body.name);
    const code = newCode();
    const host = { id: engine.uuid(), name, avatar: 0, keyHash: "", coins: 0, lastSeen: now };
    const game = engine.createState(code, host, now);
    game.version = 1;
    rooms.set(code, game);
    const session = engine.uuid();
    sessions.set(session, { code, playerId: host.id });
    return { status: 200, payload: { view: makeView(game, host.id, now), token: session } };
  }

  if (type === "join") {
    const name = cleanName(body.name);
    const code = String(body.code ?? "").toUpperCase();
    const game = getRoom(code);
    if (!game) throw new engine.GameError("We couldn't find a room with that code.", 404);
    if (game.phase !== "lobby") throw new engine.GameError("That game has already started.", 409);
    if (game.players.length >= 8) throw new engine.GameError("This room is full — 8 neighbors is the max.", 409);
    const player = { id: engine.uuid(), name, avatar: game.players.length, keyHash: "", coins: 0, lastSeen: now };
    game.players.push(player);
    game.version = (game.version || 0) + 1;
    const session = engine.uuid();
    sessions.set(session, { code, playerId: player.id });
    return { status: 200, payload: { view: makeView(game, player.id, now), token: session } };
  }

  // --- Everything else is a move inside a room, authenticated by token. ---
  if (!token) throw new engine.GameError("Your session has expired. Please rejoin.", 401);
  const session = sessions.get(token);
  if (!session) throw new engine.GameError("Your session has expired. Please rejoin.", 401);

  const game = getRoom(session.code);
  if (!game) throw new engine.GameError("This room has closed.", 404);

  const player = game.players.find((p) => p.id === session.playerId);
  if (!player) throw new engine.GameError("Your place in this room is no longer available.", 401);

  player.lastSeen = now;

  // Leaving the lobby is special: the player is removed, so there is no view to
  // hand back to them. Acknowledge and tidy up their token / empty rooms.
  if (type === "leave") {
    engine.applyAction(game, session.playerId, body, now);
    sessions.delete(token);
    game.version = (game.version || 0) + 1;
    if (game.players.length === 0) rooms.delete(game.code);
    return { status: 200, payload: { ok: true } };
  }

  // Apply the move (throws GameError if illegal), then nudge the clock forward
  // so plain "sync" polls also expire timers and auto-advance the reveal.
  engine.applyAction(game, session.playerId, body, now);
  engine.advance(game, now);
  if (type !== "sync") game.version = (game.version || 0) + 1;

  return { status: 200, payload: { view: makeView(game, session.playerId, now) } };
}

function makeView(game, playerId, now) {
  const view = engine.buildView(game, playerId, now);
  view.version = game.version || 0;
  return view;
}

/* ----------------------------------------------------------------------------
 * HTTP plumbing
 * ------------------------------------------------------------------------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
};

function sendJson(res, status, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(data) });
  res.end(data);
}

function serveStatic(req, res) {
  // Map the URL path to a file in ./public, falling back to index.html (SPA).
  // A malformed escape like "/%E0%A4%A" makes decodeURIComponent throw; answer
  // 400 instead of letting the exception crash the whole server (and every game).
  let urlPath;
  try {
    urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" }).end("Bad request");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath));

  // Guard against path traversal outside ./public (the trailing separator stops
  // a sibling folder such as "public-old" from passing the prefix check).
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Unknown path → serve the single-page app shell.
      fs.readFile(path.join(PUBLIC_DIR, "index.html"), (err2, html) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": MIME[".html"] }).end(html);
      });
      return;
    }
    const type = MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type }).end(data);
  });
}

const server = http.createServer((req, res) => {
  const urlPath = (req.url || "/").split("?")[0];

  if (urlPath === "/api/game") {
    if (req.method !== "POST") {
      sendJson(res, 405, { error: "Use POST." });
      return;
    }
    let raw = "";
    let tooBig = false;
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 100000) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      if (tooBig) return;
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        sendJson(res, 400, { error: "That request didn't make sense." });
        return;
      }
      const auth = req.headers["authorization"] || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
      try {
        const { status, payload } = handleGame(body, token);
        sendJson(res, status, payload);
      } catch (err) {
        const status = err instanceof engine.GameError ? err.status : 500;
        sendJson(res, status, { error: err.message || "The connection had a hiccup. Please retry." });
      }
    });
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain" }).end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`\n  Tiny Commons is running.`);
  console.log(`  → http://localhost:${PORT}\n`);
});
