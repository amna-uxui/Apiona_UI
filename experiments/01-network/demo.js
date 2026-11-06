/*
  Presentation mode and autoplay clips, for recording the demo.

    ?demo        presentation mode: starts as a new patient, motion a little slower so it reads on video
    ?demo=1…10   the same, plus one clip that plays itself (with its own grey dot instead of the mouse pointer):
                 press Space to start it once you are recording
    ?demo=all    clips 1 to 9 one after the other (clip 10 needs a phone-sized window)

  The soft grey dot is the cursor of the clip. Nothing here runs without ?demo in the address.
*/
(function () {
  const q = new URLSearchParams(location.search);
  if (!q.has("demo")) return;
  const clip = q.get("demo");
  try { localStorage.removeItem("apiona-consultation-v1"); } catch (e) {}   // always a new patient, as before her first session
  document.documentElement.classList.add("demo-mode");

  const css = document.createElement("style");
  css.textContent = `
    html.demo-mode { --m-fast: .22s; --m-base: .52s; --m-slow: .85s; }
    html.demo-play, html.demo-play * { cursor: none !important; }   /* only while a clip plays: live, your pointer stays */
    .demo-cursor { position: fixed; left: 0; top: 0; z-index: 9999; width: 18px; height: 18px; margin: -9px 0 0 -9px; border-radius: 50%;
      background: rgb(40 40 40 / .42); box-shadow: 0 0 0 2px rgb(255 255 255 / .9), 0 2px 8px rgb(0 0 0 / .18); pointer-events: none;
      opacity: 0; transition: opacity .4s ease; will-change: transform; }
    .demo-cursor.is-on { opacity: 1; }
    .demo-cursor.is-down { background: rgb(40 40 40 / .6); }
    .demo-cursor::after { content: ""; position: absolute; inset: -2px; border-radius: 50%; border: 2px solid rgb(40 40 40 / .35); opacity: 0; }
    .demo-cursor.is-click::after { animation: demo-pulse .55s ease-out; }
    @keyframes demo-pulse { from { transform: scale(1); opacity: 1; } to { transform: scale(2.6); opacity: 0; } }`;
  document.head.appendChild(css);

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
  async function find(sel, timeout = 6000) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const el = [...document.querySelectorAll(sel)].find(visible);
      if (el) return el;
      await sleep(100);
    }
    throw new Error(`demo: nothing visible for ${sel}`);
  }

  /* ---------- the cursor ---------- */
  let cur, pos = { x: innerWidth * 0.62, y: innerHeight * 0.72 };
  function place(x, y, ms) {
    cur.style.transition = `opacity .4s ease, transform ${ms}ms cubic-bezier(.45, 0, .2, 1)`;
    cur.style.transform = `translate(${x}px, ${y}px)`;
    pos = { x, y };
  }
  async function moveTo(el, dx = 0.5, dy = 0.5) {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    await sleep(250);
    const r = el.getBoundingClientRect();
    const x = r.left + r.width * dx, y = r.top + r.height * dy;
    const ms = Math.min(1100, 420 + Math.hypot(x - pos.x, y - pos.y) * 0.55);
    place(x, y, ms);
    await sleep(ms + 120);
  }
  const fire = (el, type) => el.dispatchEvent(new MouseEvent(type, { bubbles: type !== "mouseenter" && type !== "mouseleave", cancelable: true, view: window }));

  /* ---------- what a clip can do ---------- */
  const at = async (sel, dx, dy) => { const el = await find(sel); await moveTo(el, dx, dy); return el; };
  async function click(sel, opts = {}) {
    const el = await at(sel, opts.dx, opts.dy);
    cur.classList.add("is-down"); await sleep(90);
    cur.classList.remove("is-click"); void cur.offsetWidth; cur.classList.add("is-click");
    fire(el, "mousedown"); fire(el, "mouseup");
    if (el instanceof HTMLElement && !(el instanceof SVGElement)) el.click(); else fire(el, "click");
    cur.classList.remove("is-down");
    await sleep(opts.after ?? 900);
    return el;
  }
  async function hover(sel, ms = 900) { const el = await at(sel); fire(el, "mouseenter"); await sleep(ms); fire(el, "mouseleave"); }
  async function type(sel, text, { enter = true, speed = 55 } = {}) {
    const el = await click(sel, { after: 200 });
    el.focus();
    for (const ch of text) {
      el.value += ch; el.dispatchEvent(new Event("input", { bubbles: true }));
      await sleep(speed + Math.random() * 40);
    }
    await sleep(350);
    if (enter) el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    await sleep(700);
  }
  const scrollIn = async (sel, by, ms = 1200) => { const el = await find(sel); el.scrollBy({ top: by, behavior: "smooth" }); await sleep(ms); };
  const quiet = async (sel) => { const el = await find(sel); el.click(); await sleep(150); };   // setup before the clip starts: no cursor
  const startConsult = async () => { if (!document.body.classList.contains("is-consult")) { await quiet(".start"); await sleep(1400); } };

  /* ---------- the clips: before, during, after ---------- */
  const CLIPS = {
    // 1 · the network re-arranges around what you choose, then comes back to her
    1: async () => {
      await sleep(600);
      await click('.node[data-id="hurts"]', { after: 2200 });
      await click('.node[data-id="happened"]', { after: 2200 });
      await click('.node[data-id="wants"]', { after: 2000 });
      await click('.node[data-id="camille"]', { after: 1800 });
    },
    // 2 · what to know before the session: each point opens its details
    2: async () => {
      await sleep(500);
      await hover('.row[data-id="heds"]', 600);
      await click('.row[data-id="cavernoma"]', { after: 2400 });
      await click('.row[data-id="treatments"]', { after: 2400 });
    },
    // 3 · an attached report arrives as prints; one click brings them to the middle
    3: async () => {
      await sleep(500);
      await click('.row[data-id="heds"]', { after: 1800 });
      await click("#media .print", { after: 2600 });
      await click("#veil", { dx: 0.9, dy: 0.85, after: 1600 });
    },
    // 4 · starting the consultation: the summary steps aside
    4: async () => {
      await sleep(500);
      await click(".start", { after: 2600 });
      await click('#cs-goals .c-sec-head', { after: 1800 });
    },
    // 5 · notes in the session's own time, and dictation that waits to be approved
    5: async () => {
      await type("#c-notes .jot-input", "Limps on the right, avoids putting weight on the outer edge");
      await type("#c-notes .jot-input", "Pain 6/10 on the stairs");
      await click(".c-dictate", { after: 7200 });
      await click(".dict-ok", { after: 1200 });
      await click("#dict-stop", { after: 900 });
    },
    // 6 · choosing what to assess on the body
    6: async () => {
      await hover('.as-body .spot[data-area="balance"]', 700);
      await hover('.as-body .spot[data-area="muscles"]', 700);
      await click('.as-body .spot[data-area="function"]', { after: 1800 });
      await click('.as-body .spot[data-area="joints"]', { after: 2000 });
    },
    // 7 · the reason for the visit, confirmed with her point by point
    7: async () => {
      const oks = [...document.querySelectorAll("#rh .rh-ok")].slice(0, 3);
      for (const b of oks) { b.dataset.demo = "1"; await click('#rh .rh-ok[data-demo="1"]', { after: 900 }); delete b.dataset.demo; }
      await sleep(600);
    },
    // 8 · finish: the report assembles itself; signing draws the seal
    8: async () => {
      await click(".start", { after: 2600 });
      const sign = await click(".r-sign-btn", { after: 1400 });
      if (sign.dataset.sure && document.querySelector(".r-sign-btn")) await click(".r-sign-btn", { after: 3200 });
      else await sleep(1800);
    },
    // 9 · after: the follow-up, then the documents as prints
    9: async () => {
      await sleep(500);
      await click('ol.pages .page[data-page="followup"]', { after: 2400 });
      await click('ol.pages .page[data-page="documents"]', { after: 2000 });
      await click('.pr-item[data-doc="heds"]', { after: 2200 });
      await click('.pr-item[data-doc="emergency"]', { after: 2400 });
    },
    // 10 · on a phone (use a phone-sized window): the summary card, then notes as a sheet
    10: async () => {
      if (innerWidth > 760) console.warn("demo 10 is made for a phone-sized window (Chrome device mode, iPhone)");
      await sleep(500);
      await click("#m-sum-btn", { after: 2400 });
      await click(".brief .name", { after: 1200 });
      await click(".start", { after: 2200 });
      await click("#c-notes .c-notes-handle", { after: 1200 });
      await type("#c-notes .jot-input", "Pain 6/10 on the stairs", { speed: 60 });
      await click("#c-notes .c-notes-handle", { after: 1500 });
    },
  };

  // what has to be there before a clip starts, done quietly (no cursor) before you press Space
  const SETUP = {
    5: startConsult, 7: startConsult, 8: startConsult,
    6: async () => { await startConsult(); await quiet('#cs-assessment .c-sec-head'); await sleep(900); },
  };

  /* ---------- Space starts the clip, so you can start recording first ---------- */
  const pressSpace = () => new Promise((res) => {
    const on = (e) => { if (e.code === "Space") { e.preventDefault(); removeEventListener("keydown", on, true); res(); } };
    addEventListener("keydown", on, true);
  });

  async function run(ids) {
    document.documentElement.classList.add("demo-play");
    cur = document.createElement("div"); cur.className = "demo-cursor"; document.body.appendChild(cur);
    place(pos.x, pos.y, 0);
    if (SETUP[ids[0]]) await SETUP[ids[0]]();
    await pressSpace();
    await sleep(80);
    for (const [k, id] of ids.entries()) {
      if (k > 0 && SETUP[id]) await SETUP[id]();
      cur.classList.add("is-on");
      try { await CLIPS[id](); } catch (e) { console.warn(e.message); }
      if (ids.length > 1) await sleep(900);
    }
    cur.classList.remove("is-on");
  }

  if (clip && clip !== "") {
    const ids = clip === "all" ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [clip];
    if (ids.every((id) => CLIPS[id])) addEventListener("load", () => setTimeout(() => run(ids), 300));
  }
})();
