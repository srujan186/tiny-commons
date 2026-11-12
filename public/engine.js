/*
 * Tiny Commons — shared game engine.
 *
 * This single module is the authoritative rules engine. It runs in two places:
 *   • in the browser, for the offline "solo practice" mode, and
 *   • in Node (server.js), as the real multiplayer authority behind /api/game.
 *
 * Keeping one engine means the practice bots and the live server can never
 * drift apart. It exports via module.exports under Node and as a global
 * (window.TinyCommonsEngine) in the browser.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TinyCommonsEngine = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const uuid = () => globalThis.crypto.randomUUID();

  // How long each timed phase lasts, in milliseconds.
  const PHASE_DURATIONS = { pledge: 35000, commit: 30000, reveal: 18000 };

  const ROOM_TTL = 86400000; // rooms live 24 hours

  // The five community projects, in fixed catalogue order. The deck shuffles
  // which one appears each round; this order is the stable identity (0..4).
  const PROJECTS = [
    {
      id: "library",
      name: "The little library",
      short: "Library",
      icon: "book",
      description: "A place where a good story gets a second reader.",
      action: "Pass a book you enjoyed to someone who might love it. A note inside makes it personal.",
    },
    {
      id: "garden",
      name: "The rooftop garden",
      short: "Garden",
      icon: "leaf",
      description: "Turn an empty rooftop into something that grows.",
      action: "Care for a plant together, or ask a local garden whether there is a small way to help.",
    },
    {
      id: "repair",
      name: "The repair café",
      short: "Repair café",
      icon: "tool",
      description: "A second chance for things with a little life left.",
      action: "Before replacing one broken thing, ask someone whether it can be repaired.",
    },
    {
      id: "table",
      name: "The long table",
      short: "Long table",
      icon: "cup",
      description: "There is always room for one more neighbor.",
      action: "Invite someone who is often left out to join your next game or conversation.",
    },
    {
      id: "park",
      name: "The pocket park",
      short: "Pocket park",
      icon: "sun",
      description: "A tiny patch of green, open to absolutely everyone.",
      action: "Leave one shared place a little nicer than you found it. Keep it small and safe.",
    },
  ];

  // Per-round rule changes. Index 0 ("ordinary") is always the first round;
  // the others are shuffled into rounds 2..5.
  const EVENTS = [
    { id: "ordinary", name: "A fresh start", text: "Every spark counts once. Keep what you do not contribute." },
    { id: "grant", name: "The matching grant", text: "Give all 3 sparks and a local sponsor adds 1 extra to the project." },
    { id: "tools", name: "Borrowed tools", text: "Neighbors lend a hand. This project needs 1 fewer spark." },
    { id: "promise", name: "Word gets around", text: "Keep your public promise exactly to earn 1 extra coin." },
    { id: "celebrate", name: "A little celebration", text: "If the project opens, every player who contributes earns 1 extra coin." },
  ];

  // Each round a player is privately handed one of these secret needs.
  const GOALS = [
    { amount: 1, title: "A little room to breathe", text: "You are saving for a personal need. Contribute exactly 1 spark for 2 bonus coins." },
    { amount: 2, title: "A fair balance", text: "You want to help and keep a little aside. Contribute exactly 2 sparks for 2 bonus coins." },
    { amount: 3, title: "This one matters to you", text: "You have a personal reason to go all in. Contribute all 3 sparks for 2 bonus coins." },
  ];

  // A rejected move carries an HTTP-ish status so the client can tell a fatal
  // "you were removed" (401/404) from a recoverable "your screen is behind" (409).
  class GameError extends Error {
    constructor(message, status = 400) {
      super(message);
      this.status = status;
    }
  }

  // Fisher–Yates shuffle. The injectable rng keeps games deterministic in tests.
  function shuffle(arr, rng = Math.random) {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // A brand-new room with a single host player, parked in the lobby.
  function createState(code, host, now) {
    return {
      code,
      gameId: uuid(),
      hostId: host.id,
      createdAt: now,
      expiresAt: now + ROOM_TTL,
      phase: "lobby",
      round: 0,
      deadline: null,
      players: [host],
      deck: [],
      events: [],
      goals: {},
      pledges: {},
      contributions: {},
      history: [],
    };
  }

  // Sparks needed to open this round's project. Two per player, minus one when
  // the "Borrowed tools" event (index 2) is in play.
  function target(game) {
    return game.players.length * 2 - (game.events[game.round] === 2 ? 1 : 0);
  }

  // Open the public-promise phase of a round and hand out fresh secret goals.
  function beginPledge(game, now, rng = Math.random) {
    game.phase = "pledge";
    game.deadline = now + PHASE_DURATIONS.pledge;
    game.pledges = {};
    game.contributions = {};
    game.goals = Object.fromEntries(game.players.map((p) => [p.id, Math.floor(rng() * GOALS.length)]));
  }

  // Start (or restart) a five-round game. Needs at least three neighbors.
  function startGame(game, now, rng = Math.random) {
    if (game.players.length < 3) throw new GameError("Bring at least 3 neighbors to start. Or try solo practice.");
    game.gameId = uuid();
    game.round = 0;
    game.history = [];
    game.deck = shuffle([0, 1, 2, 3, 4], rng);
    game.events = [0, ...shuffle([1, 2, 3, 4], rng)];
    game.players.forEach((p) => {
      p.coins = 0;
    });
    beginPledge(game, now, rng);
  }

  // Tally the secret contributions, award coins, and push a reveal record.
  function resolve(game, now) {
    if (game.phase !== "commit") return;
    const event = game.events[game.round];
    const total = game.players.reduce((sum, p) => {
      const gave = game.contributions[p.id] ?? 0;
      // Matching grant (event 1): a full 3-spark gift draws +1 into the project.
      return sum + gave + (event === 1 && gave === 3 ? 1 : 0);
    }, 0);
    const need = target(game);
    const success = total >= need;
    const record = {
      round: game.round,
      project: game.deck[game.round],
      event,
      target: need,
      total,
      success,
      players: game.players.map((p) => {
        const timedOut = game.contributions[p.id] === undefined;
        const amount = game.contributions[p.id] ?? 0;
        const pledge = game.pledges[p.id] ?? null;
        const kept = timedOut ? 0 : 3 - amount; // every spark kept becomes a coin
        const goal = game.goals[p.id];
        const bonus = timedOut
          ? 0
          : (amount === GOALS[goal].amount ? 2 : 0) + // met your private need
            (event === 3 && pledge === amount ? 1 : 0) + // kept your public promise
            (event === 4 && success && amount > 0 ? 1 : 0); // celebration for contributors
        p.coins += kept + bonus;
        return { id: p.id, pledge, amount, kept, bonus, goal, timedOut };
      }),
    };
    game.history.push(record);
    game.phase = "reveal";
    game.deadline = now + PHASE_DURATIONS.reveal;
  }

  // The master clock: move the game forward whenever a phase is complete or its
  // deadline has passed. Safe to call repeatedly (it no-ops when nothing is due).
  function advance(game, now, rng = Math.random) {
    if (game.phase === "pledge" && (game.players.every((p) => game.pledges[p.id] !== undefined) || now >= (game.deadline ?? Infinity))) {
      game.phase = "commit";
      game.deadline = now + PHASE_DURATIONS.commit;
    } else if (game.phase === "commit" && (game.players.every((p) => game.contributions[p.id] !== undefined) || now >= (game.deadline ?? Infinity))) {
      resolve(game, now);
    } else if (game.phase === "reveal" && now >= (game.deadline ?? Infinity)) {
      if (game.round + 1 >= 5) {
        game.phase = "finished";
        game.deadline = null;
      } else {
        game.round++;
        beginPledge(game, now, rng);
      }
    }
  }

  // Apply one player's move to the room, validating it against the live state.
  // Throws GameError on anything illegal. "sync" is a no-op read.
  function applyAction(game, playerId, msg, now, rng = Math.random) {
    if (!game.players.find((p) => p.id === playerId)) throw new GameError("Your place in this room is no longer available.", 401);

    if (msg.type === "sync") return;

    if (msg.type === "claimHost") {
      const host = game.players.find((p) => p.id === game.hostId);
      if (host && now - host.lastSeen < 45000) throw new GameError("The host is still here.");
      game.hostId = playerId;
      return;
    }

    if (msg.type === "leave" && game.phase === "lobby") {
      game.players = game.players.filter((p) => p.id !== playerId);
      if (game.hostId === playerId) game.hostId = game.players[0]?.id ?? "";
      return;
    }

    if (msg.type === "kick") {
      if (game.hostId !== playerId || game.phase !== "lobby" || msg.playerId === playerId)
        throw new GameError("Only the host can remove a neighbor in the lobby.", 403);
      game.players = game.players.filter((p) => p.id !== msg.playerId);
      return;
    }

    if (msg.gameId !== game.gameId) throw new GameError("The game changed. Your screen is catching up.", 409);

    if (msg.type === "start" || msg.type === "rematch") {
      if (game.hostId !== playerId) throw new GameError("Only the host can start the game.", 403);
      if ((msg.type === "start" && game.phase !== "lobby") || (msg.type === "rematch" && game.phase !== "finished"))
        throw new GameError("That game has already started.", 409);
      startGame(game, now, rng);
      return;
    }

    if (msg.round !== game.round) throw new GameError("That round has ended.", 409);

    if (msg.type === "next") {
      if (game.hostId !== playerId || game.phase !== "reveal") throw new GameError("Only the host can move on from the reveal.", 403);
      game.deadline = now;
      advance(game, now, rng);
      return;
    }

    if (msg.type !== "pledge" && msg.type !== "commit") throw new GameError("Unknown move.");
    if (game.phase !== msg.type) throw new GameError("That phase has ended. Your screen is catching up.", 409);

    const amount = msg.amount;
    if (!Number.isInteger(amount) || amount < 0 || amount > 3) throw new GameError("Choose 0, 1, 2, or 3 sparks.");

    const book = msg.type === "pledge" ? game.pledges : game.contributions;
    if (book[playerId] !== undefined && book[playerId] !== amount) throw new GameError("Your choice is already locked.", 409);
    book[playerId] = amount;
    advance(game, now, rng);
  }

  // Project the room into the private view one player is allowed to see. Other
  // players' secret contributions stay hidden until the round resolves.
  function buildView(game, playerId, now) {
    const me = game.players.find((p) => p.id === playerId);
    if (!me) throw new GameError("Your place in this room is no longer available.", 401);
    const host = game.players.find((p) => p.id === game.hostId);
    return {
      code: game.code,
      gameId: game.gameId,
      hostId: game.hostId,
      phase: game.phase,
      round: game.round,
      deadline: game.deadline,
      expiresAt: game.expiresAt,
      serverNow: now,
      players: game.players.map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        coins: p.coins,
        online: now - p.lastSeen < 30000,
      })),
      project: game.deck[game.round] ?? 0,
      event: game.events[game.round] ?? 0,
      target: target(game),
      pledges: game.pledges,
      committed: Object.keys(game.contributions),
      history: game.history,
      me: { id: me.id, goal: game.goals[me.id] ?? null, contribution: game.contributions[me.id] ?? null },
      canClaimHost: now - (host?.lastSeen ?? 0) >= 45000,
    };
  }

  return {
    PHASE_DURATIONS,
    ROOM_TTL,
    PROJECTS,
    EVENTS,
    GOALS,
    GameError,
    uuid,
    shuffle,
    createState,
    target,
    beginPledge,
    startGame,
    resolve,
    advance,
    applyAction,
    buildView,
  };
});
