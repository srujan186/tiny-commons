# Tiny Commons

A multiplayer game of give and take. Make promises, hide your plans, and build a
little neighborhood together. **3–8 friends. No accounts. ~6 minutes.**

This is a rebuilt, self-contained version of the game: one small Node server, a
React front-end with no build step, and your original styling reused verbatim.

## Run it

You need [Node.js](https://nodejs.org) 19 or newer. No `npm install` is required —
there are no third-party dependencies.

```bash
cd tiny-commons
node server.js
```

Then open **http://localhost:3000**.

To use a different port:

```bash
# Windows PowerShell
$env:PORT=8080; node server.js

# macOS / Linux
PORT=8080 node server.js
```

## Play with friends

The game is real multiplayer. To play together you need everyone to reach the
same server:

- **Same Wi‑Fi:** find your machine's local IP (e.g. `192.168.1.20`) and share
  `http://192.168.1.20:3000`.
- **Over the internet:** deploy it (see below), or use a tunnel such as
  `ngrok http 3000` and share the public URL.

One person picks **Create a room**, shares the 6‑character code (or the invite
link), and everyone else picks **Join friends**. The host starts once at least
three neighbors have arrived. Prefer each player on their own phone/laptop, and
chat in person or on a call.

Not ready for a crowd? **"Try a solo practice"** on the home screen plays a full
game against three computer neighbors, entirely in your browser.

## How the game works

Five rounds, one community project each. Every round:

1. **Private need** — you secretly get 3 sparks and a goal (give exactly 1, 2, or
   3 for **+2 bonus coins**).
2. **Public promise** (35s) — announce how many sparks you'll give. Non-binding.
3. **Secret choice** (30s) — actually give 0–3. Every spark you *keep* becomes a
   coin. Locked choices can't change; miss the timer and you give 0, keep 0.
4. **Reveal** — if total sparks meet the target (2 per player, less any event
   discount), the project opens. All choices and needs are shown.

Each round also has a visible **rule change** (matching grant, borrowed tools,
keep-your-promise bonus, celebration). Open **at least 4 of 5** projects and the
town wins together; then whoever has the most coins is the Commons Champion
(ties share it). If the town falls short, there's no individual winner.

## Project layout

```
tiny-commons/
├── server.js              Zero-dependency Node server + the /api/game backend
├── package.json
├── README.md
└── public/
    ├── index.html         Page shell
    ├── styles.css         Original styling, reused as-is
    ├── engine.js          Shared rules engine (used by BOTH the server and
    │                       the browser's solo-practice mode)
    ├── app.js             The full React UI (React.createElement, no build step)
    ├── favicon.svg
    └── vendor/            React + ReactDOM (vendored so it runs offline)
```

`engine.js` is the single source of truth for the rules. The server imports it
with `require`; the browser loads it as a global. Keeping one engine means the
practice bots and the live server can never disagree.

## How state is kept

Rooms live **in memory** on the server and expire after 24 hours. Restarting the
server clears every game — which is what a tiny, accountless party game wants. If
you later want rooms to survive restarts or run across multiple server
instances, swap the in-memory `rooms`/`sessions` maps in `server.js` for a small
key/value store (e.g. Redis or SQLite); nothing else needs to change.

## Deploying

Any host that runs a long-lived Node process works (Render, Railway, Fly.io, a
small VPS, etc.). Most read the `PORT` environment variable, which this server
already honors. Start command: `node server.js`.

> Note: because rooms are in memory, run a **single instance** (no horizontal
> autoscaling) unless you add a shared store as described above — otherwise two
> players could land on different instances and not see the same room.
