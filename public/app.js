/*
 * Tiny Commons — front-end.
 *
 * The whole interface, built with React (vendored in /vendor and loaded as a
 * global by index.html, so there is no build step). Instead of JSX we call a tiny
 * `jsx()` helper over React.createElement, which keeps the markup declarative
 * and lets the component tree read top-to-bottom.
 *
 * The game rules live in engine.js (shared with the server). Online play talks
 * to POST /api/game; "solo practice" runs that same engine locally against
 * three computer neighbors.
 */
(function () {
  "use strict";

  const { createElement, Fragment, useState, useEffect, useRef, useCallback } = React;
  const E = TinyCommonsEngine;
  const { PROJECTS, EVENTS, GOALS } = E;

  // hyperscript helper: jsx(type, props?, key?) with props.children as kids.
  function jsx(type, props, key) {
    const p = props ? Object.assign({}, props) : {};
    const children = p.children;
    delete p.children;
    if (key !== undefined) p.key = key;
    const kids = children === undefined ? [] : Array.isArray(children) ? children : [children];
    return createElement(type, p, ...kids);
  }
  const jsxs = jsx;

  /* ==========================================================================
   * Artwork — line icons, generated avatars, and the little town scene.
   * All original, drawn from plain geometry.
   * ======================================================================= */

  function Icon({ name, size = 24 }) {
    const icons = {
      spark: jsx("path", { d: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z" }),
      arrow: jsx("path", { d: "M4 12h16m-6-6 6 6-6 6" }),
      book: jsxs(Fragment, {
        children: [jsx("path", { d: "M3 4c4-1 6 0 9 2 3-2 5-3 9-2v15c-4-1-6 0-9 2-3-2-5-3-9-2Z" }), jsx("path", { d: "M12 6v15" })],
      }),
      leaf: jsxs(Fragment, {
        children: [jsx("path", { d: "M20 3C6 2 1 11 6 17c6 6 15 0 14-14Z" }), jsx("path", { d: "m4 21 12-12" })],
      }),
      tool: jsx(Fragment, { children: jsx("path", { d: "M14 4a6 6 0 0 0-7 8L2 17a3 3 0 0 0 5 5l5-5a6 6 0 0 0 8-7l-4 4-5-5Z" }) }),
      cup: jsx(Fragment, { children: jsx("path", { d: "M3 8h13v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5Zm13 1h2a4 4 0 0 1 0 8h-2M6 2v2m5-2v2" }) }),
      sun: jsxs(Fragment, {
        children: [jsx("circle", { cx: "12", cy: "12", r: "4" }), jsx("path", { d: "M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2" })],
      }),
      check: jsx("path", { d: "m5 12 5 5L20 7" }),
      lock: jsxs(Fragment, {
        children: [jsx("rect", { x: "5", y: "10", width: "14", height: "11", rx: "2" }), jsx("path", { d: "M8 10V6a4 4 0 0 1 8 0v4m-4 5v2" })],
      }),
      copy: jsxs(Fragment, {
        children: [jsx("rect", { x: "8", y: "8", width: "13", height: "13", rx: "2" }), jsx("path", { d: "M16 8V3H3v13h5" })],
      }),
      heart: jsx("path", { d: "M12 21S2 14 2 7a5 5 0 0 1 10-1A5 5 0 0 1 22 7c0 7-10 14-10 14Z" }),
      coin: jsxs(Fragment, {
        children: [jsx("circle", { cx: "12", cy: "12", r: "9" }), jsx("path", { d: "M12 7v10m-3-8h4a2 2 0 0 1 0 4h-2a2 2 0 0 0 0 4h4" })],
      }),
      people: jsxs(Fragment, {
        children: [jsx("circle", { cx: "9", cy: "7", r: "4" }), jsx("path", { d: "M2 22v-4a7 7 0 0 1 14 0v4M17 3a4 4 0 0 1 0 8m2 4a5 5 0 0 1 3 5" })],
      }),
      volume: jsx(Fragment, { children: jsx("path", { d: "m3 9 5 0 5-5v16l-5-5H3Zm14-3a9 9 0 0 1 0 12m-1-9a5 5 0 0 1 0 6" }) }),
      close: jsx("path", { d: "m6 6 12 12M6 18 18 6" }),
    };
    return jsx("svg", {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "1.8",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      "aria-hidden": "true",
      children: icons[name] ?? icons.spark,
    });
  }

  const AVATAR_COLORS = ["#bbdbfc", "#ffbb99", "#e7d9f7", "#cfe883", "#f4c6d4", "#ffe19b", "#a9e4d6", "#d4cefa"];

  function Avatar({ index, size = 42 }) {
    return jsxs("svg", {
      className: "avatar",
      width: size,
      height: size,
      viewBox: "0 0 48 48",
      "aria-hidden": "true",
      children: [
        jsx("rect", { x: "1", y: "1", width: "46", height: "46", rx: index % 2 ? 15 : 23, fill: AVATAR_COLORS[index % 8] }),
        index % 3 === 0 && jsx("path", { d: "M13 16q2-12 11-7t12 7", fill: "#24483c" }),
        index % 3 === 1 && jsx("path", { d: "m10 17 3-9 8 5 5-8 7 8 6 2", fill: "none", stroke: "#24483c", strokeWidth: "4", strokeLinejoin: "round" }),
        index % 3 === 2 && jsx("path", { d: "M8 17q16-21 32 0", fill: "#24483c" }),
        jsx("ellipse", { cx: "18", cy: "25", rx: "2", ry: "3", fill: "#18372e" }),
        jsx("ellipse", { cx: "31", cy: "25", rx: "2", ry: "3", fill: "#18372e" }),
        jsx("path", { d: index % 2 ? "M20 33q4 4 8-1" : "M19 33q5 5 10 0", stroke: "#18372e", strokeWidth: "2", fill: "none", strokeLinecap: "round" }),
      ],
    });
  }

  function Tree({ x, y, scale = 1 }) {
    return jsxs("g", {
      transform: `translate(${x} ${y}) scale(${scale})`,
      children: [
        jsx("path", { d: "M0 0v45", stroke: "#566d4b", strokeWidth: "7", strokeLinecap: "round" }),
        jsx("path", { d: "M-26-5C-39-35-18-61 0-49c19-17 44 15 26 44C12 11-12 11-26-5", fill: "#6a9b73" }),
        jsx("path", { d: "m0-34 0 42m0-22 13-12m-13 6-12-12", stroke: "#426850", fill: "none", strokeWidth: "2" }),
      ],
    });
  }

  function Building({ x, y, type, active, highlight }) {
    return jsxs("g", {
      transform: `translate(${x} ${y})`,
      className: highlight ? "building current" : "building",
      opacity: active || highlight ? 1 : 0.42,
      children: [
        highlight && jsx("ellipse", { cx: "0", cy: "45", rx: "79", ry: "32", fill: "#f6e6a3" }),
        jsx("path", { d: "m-52-38 104 0 0 80-104 0Z", fill: active || highlight ? ["#f4c080", "#b6d3b2", "#adc9db", "#edac99", "#c6d67e"][type] : "#c5cdc0" }),
        jsx("path", { d: "m52-38 27-16v80L52 42Z", fill: active || highlight ? "#7c9b84" : "#aab8ac" }),
        jsx("path", { d: "m-63-38 65-48 88 34-38 15Z", fill: active || highlight ? ["#dc775b", "#577f68", "#607785", "#d88067", "#8caa64"][type] : "#8fa294" }),
        jsx("path", { d: "m-63-38 65-48 10 33-49 31Z", fill: active || highlight ? ["#e89476", "#6f9573", "#7e9bad", "#e29876", "#9bbd73"][type] : "#9aab9e" }),
        jsx("rect", { x: "-38", y: "-21", width: "23", height: "24", rx: "2", fill: active ? "#ffefa6" : "#e7eee0" }),
        jsx("path", { d: "M-26-21V3m-12-12h23", stroke: "#8f9f7c", strokeWidth: "2" }),
        jsx("rect", { x: "16", y: "-21", width: "23", height: "24", rx: "2", fill: active ? "#ffefa6" : "#e7eee0" }),
        jsx("path", { d: "M28-21V3M16-9h23", stroke: "#8f9f7c", strokeWidth: "2" }),
        jsx("rect", { x: "-8", y: "7", width: "26", height: "35", rx: "3", fill: "#426455" }),
        jsx("circle", { cx: "11", cy: "27", r: "2", fill: "#e6dfbb" }),
        jsx("rect", { x: "-44", y: "-45", width: "88", height: "19", rx: "3", fill: "#f8f3df" }),
        jsx("text", {
          x: "0",
          y: "-32",
          textAnchor: "middle",
          fill: "#254c3e",
          fontSize: "9",
          fontWeight: "800",
          fontFamily: "sans-serif",
          children: ["BOOK SWAP", "GROW TOGETHER", "FIX IT CLUB", "COME ON IN", "POCKET PARK"][type],
        }),
        active &&
          jsxs("g", {
            className: "sparkles",
            fill: "#fcdf6c",
            children: [jsx("path", { d: "m-63-71 3-9 3 9 9 3-9 3-3 9-3-9-9-3Z" }), jsx("path", { d: "m63-94 2-6 2 6 6 2-6 2-2 6-2-6-6-2Z" })],
          }),
        type === 1 &&
          jsxs(Fragment, {
            children: [
              jsx("path", { d: "M-41-54v-27m14 15v-26", stroke: "#355a43", strokeWidth: "3" }),
              jsx("ellipse", { cx: "-49", cy: "-78", rx: "12", ry: "6", fill: "#90b56d" }),
              jsx("ellipse", { cx: "-20", cy: "-87", rx: "12", ry: "6", fill: "#a9c478" }),
            ],
          }),
        type === 3 &&
          jsxs(Fragment, {
            children: [
              jsx("path", { d: "M-59 8h115", stroke: "#f8f3df", strokeWidth: "12" }),
              jsx("path", { d: "M-48 3v13m23-13v13m23-13v13m23-13v13m23-13v13", stroke: "#cf735b", strokeWidth: "10" }),
            ],
          }),
      ],
    });
  }

  function Town({ built = [], current = -1, lively = false }) {
    return jsxs("svg", {
      className: "town",
      viewBox: "0 0 740 470",
      role: "img",
      "aria-label": `A tiny neighborhood with ${built.length} of 5 community projects open`,
      children: [
        jsx("ellipse", { cx: "369", cy: "397", rx: "294", ry: "43", fill: "#dde2d0" }),
        jsx("path", { d: "m62 282 257-164 365 149v43L424 455 62 326Z", fill: "#91ac7b" }),
        jsx("path", { d: "m62 282 257-164 365 149-260 152Z", fill: "#c3d7a1" }),
        jsx("path", { d: "m93 291 236-144 318 124-227 127Z", fill: "#d9dfb5" }),
        jsx("path", { d: "m207 220 285 129m-99-169-159 157", stroke: "#eee8cb", strokeWidth: "28", strokeLinejoin: "round" }),
        jsx("path", { d: "m207 220 285 129m-99-169-159 157", stroke: "#f6f1df", strokeWidth: "2", strokeDasharray: "6 10" }),
        jsx(Tree, { x: 133, y: 223, scale: 0.7 }),
        jsx(Tree, { x: 535, y: 171, scale: 0.8 }),
        jsx(Tree, { x: 622, y: 300, scale: 0.7 }),
        [
          [220, 195],
          [430, 170],
          [555, 284],
          [356, 329],
          [155, 312],
        ].map(([bx, by], i) => jsx(Building, { x: bx, y: by, type: i, active: built.includes(i), highlight: current === i }, i)),
        jsx(Tree, { x: 288, y: 367, scale: 0.7 }),
        jsx(Tree, { x: 476, y: 381, scale: 0.65 }),
        jsxs("g", {
          transform: "translate(383 254)",
          children: [
            jsx("path", { d: "M0 8v-47", stroke: "#6c7a5a", strokeWidth: "4" }),
            jsx("path", { d: "M0-38h38v19H0", fill: "#edaa76" }),
            jsx("text", { x: "18", y: "-25", fontSize: "10", textAnchor: "middle", fill: "#3b5840", fontWeight: "bold", children: "HI!" }),
          ],
        }),
        [
          [309, 263],
          [469, 272],
          [250, 330],
        ].map(([px, py], i) =>
          jsxs(
            "g",
            {
              transform: `translate(${px} ${py})`,
              className: lively ? "town-person" : "",
              style: { "--delay": `${i * 0.3}s` },
              children: [
                jsx("ellipse", { cy: "17", rx: "10", ry: "4", fill: "#9eaf87" }),
                jsx("path", { d: "m-4 10-1 8m8-8 1 8", stroke: "#355343", strokeWidth: "3" }),
                jsx("rect", { x: "-7", y: "-3", width: "14", height: "17", rx: "5", fill: AVATAR_COLORS[i] }),
                jsx("circle", { cy: "-8", r: "7", fill: "#f1c899" }),
                jsx("path", { d: "M-6-10q6-9 12 0", fill: "#355343" }),
              ],
            },
            i,
          ),
        ),
        jsxs("g", {
          fill: "#86a56d",
          children: [
            jsx("circle", { cx: "99", cy: "302", r: "4" }),
            jsx("circle", { cx: "119", cy: "309", r: "3" }),
            jsx("circle", { cx: "563", cy: "351", r: "4" }),
            jsx("circle", { cx: "550", cy: "360", r: "3" }),
          ],
        }),
      ],
    });
  }

  /* ==========================================================================
   * Rules dialog
   * ======================================================================= */

  function RulesDialog({ open, onClose }) {
    const ref = useRef(null);
    useEffect(() => {
      if (open) ref.current?.showModal();
      else ref.current?.close();
    }, [open]);
    return jsxs("dialog", {
      ref,
      className: "rules-dialog",
      onCancel: onClose,
      onClick: (e) => {
        if (e.target === e.currentTarget) onClose();
      },
      "aria-labelledby": "rules-title",
      children: [
        jsx("button", { className: "icon-button close", "aria-label": "Close rules", onClick: onClose, children: jsx(Icon, { name: "close" }) }),
        jsx("div", { className: "section-tag", children: "A little trust goes a long way" }),
        jsxs("h2", { id: "rules-title", children: ["Big hearts.", jsx("br", {}), "Small print."] }),
        jsx("p", { children: "3–8 friends. Five projects. About six minutes. Everyone plays on their own device." }),
        jsxs("ol", {
          className: "rules-list",
          children: [
            jsxs("li", { children: [jsx("b", { children: "Read your private need." }), " Each round you get 3 sparks and a secret goal. Match its contribution to earn 2 bonus coins."] }),
            jsxs("li", { children: [jsx("b", { children: "Make a public promise." }), " Say how many sparks you will give. This is a signal to the group, not a binding contract. You have 35 seconds."] }),
            jsxs("li", { children: [jsx("b", { children: "Choose in secret." }), " Actually give 0–3 sparks. Each spark you keep becomes 1 coin. You have 30 seconds; locked choices cannot be changed."] }),
            jsxs("li", { children: [jsx("b", { children: "See what you made together." }), " Enough sparks opens the project. All contributions and private needs are revealed. Extra sparks are spent, not carried forward."] }),
          ],
        }),
        jsxs("div", {
          className: "rule-win",
          children: [
            jsx(Icon, { name: "heart" }),
            jsxs("p", {
              children: [
                jsx("b", { children: "Open at least 4 of 5 projects to win together." }),
                jsx("br", {}),
                "Then the player with the most coins is the Commons Champion. Ties share the title. If the town falls short, there is no individual winner.",
              ],
            }),
          ],
        }),
        jsx("p", { className: "fine", children: "Each round brings a visible rule change. Miss the contribution timer and you give 0, keep 0, and earn no bonus. The game continues if someone disconnects. Rooms last 24 hours." }),
        jsx("p", { className: "fine", children: "Talk in person or on a call. Bluff lightly, take nothing personally. Coins are fictional. The game is a conversation starter, not a measure of anyone’s character." }),
        jsxs("button", { className: "button primary full", onClick: onClose, children: ["Got it. Let’s be neighbors ", jsx(Icon, { name: "arrow", size: 19 })] }),
      ],
    });
  }

  /* ==========================================================================
   * Networking + the useGame hook
   * ======================================================================= */

  const SESSION_KEY = "tiny-commons-session-v1";

  async function api(body, token) {
    const res = await fetch("/api/game", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: `Bearer ${token}` } : {}),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error ?? "The connection had a hiccup. Please retry."), { status: res.status });
    return data;
  }

  function saveSession(session) {
    try {
      if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {}
  }

  function useGame() {
    const [view, setView] = useState(null);
    const [session, setSession] = useState(null);
    const [busy, setBusy] = useState(false);
    const [restoringFlag, setRestoringFlag] = useState(true);
    const [error, setError] = useState("");
    const [offline, setOffline] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [practice, setPractice] = useState(false);

    const practiceRef = useRef(null); // local game object for solo practice
    const lastViewRef = useRef(null); // most recently applied view
    const sessionRef = useRef(null); // { code, token }
    const offsetRef = useRef(0); // serverNow − local clock

    const applyView = useCallback((incoming) => {
      // Drop a view that is older than the one we already show for this room.
      if (lastViewRef.current?.code === incoming.code && (lastViewRef.current.version ?? -1) > (incoming.version ?? -1)) return;
      offsetRef.current = incoming.serverNow - Date.now();
      lastViewRef.current = incoming;
      setView(incoming);
      setNow(incoming.serverNow);
      setOffline(false);
    }, []);

    // Restore a session from this tab (survives a refresh).
    useEffect(() => {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.code && parsed.token) {
            sessionRef.current = parsed;
            setSession(parsed);
          }
        }
      } catch {}
      setRestoringFlag(false);
    }, []);

    // A 1-second clock, corrected to the server's time.
    useEffect(() => {
      const id = setInterval(() => setNow(Date.now() + offsetRef.current), 1000);
      return () => clearInterval(id);
    }, []);

    // Poll the server for the latest room state while in an online game.
    useEffect(() => {
      if (!session) return;
      let cancelled = false;
      let timer;
      async function poll() {
        let delay = document.hidden ? 4000 : 1000;
        try {
          const res = await api({ type: "sync", code: session.code }, session.token);
          if (!cancelled && sessionRef.current?.token === session.token) applyView(res.view);
        } catch (err) {
          if (cancelled) return;
          if (err.status === 401 || err.status === 404) {
            setError(err.message);
            sessionRef.current = null;
            setSession(null);
            saveSession(null);
            lastViewRef.current = null;
            setView(null);
          } else {
            setOffline(true);
            delay = 3000;
          }
        }
        if (!cancelled) timer = setTimeout(poll, delay);
      }
      poll();
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [session, applyView]);

    // Drive the solo-practice game: computer neighbors act, the clock advances.
    useEffect(() => {
      if (!practice) return;
      const id = setInterval(() => {
        const game = practiceRef.current;
        if (!game) return;
        const t = Date.now();
        if (game.phase === "pledge" && (game.deadline ?? 0) - t < 33000)
          game.players.slice(1).forEach((p, n) => {
            game.pledges[p.id] = [3, 2, 2][(n + game.round) % 3];
          });
        if (game.phase === "commit" && (game.deadline ?? 0) - t < 28000)
          game.players.slice(1).forEach((p, n) => {
            game.contributions[p.id] = [3, 2, 1][(n + game.round) % 3];
          });
        game.players.forEach((p) => {
          p.lastSeen = t;
        });
        E.advance(game, t);
        applyView(E.buildView(game, game.players[0].id, t));
      }, 600);
      return () => clearInterval(id);
    }, [practice, applyView]);

    return {
      view,
      busy,
      restoring: restoringFlag || (!!session && !view),
      error,
      offline,
      now,
      practice,
      join: async (name, code) => {
        setBusy(true);
        setError("");
        try {
          const res = await api({ type: code ? "join" : "create", name, code });
          const s = { code: res.view.code, token: res.token };
          sessionRef.current = s;
          lastViewRef.current = null;
          saveSession(s);
          setSession(s);
          applyView(res.view);
          window.history.replaceState(null, "", `/?room=${s.code}`);
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      },
      send: async (action) => {
        if (!lastViewRef.current || busy) return;
        const msg = Object.assign({ gameId: lastViewRef.current.gameId, round: lastViewRef.current.round }, action);
        setBusy(true);
        setError("");
        try {
          if (practiceRef.current) {
            const game = practiceRef.current;
            E.applyAction(game, game.players[0].id, msg, Date.now());
            applyView(E.buildView(game, game.players[0].id, Date.now()));
          } else if (sessionRef.current) {
            const s = sessionRef.current;
            const res = await api(Object.assign({}, msg, { code: s.code }), s.token);
            if (sessionRef.current?.token === s.token && res.view) applyView(res.view);
          }
        } catch (err) {
          setError(err.message);
        } finally {
          setBusy(false);
        }
      },
      leave: async () => {
        if (lastViewRef.current?.phase === "lobby" && sessionRef.current) {
          try {
            await api({ type: "leave", code: sessionRef.current.code }, sessionRef.current.token);
          } catch {
            setError("Could not leave the room. Please retry once connected.");
            return;
          }
        }
        practiceRef.current = null;
        sessionRef.current = null;
        lastViewRef.current = null;
        setSession(null);
        saveSession(null);
        setView(null);
        setPractice(false);
        setOffline(false);
        setError("");
        window.history.replaceState(null, "", "/");
      },
      startPractice: () => {
        const t = Date.now();
        const players = ["You", "Milo", "Jun", "Bea"].map((name, i) => ({ id: `practice-${i}`, name, avatar: i, keyHash: "", coins: 0, lastSeen: t }));
        const game = E.createState("PRACTICE", players[0], t);
        game.players = players;
        E.startGame(game, t);
        practiceRef.current = game;
        lastViewRef.current = null;
        setError("");
        setPractice(true);
        applyView(E.buildView(game, players[0].id, t));
      },
      clearError: () => setError(""),
    };
  }

  /* ==========================================================================
   * Small shared pieces
   * ======================================================================= */

  function CopyButton({ value, label }) {
    const [note, setNote] = useState("");
    return jsxs("span", {
      className: "copy-control",
      children: [
        jsxs("button", {
          className: "button outline small",
          onClick: async () => {
            try {
              await navigator.clipboard.writeText(value());
              setNote("Copied!");
            } catch {
              setNote("Copy from your address bar instead.");
            }
          },
          children: [jsx(Icon, { name: "copy", size: 17 }), note === "Copied!" ? note : label],
        }),
        note && note !== "Copied!" && jsx("small", { role: "status", children: note }),
      ],
    });
  }

  function RoomBar({ game }) {
    const view = game.view;
    return jsxs("div", {
      className: "room-bar",
      children: [
        jsxs("div", {
          children: [
            jsx("span", { className: "status-dot" }),
            game.practice ? "Practice neighborhood" : jsxs(Fragment, { children: ["Room ", jsx("b", { children: view.code })] }),
            jsx("span", { className: "bar-separator", children: "/" }),
            view.players.length,
            " neighbors",
          ],
        }),
        jsxs("div", {
          children: [
            !game.practice && jsx(CopyButton, { value: () => `${location.origin}/?room=${view.code}`, label: "Invite friends" }),
            !game.practice &&
              jsx("button", {
                className: "text-button",
                onClick: () => void game.leave(),
                children: view.phase === "lobby" || view.phase === "finished" ? "Leave room" : "Exit game",
              }),
          ],
        }),
      ],
    });
  }

  function Roster({ view, busy, lobby = false, send }) {
    return jsx("div", {
      className: "roster",
      children: view.players.map((p) =>
        jsxs(
          "div",
          {
            className: "neighbor",
            children: [
              jsx(Avatar, { index: p.avatar }),
              jsxs("div", {
                className: "neighbor-name",
                children: [
                  jsxs("b", { children: [p.name, p.id === view.me.id ? " (you)" : ""] }),
                  jsxs("small", {
                    children: [
                      p.id === view.hostId ? "Host" : p.online ? "Here & scheming" : "Reconnecting",
                      p.id === view.hostId && !p.online ? " · offline" : "",
                    ],
                  }),
                ],
              }),
              lobby
                ? jsx(Fragment, {
                    children:
                      view.hostId === view.me.id && p.id !== view.me.id
                        ? jsx("button", {
                            className: "icon-button remove-player",
                            "aria-label": `Remove ${p.name}`,
                            onClick: () => void send({ type: "kick", playerId: p.id }),
                            disabled: busy,
                            children: jsx(Icon, { name: "close", size: 15 }),
                          })
                        : jsx("span", { className: p.online ? "online-dot" : "offline-dot" }),
                  })
                : jsx("div", {
                    className: "neighbor-state",
                    children:
                      view.phase === "pledge" || view.phase === "commit"
                        ? jsxs(Fragment, {
                            children: [
                              jsx("b", { children: view.pledges[p.id] === undefined ? "Thinking…" : `${view.pledges[p.id]} promised` }),
                              view.phase === "commit" && jsx("small", { children: view.committed.includes(p.id) ? "✓ Choice locked" : "Choosing privately" }),
                            ],
                          })
                        : jsxs("b", { className: "coin-total", children: [jsx(Icon, { name: "coin", size: 16 }), p.coins] }),
                  }),
            ],
          },
          p.id,
        ),
      ),
    });
  }

  function ProjectStrip({ view }) {
    const opened = view.history.filter((h) => h.success).map((h) => h.project);
    return jsx("div", {
      className: "project-strip",
      "aria-label": `${opened.length} of 4 required projects open`,
      children: PROJECTS.map((project, i) =>
        jsxs(
          "div",
          {
            className: `project-marker ${opened.includes(i) ? "built" : ""} ${view.project === i && view.phase !== "finished" ? "selected" : ""}`,
            children: [
              jsx(Icon, { name: opened.includes(i) ? "check" : project.icon, size: 19 }),
              jsx("span", { children: project.short }),
              jsx("small", {
                children: opened.includes(i)
                  ? "Open"
                  : view.history.some((h) => h.project === i)
                    ? "Unfinished"
                    : view.project === i && view.phase !== "finished"
                      ? "Up next"
                      : "Waiting",
              }),
            ],
          },
          project.id,
        ),
      ),
    });
  }

  /* ==========================================================================
   * Screens
   * ======================================================================= */

  function LobbyScreen({ game }) {
    const view = game.view;
    return jsxs("main", {
      className: "game-container",
      children: [
        jsx(RoomBar, { game }),
        jsxs("div", {
          className: "lobby-grid",
          children: [
            jsxs("section", {
              className: "lobby-story",
              children: [
                jsx("div", { className: "section-tag", children: "The best towns start with good company" }),
                jsxs("h1", { children: ["Room for a few", jsx("br", {}), "good neighbors."] }),
                jsxs("p", { className: "lead", children: ["Send the link. Pick a nickname.", jsx("br", {}), "Bring your best intentions. Mostly."] }),
                jsx(Town, { built: [], lively: true }),
                jsxs("div", {
                  className: "lobby-tip",
                  children: [
                    jsx(Icon, { name: "heart" }),
                    jsxs("p", {
                      children: [
                        jsx("b", { children: "Four projects. One shared win." }),
                        jsx("br", {}),
                        "Your private goal may pull you in a different direction. That’s where the fun starts.",
                      ],
                    }),
                  ],
                }),
              ],
            }),
            jsxs("section", {
              className: "lobby-panel",
              children: [
                jsxs("div", {
                  className: "room-code-block",
                  children: [
                    jsx("small", { children: "Your room code" }),
                    jsx("strong", { children: view.code }),
                    jsx(CopyButton, { value: () => view.code, label: "Copy code" }),
                  ],
                }),
                jsxs("div", {
                  className: "panel-heading",
                  children: [jsx("h2", { children: "The neighbors" }), jsxs("span", { children: [view.players.length, "/8"] })],
                }),
                jsx(Roster, { view, lobby: true, send: game.send, busy: game.busy }),
                view.players.length < 3 &&
                  jsxs("p", {
                    className: "waiting-note",
                    children: ["Waiting for ", 3 - view.players.length, " more ", view.players.length === 2 ? "neighbor" : "neighbors", " to start."],
                  }),
                view.hostId === view.me.id
                  ? jsxs("button", {
                      className: "button primary full",
                      disabled: view.players.length < 3 || game.busy,
                      onClick: () => void game.send({ type: "start" }),
                      children: ["Let’s build something ", jsx(Icon, { name: "arrow", size: 19 })],
                    })
                  : jsx("p", { className: "waiting-note", children: "The host will start when everyone is here." }),
                view.canClaimHost &&
                  jsx("button", { className: "button outline full", onClick: () => void game.send({ type: "claimHost" }), disabled: game.busy, children: "Host away? Take over" }),
                jsx("p", { className: "fine", children: "For the best banter, sit together or hop on a call. You each need your own screen. Room codes expire after 24 hours." }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  function ChoicePanel({ game }) {
    const view = game.view;
    const [choice, setChoice] = useState(null);
    useEffect(() => setChoice(null), [view.phase, view.round]);
    const isPledge = view.phase === "pledge";
    const locked = isPledge ? view.pledges[view.me.id] !== undefined : view.me.contribution !== null;
    const shown = locked ? (isPledge ? view.pledges[view.me.id] : view.me.contribution) : choice;
    const done = isPledge ? Object.keys(view.pledges).length : view.committed.length;
    return jsxs("section", {
      className: `choice-panel ${locked ? "locked" : ""}`,
      children: [
        jsxs("div", {
          className: "panel-heading",
          children: [jsx("h2", { children: isPledge ? "What will you promise?" : "What will you really give?" }), jsx(Icon, { name: isPledge ? "people" : "lock", size: 21 })],
        }),
        jsx("p", {
          children: isPledge
            ? "Everyone sees your promise. Your actual choice comes next."
            : `You promised ${view.pledges[view.me.id] ?? "nothing"}. Your choice stays secret until everyone reveals.`,
        }),
        jsx("div", {
          className: "amount-options",
          role: "group",
          "aria-label": isPledge ? "Sparks to promise" : "Sparks to contribute",
          children: [0, 1, 2, 3].map((n) =>
            jsxs(
              "button",
              {
                className: `amount ${shown === n ? "chosen" : ""}`,
                "aria-pressed": shown === n,
                disabled: locked || game.busy || game.offline,
                onClick: () => setChoice(n),
                children: [
                  jsxs("span", { children: [n, jsx(Icon, { name: "spark", size: 20 })] }),
                  jsx("small", {
                    children: isPledge ? (n === 0 ? "Sit this out" : n === 3 ? "All in" : "A little help") : `Keep ${3 - n} ${3 - n === 1 ? "coin" : "coins"}`,
                  }),
                ],
              },
              n,
            ),
          ),
        }),
        locked
          ? jsxs("div", {
              className: "locked-message",
              role: "status",
              children: [
                jsx("span", { className: "lock-badge", children: jsx(Icon, { name: "check", size: 19 }) }),
                jsxs("p", {
                  children: [
                    jsx("b", { children: isPledge ? `Promised ${shown} sparks.` : `${shown} ${shown === 1 ? "spark" : "sparks"} locked in.` }),
                    jsx("br", {}),
                    done === view.players.length ? "Here comes the reveal…" : `Waiting for ${view.players.length - done} ${view.players.length - done === 1 ? "neighbor" : "neighbors"}…`,
                  ],
                }),
              ],
            })
          : jsxs("button", {
              className: "button primary full",
              disabled: choice === null || game.busy || game.offline,
              onClick: () => void game.send({ type: isPledge ? "pledge" : "commit", amount: choice }),
              children: [game.busy ? "Locking in…" : isPledge ? "Make my promise" : "Lock my secret choice", jsx(Icon, { name: "lock", size: 18 })],
            }),
        jsx("p", {
          className: "choice-foot",
          children: isPledge ? "You can change your mind in the secret phase." : "Locked means locked. Miss the timer: give 0, keep 0.",
        }),
      ],
    });
  }

  function RevealPanel({ game }) {
    const view = game.view;
    const last = view.history[view.history.length - 1];
    return jsxs("section", {
      className: "reveal-panel",
      children: [
        jsxs("div", {
          className: "reveal-summary",
          children: [
            jsx("span", { className: `result-stamp ${last.success ? "" : "missed"}`, children: jsx(Icon, { name: last.success ? "check" : "leaf", size: 28 }) }),
            jsxs("div", {
              children: [
                jsx("h2", { children: last.success ? "Look what you made." : "A little short this time." }),
                jsxs("p", {
                  children: [last.total, " of ", last.target, " sparks · ", last.success ? "A new place for everyone." : "The sparks were spent. The next project is a fresh chance."],
                }),
              ],
            }),
          ],
        }),
        jsxs("div", {
          className: "result-table",
          children: [
            jsxs("div", {
              className: "result-table-head",
              children: [jsx("span", { children: "Neighbor" }), jsx("span", { children: "Promised → gave" }), jsx("span", { children: "Coins earned" })],
            }),
            last.players.map((row) => {
              const player = view.players.find((p) => p.id === row.id);
              return jsxs(
                "div",
                {
                  className: "result-row",
                  children: [
                    jsxs("div", {
                      children: [
                        jsx(Avatar, { index: player.avatar, size: 35 }),
                        jsxs("span", {
                          children: [jsx("b", { children: player.name }), jsx("small", { children: row.timedOut ? "Missed the timer" : GOALS[row.goal].title })],
                        }),
                      ],
                    }),
                    jsxs("strong", { children: [row.pledge ?? "–", " ", jsx("span", { className: "result-arrow", children: "→" }), " ", row.amount] }),
                    jsxs("span", {
                      children: [jsxs("b", { children: ["+", row.kept + row.bonus] }), jsxs("small", { children: [row.kept, " kept + ", row.bonus, " bonus"] })],
                    }),
                  ],
                },
                row.id,
              );
            }),
          ],
        }),
        jsxs("details", {
          className: "reveal-details",
          children: [
            jsx("summary", { children: "Why were their needs different?" }),
            jsx("p", {
              children:
                "Each neighbor had a private goal to give exactly 1, 2, or 3 sparks for 2 bonus coins. A smaller contribution can reflect a different need. There is more than one way to help.",
            }),
          ],
        }),
        view.hostId === view.me.id &&
          jsxs("button", {
            className: "button primary full",
            onClick: () => void game.send({ type: "next" }),
            disabled: game.busy,
            children: [view.round + 1 === 5 ? "See our neighborhood" : "On to the next project", jsx(Icon, { name: "arrow", size: 19 })],
          }),
      ],
    });
  }

  function GameScreen({ game }) {
    const view = game.view;
    const project = PROJECTS[view.project];
    const seconds = Math.max(0, Math.ceil(((view.deadline ?? game.now) - game.now) / 1000));
    const promised = Object.values(view.pledges).reduce((sum, n) => sum + n + (view.event === 1 && n === 3 ? 1 : 0), 0);
    const opened = view.history.filter((h) => h.success).map((h) => h.project);
    const headingRef = useRef(null);
    useEffect(() => {
      headingRef.current?.focus({ preventScroll: true });
    }, [view.phase, view.round]);

    return jsxs("main", {
      className: "game-container",
      children: [
        jsx(RoomBar, { game }),
        jsx(ProjectStrip, { view }),
        jsxs("div", {
          className: "game-grid",
          children: [
            jsxs("section", {
              className: "play-area",
              children: [
                jsxs("div", {
                  className: "round-line",
                  children: [
                    jsxs("span", {
                      children: [
                        "Project ",
                        view.round + 1,
                        " of ",
                        5,
                        " ",
                        jsx("span", { className: "bar-separator", children: "/" }),
                        " ",
                        view.phase === "pledge" ? "The promise" : view.phase === "commit" ? "The secret choice" : "The reveal",
                      ],
                    }),
                    jsxs("span", { className: `timer ${seconds <= 10 ? "urgent" : ""}`, "aria-label": `${seconds} seconds remaining`, children: [seconds, "s"] }),
                  ],
                }),
                jsxs("h1", { tabIndex: -1, ref: headingRef, children: [project.name, jsx("span", { className: "heading-dot", children: "." })] }),
                jsx("p", { className: "lead project-description", children: project.description }),
                jsxs("div", {
                  className: "event-strip",
                  children: [jsx(Icon, { name: "spark", size: 22 }), jsxs("div", { children: [jsx("b", { children: EVENTS[view.event].name }), jsx("span", { children: EVENTS[view.event].text })] })],
                }),
                view.phase === "reveal"
                  ? jsx(RevealPanel, { game })
                  : jsxs(Fragment, {
                      children: [
                        jsxs("div", {
                          className: "funding",
                          children: [
                            jsxs("div", {
                              children: [
                                jsx("span", { children: "Public promises" }),
                                jsxs("b", { children: [promised, jsxs("small", { children: [" / ", view.target, " sparks needed"] })] }),
                              ],
                            }),
                            jsx("div", { className: "funding-track", children: jsx("span", { style: { width: `${Math.min(100, (promised / view.target) * 100)}%` } }) }),
                            jsxs("small", {
                              children: [
                                promised >= view.target ? "Enough on paper. Will everyone follow through?" : `${view.target - promised} more promised sparks would cover the project.`,
                                view.event === 1 ? " Includes the matching grant." : "",
                              ],
                            }),
                          ],
                        }),
                        jsxs("div", {
                          className: "private-note mobile-only",
                          children: [
                            jsxs("div", { className: "section-tag", children: [jsx(Icon, { name: "lock", size: 14 }), " Your private need"] }),
                            jsx("h2", { children: GOALS[view.me.goal ?? 0].title }),
                            jsx("p", { children: GOALS[view.me.goal ?? 0].text }),
                          ],
                        }),
                        jsx(ChoicePanel, { game }),
                      ],
                    }),
                jsx("p", {
                  className: "stage-announcement",
                  "aria-live": "polite",
                  children: view.phase === "pledge" ? "Public promise phase." : view.phase === "commit" ? "Secret contribution phase." : "All choices revealed.",
                }),
              ],
            }),
            jsxs("aside", {
              className: "game-sidebar",
              children: [
                jsxs("div", {
                  className: "town-panel",
                  children: [
                    jsxs("div", {
                      className: "panel-heading",
                      children: [jsx("h2", { children: "Our little commons" }), jsxs("span", { children: [opened.length, "/", 4, " open"] })],
                    }),
                    jsx(Town, { built: opened, current: view.project, lively: view.phase === "reveal" }),
                    jsx("p", {
                      children: 4 - opened.length > 0 ? `${4 - opened.length} more ${4 - opened.length === 1 ? "project" : "projects"} for a shared win.` : "Shared win secured. Now for the bragging rights.",
                    }),
                  ],
                }),
                view.phase !== "reveal" &&
                  view.me.goal !== null &&
                  jsxs("div", {
                    className: "private-note desktop-only",
                    children: [
                      jsxs("div", { className: "section-tag", children: [jsx(Icon, { name: "lock", size: 14 }), " Only you can see this"] }),
                      jsx("h2", { children: GOALS[view.me.goal].title }),
                      jsx("p", { children: GOALS[view.me.goal].text }),
                      jsx("span", { className: "bonus-pill", children: "Your private goal · +2 coins" }),
                    ],
                  }),
                jsxs("div", {
                  className: "neighbors-panel",
                  children: [
                    jsxs("div", {
                      className: "panel-heading",
                      children: [
                        jsx("h2", { children: "The neighbors" }),
                        jsx("span", {
                          children:
                            view.phase === "commit"
                              ? `${view.committed.length}/${view.players.length} locked`
                              : jsxs(Fragment, { children: [jsx(Icon, { name: "coin", size: 16 }), view.players.find((p) => p.id === view.me.id)?.coins, " yours"] }),
                        }),
                      ],
                    }),
                    jsx(Roster, { view, busy: game.busy, send: game.send }),
                  ],
                }),
                view.canClaimHost && jsx("button", { className: "button outline full", onClick: () => void game.send({ type: "claimHost" }), children: "Take over as host" }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  function FinishedScreen({ game }) {
    const view = game.view;
    const opened = view.history.filter((h) => h.success).map((h) => h.project);
    const townWon = opened.length >= 4;
    const ranked = [...view.players].sort((a, b) => b.coins - a.coins);
    const champions = ranked.filter((p) => p.coins === ranked[0].coins);
    const firstProject = PROJECTS[opened[0] ?? view.history[0]?.project ?? 0];
    return jsxs("main", {
      className: "game-container",
      children: [
        jsx(RoomBar, { game }),
        jsxs("section", {
          className: "finale-intro",
          children: [
            jsx("div", { className: "section-tag", children: "Five small decisions. Something bigger." }),
            jsx("h1", { children: townWon ? "You made a little good." : "A town worth another try." }),
            jsxs("p", {
              children: [
                opened.length,
                " of 5 projects opened. ",
                townWon ? "Your neighborhood wins—and everyone had a part in it." : "The town needed 4. No individual winner this time; talk it over and try a different plan.",
              ],
            }),
          ],
        }),
        jsxs("div", {
          className: "finale-grid",
          children: [
            jsxs("section", {
              children: [
                jsx(Town, { built: opened, lively: true }),
                jsx(ProjectStrip, { view }),
                jsxs("div", {
                  className: "real-world",
                  children: [
                    jsxs("div", { className: "section-tag", children: [jsx(Icon, { name: "leaf", size: 16 }), " A tiny thing beyond the screen"] }),
                    jsx("h2", { children: "Keep the good going." }),
                    jsx("p", { children: firstProject.action }),
                    jsx("span", { children: "Optional. No proof, tracking, or points. Just a small idea." }),
                  ],
                }),
              ],
            }),
            jsxs("section", {
              className: "score-panel",
              children: [
                jsx("div", { className: "section-tag", children: townWon ? "Commons champion" : "Your coin totals" }),
                jsx("h2", { children: townWon ? champions.map((p) => p.name).join(" & ") : "The town comes first." }),
                jsx("p", {
                  children: townWon
                    ? champions.length > 1
                      ? "A shared crown. There is room for both generosity and a little strategy."
                      : "A little strategy, a little kindness, and excellent timing."
                    : "Coins only crown a champion when the neighborhood wins.",
                }),
                jsx("div", {
                  className: "score-list",
                  children: ranked.map((p, i) =>
                    jsxs(
                      "div",
                      {
                        children: [
                          jsx("span", { className: "rank", children: i + 1 }),
                          jsx(Avatar, { index: p.avatar }),
                          jsxs("b", { children: [p.name, p.id === view.me.id ? " (you)" : ""] }),
                          jsxs("span", { children: [jsx(Icon, { name: "coin", size: 18 }), p.coins] }),
                        ],
                      },
                      p.id,
                    ),
                  ),
                }),
                jsxs("div", {
                  className: "conversation",
                  children: [jsx("b", { children: "One question before the next game:" }), jsx("p", { children: "Whose choice made more sense after you learned their private need?" })],
                }),
                view.hostId === view.me.id
                  ? jsxs("button", {
                      className: "button primary full",
                      disabled: game.busy,
                      onClick: () => void game.send({ type: "rematch" }),
                      children: ["One more neighborhood?", jsx(Icon, { name: "arrow", size: 19 })],
                    })
                  : jsx("p", { className: "waiting-note", children: "Your host can start a rematch." }),
                view.canClaimHost && jsx("button", { className: "button outline full", onClick: () => void game.send({ type: "claimHost" }), children: "Take over as host" }),
                jsx(CopyButton, {
                  value: () => `We opened ${opened.length}/5 projects in Tiny Commons. A little game about trust, secrets, and building something together. ${location.origin}`,
                  label: "Copy our result",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  function LandingScreen({ game }) {
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [joining, setJoining] = useState(false);
    useEffect(() => {
      const room = new URLSearchParams(window.location.search).get("room");
      if (room) {
        setCode(room.toUpperCase().slice(0, 6));
        setJoining(true);
      }
    }, []);
    return jsxs("main", {
      className: "landing",
      children: [
        jsxs("div", {
          className: "hero-copy",
          children: [
            jsxs("div", { className: "section-tag", children: [jsx("span", { className: "status-dot" }), " A multiplayer game of give & take"] }),
            jsxs("h1", { children: ["Small town.", jsx("br", {}), "Big little secrets."] }),
            jsxs("p", { className: "hero-description", children: ["Build a little good together.", jsx("br", {}), "Trust your friends. Mostly."] }),
            jsx("p", {
              className: "hero-sub",
              children:
                "A playful experiment in trust for your favorite people. Share sparks, hide your plans, and see what happens when everyone has a little something at stake.",
            }),
            jsxs("div", {
              className: "join-box",
              children: [
                jsxs("div", {
                  className: "tabs",
                  role: "group",
                  "aria-label": "Create or join a room",
                  children: [
                    jsx("button", { className: joining ? "" : "active", "aria-pressed": !joining, onClick: () => { setJoining(false); game.clearError(); }, children: "Create a room" }),
                    jsx("button", { className: joining ? "active" : "", "aria-pressed": joining, onClick: () => { setJoining(true); game.clearError(); }, children: "Join friends" }),
                  ],
                }),
                jsxs("form", {
                  onSubmit: (e) => {
                    e.preventDefault();
                    game.join(name, joining ? code : undefined);
                  },
                  children: [
                    jsx("label", { htmlFor: "nickname", children: "Your nickname" }),
                    jsx("input", {
                      id: "nickname",
                      value: name,
                      onChange: (e) => setName(e.target.value),
                      maxLength: 18,
                      placeholder: "What should the neighbors call you?",
                      autoComplete: "nickname",
                      required: true,
                    }),
                    joining &&
                      jsxs(Fragment, {
                        children: [
                          jsx("label", { htmlFor: "room-code", children: "Room code" }),
                          jsx("input", {
                            id: "room-code",
                            className: "code-input",
                            value: code,
                            onChange: (e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6)),
                            placeholder: "ABC234",
                            autoComplete: "off",
                            autoCapitalize: "characters",
                            minLength: 6,
                            maxLength: 6,
                            required: true,
                          }),
                        ],
                      }),
                    jsxs("button", {
                      className: "button primary full",
                      disabled: game.busy || !name.trim() || (joining && code.length !== 6),
                      children: [game.busy ? "Finding your neighborhood…" : joining ? "Join the neighborhood" : "Start a neighborhood", jsx(Icon, { name: "arrow", size: 19 })],
                    }),
                  ],
                }),
                jsxs("button", {
                  className: "text-button practice-link",
                  onClick: game.startPractice,
                  children: ["Just curious? Try a solo practice ", jsx("span", { "aria-hidden": "true", children: "↗" })],
                }),
              ],
            }),
            jsxs("div", {
              className: "quick-facts",
              children: [
                jsxs("span", { children: [jsx(Icon, { name: "people", size: 17 }), "3–8 players"] }),
                jsx("span", { children: "~6 minutes" }),
                jsx("span", { children: "No accounts. No installs." }),
              ],
            }),
          ],
        }),
        jsxs("div", {
          className: "hero-world",
          children: [
            jsxs("div", { className: "world-label", children: [jsx(Icon, { name: "spark", size: 17 }), " Good things take a few accomplices."] }),
            jsx(Town, { built: [0, 1, 3], current: 2, lively: true }),
            jsxs("div", {
              className: "speech speech-one",
              children: [jsx(Avatar, { index: 1, size: 33 }), jsxs("div", { children: ["“I promise I’ll give three.”", jsx("small", { children: "Famous last words." })] })],
            }),
            jsxs("div", {
              className: "speech speech-two",
              children: [jsx(Icon, { name: "leaf", size: 25 }), jsxs("div", { children: ["Garden unlocked!", jsx("small", { children: "Turns out, you needed each other." })] })],
            }),
            jsxs("div", {
              className: "world-note",
              children: [
                jsx("span", { className: "note-star", children: "✳" }),
                jsxs("p", { children: [jsx("b", { children: "Your town only wins together." }), jsx("br", {}), "Your pockets might disagree."] }),
              ],
            }),
          ],
        }),
        jsxs("section", {
          className: "landing-bottom",
          "aria-label": "How the game feels",
          children: [
            jsxs("div", { children: [jsx("span", { className: "mini-number", children: "1" }), jsxs("p", { children: [jsx("b", { children: "Promise out loud." }), jsx("br", {}), "Make your case. Read the room."] })] }),
            jsxs("div", { children: [jsx("span", { className: "mini-number", children: "2" }), jsxs("p", { children: [jsx("b", { children: "Choose in secret." }), jsx("br", {}), "Your needs. Your little dilemma."] })] }),
            jsxs("div", { children: [jsx("span", { className: "mini-number", children: "3" }), jsxs("p", { children: [jsx("b", { children: "Watch the town come alive." }), jsx("br", {}), "Find out who came through."] })] }),
          ],
        }),
      ],
    });
  }

  /* ==========================================================================
   * App root
   * ======================================================================= */

  function App() {
    const game = useGame();
    const [rulesOpen, setRulesOpen] = useState(false);
    const [soundOn, setSoundOn] = useState(false);
    const prevPhase = useRef("");
    const audio = useRef(null);

    // A soft three-note chime the first time each reveal appears (if sound is on).
    useEffect(() => {
      if (soundOn && game.view?.phase === "reveal" && prevPhase.current !== "reveal") {
        const ctx = audio.current;
        if (ctx)
          [440, 554, 659].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.035, ctx.currentTime + i * 0.09);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4 + i * 0.09);
            osc.start(ctx.currentTime + i * 0.09);
            osc.stop(ctx.currentTime + 0.5 + i * 0.09);
          });
      }
      prevPhase.current = game.view?.phase ?? "";
    }, [game.view?.phase, soundOn]);

    let main;
    if (game.restoring) {
      main = jsxs("main", {
        className: "loading-page",
        role: "status",
        children: [
          jsx(Icon, { name: "spark", size: 40 }),
          jsx("h1", { children: "Finding your neighborhood…" }),
          jsx("p", { children: "Your room is catching up." }),
          game.offline && jsx("button", { className: "button outline", onClick: () => void game.leave(), children: "Return home" }),
        ],
      });
    } else if (game.view) {
      main = game.view.phase === "lobby" ? jsx(LobbyScreen, { game }) : game.view.phase === "finished" ? jsx(FinishedScreen, { game }) : jsx(GameScreen, { game });
    } else {
      main = jsx(LandingScreen, { game });
    }

    return jsxs("div", {
      className: "app-shell",
      children: [
        jsx("a", { className: "skip-link", href: "#main-content", children: "Skip to game" }),
        jsxs("header", {
          className: "site-header",
          children: [
            jsxs("div", {
              className: "brand",
              "aria-label": "Tiny Commons",
              children: [
                jsx("span", { className: "brand-mark", children: jsx(Icon, { name: "spark", size: 25 }) }),
                jsxs("span", {
                  children: ["tiny", jsx("span", { className: "brand-light", children: "commons" }), jsx("span", { className: "brand-period", children: "." })],
                }),
              ],
            }),
            jsxs("div", {
              className: "header-actions",
              children: [
                game.view &&
                  jsxs("button", {
                    className: "text-button sound-button",
                    "aria-pressed": soundOn,
                    "aria-label": `Sound ${soundOn ? "on" : "off"}`,
                    onClick: () => {
                      if (!soundOn) {
                        audio.current ??= new (window.AudioContext || window.webkitAudioContext)();
                        audio.current.resume();
                      }
                      setSoundOn(!soundOn);
                    },
                    children: [jsx(Icon, { name: "volume", size: 17 }), jsxs("span", { children: ["Sound ", soundOn ? "on" : "off"] })],
                  }),
                jsxs("button", {
                  className: "button outline small",
                  onClick: () => setRulesOpen(true),
                  children: ["How to play ", jsx("span", { className: "question-icon", children: "?" })],
                }),
              ],
            }),
          ],
        }),
        game.error &&
          jsxs("div", {
            className: "alert",
            role: "alert",
            children: [
              jsx("span", { children: game.error }),
              jsx("button", { className: "icon-button", onClick: game.clearError, "aria-label": "Dismiss message", children: jsx(Icon, { name: "close", size: 18 }) }),
            ],
          }),
        game.offline &&
          jsx("div", { className: "connection-banner", role: "status", children: "Reconnecting… locked choices are saved. The timer continues on the server." }),
        game.practice &&
          jsxs("div", {
            className: "practice-banner",
            children: [
              jsxs("span", { children: [jsx("b", { children: "Solo practice" }), " · You + 3 computer neighbors. This game stays on your device."] }),
              jsx("button", { className: "text-button", onClick: () => void game.leave(), children: "Exit practice" }),
            ],
          }),
        jsx("div", { id: "main-content", children: main }),
        jsxs("footer", {
          className: "site-footer",
          children: [jsx("span", { children: "A little game about the things we share." }), jsx("span", { children: "Fictional coins. Real conversations." })],
        }),
        jsx(RulesDialog, { open: rulesOpen, onClose: () => setRulesOpen(false) }),
      ],
    });
  }

  ReactDOM.createRoot(document.getElementById("root")).render(jsx(App));
})();
