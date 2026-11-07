/*
  Camille's record as a network: first page (the summary).

  Three views, never more than a handful of nodes at once
  - Overview:  Camille and her 5 sections. Each section's subtitle already says what is inside.
  - Section:   the section moves to the centre, Camille steps back, its items fan out.
  - Item:      the item moves to the centre with its path back to Camille, and the records
               it relates to come out on dotted lines.

  Motion: every node is on a spring. When the view changes, nodes glide to their new place,
  one after another, and the lines follow them. Interrupting a move stays smooth.
*/

(() => {
  const R = window.RECORD;
  // ?still skips the motion (for reviewing layouts); so does the system's "reduce motion"
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");

  const byId = new Map(R.nodes.map((n) => [n.id, n]));
  const kids = (id) => R.nodes.filter((n) => n.parent === id);
  const sections = R.nodes.filter((n) => n.kind === "section");
  const orphans = R.nodes.filter((n) => n.kind === "item" && !n.parent);

  // links are stored one way in the data; the map shows them both ways
  // no clinician defined links between the points, so none are drawn; only a file you attach yourself is linked to its point
  const related = new Map(R.nodes.map((n) => [n.id, new Set()]));

  const $ = (s) => document.querySelector(s);
  const map = $("#map"), world = $("#world"), svg = $("#lines"), layer = $("#nodes");
  const indexBody = $("#index-body"), indexToggle = $("#index-toggle");

  const state = { current: null, visited: new Set(), pan: { x: 0, y: 0 }, lastAngle: 0, cursor: null };

  /* ---------------- brief ---------------- */

  $("#p-name").textContent = R.patient.name;
  $("#p-facts").innerHTML = (R.patient.facts || []).map(([ic, t]) => `<li><svg class="i" aria-hidden="true"><use href="#i-${ic}"/></svg><span>${t}</span></li>`).join("");
  /* icons in one list should look the same size: each drawing is framed on its own outline, so a small glyph
     (armchair, person) is not lost next to a wide one (cake, briefcase) */
  function evenIcons(root) {
    root.querySelectorAll("svg.i").forEach((svg) => {
      const u = svg.querySelector("use"); if (!u || svg.dataset.even) return;
      const b = u.getBBox(), box = svg.getBoundingClientRect().width; if (!b.width || !box) return;
      u.setAttribute("width", box); u.setAttribute("height", box);   // the drawing keeps its size; only the frame moves
      const S = Math.max(b.width, b.height) * 1.22;
      svg.setAttribute("viewBox", `${b.x + b.width / 2 - S / 2} ${b.y + b.height / 2 - S / 2} ${S} ${S}`);
      svg.dataset.even = "1";
    });
  }
  evenIcons($("#p-facts"));
  window.addEventListener("load", () => evenIcons($("#p-facts")));   // again once fonts and sprites are surely in
  $("#p-new").hidden = !R.patient.isNew;
  $("#p-new").title = "New patient";
  // the last two words always stay together, so no word sits alone on the last line
  $("#p-brief").innerHTML = R.patient.brief.replace(/ (\S+)$/, "\u00a0$1").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // on a phone the tags are shorter, so all three fit on one row
  function shortTag(t) {
    if (t.tone === "session") return /done/.test(t.text) ? "Session 1 · done" : "Session 1 of 9";
    return t.text;
  }
  $("#p-tags").innerHTML = R.patient.tags.map((t) => `<li class="tag tag-${t.tone}"><span class="t-long">${t.text}</span><span class="t-short">${shortTag(t)}</span></li>`).join("");
  $(".m-sum-text").innerHTML = $("#p-brief").innerHTML;
  // phone: the summary card grows out of its button, and folds back into it
  (() => {
    const btn = $("#m-sum-btn"), card = $("#m-sum-card");
    const set = (on) => {
      btn.setAttribute("aria-expanded", on); btn.classList.toggle("is-on", on);
      if (on) { card.hidden = false; void card.offsetWidth; card.classList.add("is-in"); }
      else { card.classList.remove("is-in"); setTimeout(() => { if (!card.classList.contains("is-in")) card.hidden = true; }, 380); }
    };
    btn.addEventListener("click", (e) => { e.stopPropagation(); set(!card.classList.contains("is-in")); });
    document.addEventListener("click", (e) => { if (card.classList.contains("is-in") && !card.contains(e.target)) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && card.classList.contains("is-in")) set(false); });
  })();

  /* ---------------- nodes ---------------- */

  const HEX = '<svg viewBox="0 0 30 26"><polygon points="7.5,0.6 22.5,0.6 29.4,13 22.5,25.4 7.5,25.4 0.6,13"/></svg>';
  const STAR = (() => {
    const pts = [];
    for (let i = 0; i < 20; i++) {
      const r = i % 2 ? 11 : 17, a = (i / 20) * Math.PI * 2 - Math.PI / 2;
      pts.push(`${(17 + r * Math.cos(a)).toFixed(2)},${(17 + r * Math.sin(a)).toFixed(2)}`);
    }
    return `<svg viewBox="0 0 34 34"><path d="M${pts.join(" L")} Z"/></svg>`;
  })();
  // a flat folder: back with its tab, papers peeking out, and a front flap that opens
  const FOLDER = `<svg class="folder" viewBox="0 0 34 26" aria-hidden="true">
    <path class="f-back" d="M1.5 4.5a2 2 0 0 1 2-2h8l2.5 3h16.5a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-27a2 2 0 0 1-2-2z"/>
    <rect class="f-paper" x="5" y="6" width="22" height="14" rx="1"/>
    <rect class="f-paper f-paper2" x="7" y="5" width="21" height="14" rx="1"/>
    <path class="f-front" d="M1.5 10a2 2 0 0 1 2-2h27a2 2 0 0 1 2 2v12.5a2 2 0 0 1-2 2h-27a2 2 0 0 1-2-2z"/>
  </svg>`;
  // half the height of each shape (the node sits on its centre); on desktop the network is drawn larger
  const half = (n) => isPhone()
    ? (n.kind === "person" ? 17 : n.kind === "section" ? 13 : n.folder ? 13 : 8)
    : (n.kind === "person" ? 24 : n.kind === "section" ? 20 : n.folder ? 13 : 10);

  function makeNode(n) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = ["node", `kind-${n.kind}`, n.source && `src-${n.source}`, n.mark && `mark-${n.mark}`, n.folder && "is-folder"].filter(Boolean).join(" ");
    el.dataset.id = n.id;
    const shape = n.kind === "section" ? `${HEX}<b>${n.n}</b>` : n.kind === "person" ? STAR : n.folder ? FOLDER : "";
    el.innerHTML = `<span class="shape">${shape}</span>
      <span class="label"><span class="title">${n.label}</span><span class="sub">${n.sub || ""}</span></span>`;
    el.setAttribute("aria-label", `${n.label}. ${n.sub || ""}`);
    // Camille: on the first view her node opens her details in the index (and her photo behind it);
    // from anywhere else it brings you back to the first view
    el.addEventListener("click", () => (n.kind === "person" ? (state.current ? go(null) : setProfile(!state.profile)) : go(n.id)));
    el.addEventListener("mouseenter", () => hintRow(n.id, true));
    el.addEventListener("mouseleave", () => hintRow(n.id, false));
    layer.appendChild(el);
    n.el = el;
    n.p = { x: 0, y: 0, vx: 0, vy: 0, o: 0 };   // drawn state
    n.t = { x: 0, y: 0, o: 0 };                 // target
    n.release = 0;                              // when it starts moving to its target
    n.m = { x: 0, y: 0, vx: 0, vy: 0 };         // magnetic offset toward the cursor
  }
  R.nodes.forEach(makeNode);

  /* ---------------- layouts ---------------- */

  // where each section sits around Camille in the overview (degrees, 0 = right, clockwise)
  const ANGLE = { know: 205, wants: 295, hurts: 5, happened: 80, complete: 145 };
  const polar = (deg, rx, ry) => ({ x: Math.cos((deg * Math.PI) / 180) * rx, y: Math.sin((deg * Math.PI) / 180) * ry });
  const fan = (ids, centre, rx, ry, step, max) => {
    const s = ids.length > 1 ? Math.min(step, max / (ids.length - 1)) : 0;
    const spots = ids.map((_, i) => polar(centre + (i - (ids.length - 1) / 2) * s, rx, ry));
    // hand out the spots in reading order: top to bottom on the sides, left to right above and below
    const c = polar(centre, 1, 1);
    spots.sort(Math.abs(c.x) > Math.abs(c.y) ? (p, q) => p.y - q.y : (p, q) => p.x - q.x);
    const out = {};
    ids.forEach((id, i) => (out[id] = spots[i]));
    return out;
  };

  // on a phone the same layout is drawn narrower: points closer together side to side, so little shrinking is needed
  function layout(currentId) {
    if (isPhone() && !currentId) {
      // the overview on a phone runs top to bottom: Camille, then her five sections in a gentle zig-zag
      const L = { camille: { x: 0, y: 0 } };
      ["know", "wants", "hurts", "happened", "complete"].forEach((id, i) => { L[id] = { x: i % 2 ? 72 : -72, y: 118 + i * 96 }; });
      return { L, focus: null };
    }
    // desktop, Where it hurts: the pain points live on her body beside the network, so the web keeps only its path
    const cur = currentId && byId.get(currentId);
    if (!isPhone() && inHurts(cur)) {
      return { L: { hurts: { x: 0, y: 0 }, camille: { x: -70, y: -190 } }, focus: "hurts", angle: ANGLE.hurts };   // Camille just above: the web stays narrow beside the body
    }
    const out = layoutWide(currentId);
    if (isPhone()) Object.values(out.L).forEach((p) => { p.x *= 0.5; });
    return out;
  }
  function layoutWide(currentId) {
    const L = {};
    const c = currentId && byId.get(currentId);

    if (!c) {
      L.camille = { x: 0, y: 0 };
      const k = isPhone() ? 1 : Math.min(1.18, Math.max(1, (map.clientWidth - 230) / 520));   // desktop: spreads into the space it has
      sections.forEach((s) => (L[s.id] = polar(ANGLE[s.id], 260 * k, 185 * k)));
      return { L, focus: null };
    }

    if (c.kind === "section") {
      const a = ANGLE[c.id];
      L[c.id] = { x: 0, y: 0 };
      L.camille = polar(a + 180, 250, 175);
      // sideways fans get more width for their longer labels; fans that open up or down keep it compact
      const sideways = Math.abs(Math.cos((a * Math.PI) / 180)) > Math.abs(Math.sin((a * Math.PI) / 180));
      Object.assign(L, fan(kids(c.id).map((k) => k.id), a, sideways ? 330 : 270, 225, 40, 190));
      return { L, focus: c.id, angle: a };
    }

    // an item: its path back to Camille behind it, what it relates to in front
    const parent = c.parent && byId.get(c.parent);
    // a document without a section fans its links to the left when it has prints (they sit on the right)
    const a = parent ? ANGLE[parent.id] : c.media ? 180 : state.lastAngle;
    L[c.id] = { x: 0, y: 0 };
    if (parent) {
      L[parent.id] = polar(a + 180, 220, 150);
      // Camille steps back at an angle rather than in a straight line: the path stays readable
      // and the view stays narrow enough for the map when the left menu is open
      const p = L[parent.id];
      const bends = [a + 180 + 58, a + 180 - 58].map((d) => { const o = polar(d, 210, 150); return { x: p.x + o.x, y: p.y + o.y }; });
      L.camille = bends[0].y >= bends[1].y ? bends[0] : bends[1];   // prefer below, away from the header
    } else {
      L.camille = c.media ? { x: 100, y: 225 } : polar(a + 180, 260, 180);   // below, out of the way of the prints
    }
    const front = [...related.get(c.id)].filter((id) => !(id in L));
    // the fan in front tightens a little when the map is narrow (left menu open)
    const avail = map.clientWidth - mediaWidth(c);   // prints take the right of the map
    const room = Math.min(1, Math.max(0.6, (avail - 140) / 900));
    if (!parent && c.media) Object.assign(L, fan(front, a, 270, 190, 50, 200));   // a document with prints: a full fan to the left
    else Object.assign(L, fan(front, a, 270 * room, 190, 42 / room, 240));   // closer in, so wider apart
    return { L, focus: c.id, angle: a };
  }

  /* ---------------- camera ---------------- */

  const cam = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 };

  let mapScale = 1;
  function cameraTarget(L) {
    const pts = Object.values(L);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const m = map.getBoundingClientRect();
    if (isPhone()) {
      // on a phone the whole web is scaled down to fit the width, and centred in the map's own box
      const spanX = Math.max(...xs) - Math.min(...xs) + 190, spanY = Math.max(...ys) - Math.min(...ys) + 110;
      mapScale = Math.min(1, m.width / spanX, (m.height - 10) / spanY);
      return { x: m.width / 2 - mapScale * (Math.min(...xs) + Math.max(...xs)) / 2, y: m.height / 2 - mapScale * (Math.min(...ys) + Math.max(...ys) + 40) / 2 };
    }
    const top = $(".brief").getBoundingClientRect().bottom + 30;
    const bottom = m.height - 40;
    const room = m.width - (state.profile ? 170 : mediaWidth(state.current && byId.get(state.current)));   // prints or her photo take the right of the map
    // when the network is wider or taller than its room (a narrower window), it is drawn a little smaller to fit
    const spanX = Math.max(...xs) - Math.min(...xs) + 250, spanY = Math.max(...ys) - Math.min(...ys) + 110;
    mapScale = Math.max(0.72, Math.min(1, room / spanX, (bottom - top) / spanY));
    const centred = room / 2 - mapScale * (Math.min(...xs) + Math.max(...xs)) / 2;
    return {
      x: Math.max(centred, 120 * mapScale - mapScale * Math.min(...xs)),   // never push a label past the left edge
      y: Math.max(top + 6 - mapScale * Math.min(...ys),   // never under the header
        (top + bottom) / 2 - mapScale * (Math.min(...ys) + Math.max(...ys) + 40) / 2 - 70),   // centred, then raised towards the summary
    };
  }

  /* ---------------- applying a view ---------------- */

  function apply(instant = false) {
    const { L, focus, angle } = layout(state.current);
    if (angle !== undefined) state.lastAngle = angle;
    const now = performance.now();
    const centre = focus ? L[focus] : L.camille;

    // order of appearance: from the centre outwards
    const dist = (id) => Math.hypot(L[id].x - centre.x, L[id].y - centre.y);
    const incoming = Object.keys(L).sort((a, b) => dist(a) - dist(b));

    R.nodes.forEach((n) => {
      const show = n.id in L;
      const wasShown = n.t.o > 0;
      n.el.classList.toggle("is-current", n.id === state.current);
      n.el.classList.toggle("is-leaving", !show);   // its words go at once; only the shape folds away
      n.el.tabIndex = show ? 0 : -1;
      n.el.setAttribute("aria-hidden", show ? "false" : "true");

      if (show) {
        if (!wasShown) {
          // a new node grows out of the node it belongs to
          const anchor = [n.parent, focus, "camille"].map((id) => id && byId.get(id)).find((a) => a && a.t.o > 0 && a.id in L) || byId.get("camille");
          n.p = { x: anchor.p.x, y: anchor.p.y, vx: 0, vy: 0, o: 0 };
        }
        n.t = { ...L[n.id], o: 1 };
        n.release = now + (wasShown ? 0 : 60 + incoming.indexOf(n.id) * 55);
      } else if (wasShown) {
        // a leaving node folds back into what stays
        const into = (n.parent && L[n.parent]) || (focus && L[focus]) || L.camille;
        n.t = { ...into, o: 0 };
        n.release = now;
      }
    });

    const ct = cameraTarget(L);
    cam.tx = ct.x; cam.ty = ct.y;
    if (instant) { cam.x = ct.x; cam.y = ct.y; }
    state.pan = { x: 0, y: 0 };
    kick();
  }

  /* ---------------- motion ---------------- */

  const K = 90, DAMP = 2 * Math.sqrt(K) * 0.95;   // soft spring, no bounce
  let running = false, last = 0;

  // Magnetic pull: near the cursor, a node leans toward it and its lines stretch along.
  // It never drifts on its own, and stays still with "reduce motion".
  const PULL = { radius: 150, max: 12, k: 180, damp: 2 * Math.sqrt(180) * 0.6 };   // a little springy
  // every node drifts a few pixels around its place, like the facts in the assessment; the lines follow
  let driftT = 0;
  const drift = (n) => {
    if (reduceMotion) return { x: 0, y: 0 };
    const k = n.seed || (n.seed = Math.random() * 10);
    return { x: Math.sin(driftT / 2600 + k) * 4, y: Math.cos(driftT / 2100 + k * 1.3) * 4 };
  };
  const at = (n) => { const d = drift(n); return { x: n.p.x + n.m.x + d.x, y: n.p.y + n.m.y + d.y }; };

  function pullTarget(n) {
    if (!state.cursor || drag || n.t.o === 0 || n.p.o < 0.5) return { x: 0, y: 0 };
    const cx = state.cursor.x - cam.x - state.pan.x, cy = state.cursor.y - cam.y - state.pan.y;
    const dx = cx - n.p.x, dy = cy - n.p.y, d = Math.hypot(dx, dy);
    if (d > PULL.radius || d < 0.5) return { x: 0, y: 0 };
    const f = PULL.max * (1 - d / PULL.radius) * Math.min(1, d / 24);   // eases off right under the cursor
    return { x: (dx / d) * f, y: (dy / d) * f };
  }

  function kick() {
    if (reduceMotion) {
      R.nodes.forEach((n) => (n.p = { ...n.t, vx: 0, vy: 0 }));
      cam.x = cam.tx; cam.y = cam.ty;
      draw(); return;
    }
    if (!running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
  }

  function tick(t) {
    const dt = Math.min(0.032, Math.max(0, (t - last) / 1000));
    last = t;
    let moving = false;

    R.nodes.forEach((n) => {
      if (t < n.release) { moving = true; return; }
      const p = n.p;
      p.vx += (K * (n.t.x - p.x) - DAMP * p.vx) * dt;
      p.vy += (K * (n.t.y - p.y) - DAMP * p.vy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.o += (n.t.o - p.o) * (1 - Math.exp(-dt * (n.t.o > p.o ? 5 : 9)));
      if (Math.abs(n.t.x - p.x) + Math.abs(n.t.y - p.y) > 0.2 || Math.abs(p.vx) + Math.abs(p.vy) > 0.2 || Math.abs(n.t.o - p.o) > 0.01) moving = true;

      const m = n.m, g = pullTarget(n);
      m.vx += (PULL.k * (g.x - m.x) - PULL.damp * m.vx) * dt;
      m.vy += (PULL.k * (g.y - m.y) - PULL.damp * m.vy) * dt;
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.abs(g.x - m.x) + Math.abs(g.y - m.y) > 0.05 || Math.abs(m.vx) + Math.abs(m.vy) > 0.05) moving = true;
    });
    if (state.cursor) moving = true;   // keep listening while the cursor is on the map

    const CK = 40, CD = 2 * Math.sqrt(CK);
    cam.vx += (CK * (cam.tx - cam.x) - CD * cam.vx) * dt;
    cam.vy += (CK * (cam.ty - cam.y) - CD * cam.vy) * dt;
    cam.x += cam.vx * dt; cam.y += cam.vy * dt;
    if (Math.abs(cam.tx - cam.x) + Math.abs(cam.ty - cam.y) > 0.2) moving = true;

    driftT = t;
    // on the summary the web never quite stops; elsewhere it rests, to cost nothing
    if (!reduceMotion && !consulting && !aux && !document.hidden) moving = true;
    draw();
    if (moving) requestAnimationFrame(tick);
    else running = false;
  }

  /* ---------------- drawing ---------------- */

  // ra, rb: how far from each shape's centre the line stops, so it never touches the shapes
  function elbow(a, b, ra = 0, rb = 0) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const j = Math.min(Math.abs(b.x - a.x) * 0.14, 16) * Math.sign(b.x - a.x || 1);
    const p1 = { x: mx - j, y: my }, p2 = { x: mx + j, y: my };
    const trim = (from, to, r) => { const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy); const k = d > r * 1.4 ? r / d : 0; return { x: from.x + dx * k, y: from.y + dy * k }; };
    const s0 = trim(a, p1, ra), e0 = trim(b, p2, rb);
    return `M${s0.x},${s0.y} L${p1.x},${p1.y} L${p2.x},${p2.y} L${e0.x},${e0.y}`;
  }
  const gap = (n) => half(n) + (isPhone() ? 2 : 1);   // the line ends where the shape begins, so each branch visibly meets its node

  function draw() {
    let out = "";
    // in an item view only its own path is drawn solid; everything else it relates to is dotted
    const c = state.current && byId.get(state.current);
    const path = c && c.kind === "item" ? new Set([c.id, c.parent]) : null;
    R.nodes.forEach((n) => {
      if (!n.parent || n.p.o <= 0.01 || n.t.o === 0) return;   // a leaving node loses its line at once
      if (path && !path.has(n.id) && n.t.o > 0) return;
      const p = byId.get(n.parent);
      if (p.p.o <= 0.01) return;
      out += `<path class="${n.mark === "missing" ? "dashed" : ""}" style="opacity:${Math.min(n.p.o, p.p.o)}" d="${elbow(at(p), at(n), gap(p), gap(n))}"/>`;
    });
    if (c) {
      related.get(c.id).forEach((id) => {
        const t = byId.get(id);
        if (t.p.o <= 0.01 || c.parent === id || (c.kind === "section" && t.parent === c.id)) return;
        const a = at(c), b = at(t);
        out += `<path class="related" style="opacity:${t.p.o}" d="M${a.x},${a.y} L${b.x},${b.y}"/>`;
      });
    }
    svg.innerHTML = out;
    R.nodes.forEach((n) => {
      const q = at(n);
      n.el.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -${half(n)}px)`;
      n.el.style.opacity = n.p.o;
      n.el.style.visibility = n.p.o <= 0.01 ? "hidden" : "visible";
    });
    world.style.transform = `translate(${cam.x + state.pan.x}px, ${cam.y + state.pan.y}px)${mapScale !== 1 ? ` scale(${mapScale})` : ""}`;
  }

  /* ---------------- navigation ---------------- */

  const back = (n) => (n && n.parent && n.parent !== "camille" ? n.parent : null);

  // A click, on the map or in the index, moves the map. The index stays as it is: no detail card.
  function go(id) {
    const hash = id ? `#${id}` : "";
    if (location.hash !== hash) history.pushState(null, "", hash || location.pathname + location.search);   // keeps ?demo / ?fresh in the address
    select(id);
  }

  // Her details open at the top of the index; her photo slides in behind the index, like the reference's images
  function setProfile(on) {
    if (!on) setPortraitView(false);
    state.profile = on;
    byId.get("camille").el.classList.toggle("is-profile", on);
    $("#portrait").classList.toggle("is-in", on);
    if (on) setIndexOpen(true);
    renderIndexState();
    const rowEl = indexBody.querySelector('.row[data-id="coverage"]');
    if (rowEl) {
      rowEl.setAttribute("aria-expanded", on);
      rowEl.classList.toggle("is-current", on);
      document.getElementById("detail-coverage").hidden = !on;
      if (on) rowEl.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
    }
    apply();
  }

  function select(id, instant = false) {
    if (id && !byId.has(id)) id = null;
    if (id && state.profile) { setPortraitView(false); state.profile = false; byId.get("camille").el.classList.remove("is-profile"); $("#portrait").classList.remove("is-in"); }
    state.current = id;
    if (id) state.visited.add(id);
    renderIndexState();
    renderMedia();
    renderBody();
    relink();
    apply(instant);
  }

  const PAGE_HASH = ["#consultation", "#follow-up", "#documents"];
  window.addEventListener("popstate", () => { if (!PAGE_HASH.includes(location.hash)) select(location.hash.slice(1) || null); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.current) go(back(byId.get(state.current)));   // one step back
  });

  /* drag to look around; the next selection brings the camera back */
  let drag = null;
  map.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".node")) return;
    drag = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y, moved: false };
    map.setPointerCapture(e.pointerId);
  });
  map.addEventListener("pointermove", (e) => {
    if (!reduceMotion) {
      const m = map.getBoundingClientRect();
      state.cursor = { x: e.clientX - m.left, y: e.clientY - m.top };
      kick();
    }
    if (!drag) return;
    state.pan = { x: e.clientX - drag.x, y: e.clientY - drag.y };
    if (Math.abs(state.pan.x) + Math.abs(state.pan.y) > 3) { drag.moved = true; map.classList.add("dragging"); }
    draw();
  });
  map.addEventListener("pointerleave", () => { state.cursor = null; kick(); });
  map.addEventListener("pointerup", () => {
    if (drag && !drag.moved && state.current) go(null);   // a click on the empty map goes back to the overview
    else if (drag && !drag.moved && state.profile) setProfile(false);   // or folds her profile away
    drag = null; map.classList.remove("dragging");
  });

  window.addEventListener("resize", () => apply(true));

  /* ---------------- index ---------------- */

  const groups = [
    ...sections.map((s) => ({ key: s.id, name: s.label, icon: `<i class="ico section" style="${s.mark ? `background:var(--${s.mark})` : ""}"></i>`, items: kids(s.id) })),
    { key: "sources", name: "Details and sources", icon: `<i class="ico document"></i>`, items: orphans },
  ];

  /* Each section of the index has its own shape, because each kind of information reads best its own way:
     points as a list with icons, her words as a quote, pain on a body, events on a timeline,
     missing things as a checklist, sources as documents. */

  const icon = (name) => `<svg class="i" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  const row = (n, lead, title = n.label, sub = n.sub) => `
    <button class="row ${n.mark ? `mark-${n.mark}` : ""}" data-id="${n.id}">
      <span class="lead">${lead || ""}</span>
      <span class="r-text"><span class="r-title"><span>${title}</span></span><span class="r-sub">${sub || ""}</span></span>
    </button>`;

  // a point to know: its name, the record's own words, then where it comes from
  const knowLine = (n) => (n.quote && n.quote !== n.label ? `“${n.quote}”` : n.title && n.title !== n.label ? n.title : "");
  const rowKnow = (n) => `
    <button class="row mark-know" data-id="${n.id}">
      <span class="lead">${icon(n.icon)}</span>
      <span class="r-text"><span class="r-title"><span>${n.label}</span></span>${knowLine(n) ? `<span class="r-quote">${knowLine(n)}</span>` : ""}<span class="r-sub">${n.sub || ""}</span></span>
    </button>`;

  const bodyFor = {

    know: (items) => {
      const points = items.filter((n) => n.id !== "treatments");
      const treat = items.find((n) => n.id === "treatments");
      return `
        ${points.map((n) => rowKnow(n)).join("")}
        ${treat ? rowKnow(treat) : ""}
        <p class="sub-head">Documents</p>
        ${R.knowDocs.map((d) => `
          <button class="row is-doc" data-id="${d.opens}" data-doc>
            <span class="lead">${icon("file-text")}</span>
            <span class="r-text"><span class="r-title">${d.title}</span><span class="r-sub">${d.sub}</span></span>
          </button>`).join("")}`;
    },

    wants: (items) => {
      const [quote, ...rest] = items;
      return `
        <button class="row plain-quote" data-id="${quote.id}">
          <span class="r-text"><span class="r-title">${quote.title}</span></span>
        </button>
        <p class="sub-head">She also expects</p>
        ${rest.map((n) => row(n, icon(n.icon), n.label, "")).join("")}`;
    },

    // listed from head to feet, as on her body: wrist, knee, then mid-foot
    hurts: (items) => `
      <div class="body-map">
        <div class="figure" id="figure">
          <svg class="markers" viewBox="0 -10 201 471" aria-hidden="true">
            ${items.map((n) => `<g class="marker tone-${n.tone}" data-for="${n.id}" transform="translate(${n.spot[0]} ${n.spot[1]})">
              <circle class="halo" r="13"/><circle class="core" r="6"/></g>`).join("")}
          </svg>
        </div>
        <div class="body-list">${items.slice().sort((a, b) => a.spot[1] - b.spot[1]).map((n) => row(n, `<i class="pain-dot tone-${n.tone}"></i>`, n.label, n.explain || n.quote)).join("")}</div>
      </div>`,

    happened: (items) => {
      const steps = [...items];
      steps.splice(steps.findIndex((n) => n.id === "today"), 0, { prepared: true });
      return `<ol class="timeline">${steps.map((n) => n.prepared
        ? `<li class="step is-passive"><span class="dot"></span><span class="when">${R.prepared.when}</span><span class="what">${R.prepared.event}</span></li>`
        : `<li class="step ${n.id === "today" ? "is-today" : ""}">
            <button class="row" data-id="${n.id}"><span class="dot"></span>
              <span class="when">${n.when}</span><span class="what">${n.event}</span></button></li>`).join("")}</ol>`;
    },

    complete: (items) => items.map((n) => row(n, `<i class="check"></i>`)).join(""),

    // each source unfolds in place: the few lines the record holds about it
    sources: (items) => items.map((n) => `
      <div class="source">
        ${row(n, icon(n.icon)).replace('class="row', 'class="row has-detail').replace("<button", `<button aria-expanded="false" aria-controls="detail-${n.id}"`)}
        <div class="source-detail" id="detail-${n.id}" hidden>
          ${n.title && n.title !== n.type && n.title !== n.label && !n.list ? `<p class="sd-line">${n.title}</p>` : ""}
          ${n.list ? `<ul class="sd-list">${n.list.map((x) => `<li>${x}</li>`).join("")}</ul>` : ""}
          ${n.facts ? `<dl class="sd-facts">${n.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>` : ""}
        </div>
      </div>`).join(""),
  };

  function buildIndex() {
    indexBody.innerHTML = groups.map((g) => `
      <div class="sec sec-${g.key}">
        <button class="sec-head" aria-expanded="false" aria-controls="sec-${g.key}">
          ${g.icon}<span class="sec-name">${g.name}</span><span class="chev" aria-hidden="true"></span>
        </button>
        <div class="sec-list" id="sec-${g.key}" hidden>${bodyFor[g.key](g.items)}</div>
      </div>`).join("");

    // a filled body in soft grey; the pain points sit on top of it
    fetch("../../design/illustrations/body-female.svg").then((r) => r.text()).then((svgText) => {
      const fig = document.getElementById("figure");
      if (fig) fig.insertAdjacentHTML("afterbegin", svgText.replace("<svg", '<svg class="silhouette" aria-hidden="true"'));
    });

    indexBody.querySelectorAll(".sec-head").forEach((b) => b.addEventListener("click", () => {
      const open = b.getAttribute("aria-expanded") !== "true";
      b.setAttribute("aria-expanded", open);
      document.getElementById(b.getAttribute("aria-controls")).hidden = !open;
    }));
    indexBody.querySelectorAll(".row.has-detail").forEach((r) => r.addEventListener("click", () => {
      if (r.dataset.id === "coverage") return;   // handled below: her details and photo
      const open = r.getAttribute("aria-expanded") !== "true";
      r.setAttribute("aria-expanded", open);
      document.getElementById(r.getAttribute("aria-controls")).hidden = !open;
    }));
    indexBody.querySelectorAll(".row").forEach((r) => {
      r.addEventListener("click", () => {
        if (r.dataset.id !== "coverage") return go(r.dataset.id);
        const open = !state.profile;
        if (state.current) go(null);
        setProfile(open);
      });
      r.addEventListener("mouseenter", () => hint(r.dataset.id, true));
      r.addEventListener("mouseleave", () => hint(r.dataset.id, false));
    });
    indexBody.querySelectorAll(".marker").forEach((m) => {
      m.addEventListener("click", () => go(m.dataset.for));
      m.addEventListener("mouseenter", () => hint(m.dataset.for, true));
      m.addEventListener("mouseleave", () => hint(m.dataset.for, false));
    });
  }

  // hovering a row, a body marker or a node lights up the same thing in the other places
  function hint(id, on) {
    hintNode(id, on);
    hintRow(id, on);
  }

  function renderIndexState() {
    indexBody.querySelectorAll(".marker").forEach((m) => m.classList.toggle("is-current", m.dataset.for === state.current));
    indexBody.querySelectorAll(".row:not([data-doc])").forEach((r) => {
      r.classList.toggle("is-current", r.dataset.id === state.current);
      r.classList.toggle("visited", state.visited.has(r.dataset.id) && r.dataset.id !== state.current);
    });
    // the section you are in on the map is the one unfolded in the index
    const c = state.current && byId.get(state.current);
    const key = !c ? (state.profile ? "sources" : "know") : c.kind === "section" ? c.id : c.parent || "sources";   // the overview opens on what to know
    indexBody.querySelectorAll(".sec-head").forEach((b) => {
      const open = b.getAttribute("aria-controls") === `sec-${key}`;
      b.setAttribute("aria-expanded", open);
      b.classList.toggle("is-current", open);
      document.getElementById(b.getAttribute("aria-controls")).hidden = !open;
    });
    // clicking a point shows what the record says about it, under its row in the index
    indexBody.querySelectorAll(".row-detail").forEach((d) => d.remove());
    if (c && c.kind === "item" && c.parent !== undefined) {
      const r = indexBody.querySelector(`.row[data-id="${c.id}"]:not([data-doc]):not(.has-detail)`);
      const lines = [];
      if (c.title && c.title !== c.label && c.title !== knowLine(c)) lines.push(`<p class="rd-line">${c.title}</p>`);
      if (c.quote && c.quote !== c.label && c.parent !== "know") lines.push(`<p class="rd-quote">“${c.quote}”</p>`);
      if (c.facts) lines.push(`<dl class="sd-facts">${c.facts.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`);
      if (r && lines.length) {
        const d = document.createElement("div");
        d.className = "row-detail";
        d.innerHTML = lines.join("");
        (r.closest(".step") || r).after(d);
        requestAnimationFrame(() => d.classList.add("is-in"));
        r.scrollIntoView({ block: "nearest", behavior: reduceMotion ? "auto" : "smooth" });
      }
    }
  }

  function setIndexOpen(open) {
    indexToggle.setAttribute("aria-expanded", open);
    indexBody.hidden = !open;
  }
  indexToggle.addEventListener("click", () => setIndexOpen(indexBody.hidden));

  function hintNode(id, on) { byId.get(id).el.classList.toggle("is-hint", on); }
  function hintRow(id, on) {
    indexBody.querySelectorAll(`.row[data-id="${id}"]:not([data-doc]), .marker[data-for="${id}"]`).forEach((r) => r.classList.toggle("is-hover", on));
    hurtBody.querySelectorAll(`[data-for="${id}"]`).forEach((r) => r.classList.toggle("is-hover", on));
  }

  /* ---------------- media: a pile of prints ---------------- */

  // Like the reference: when a record has images, they arrive as overlapping prints beside the network,
  // one after another, and leave when you move on. Hover or click brings a print to the front.
  const media = $("#media");
  // the room the prints take on the right: a loose pile of films, or a tight stack of paper pages
  const isPhone = () => matchMedia("(max-width: 760px)").matches;
  const mediaWidth = (n) => (isPhone() || !n ? 0 : inHurts(n) ? 320 : n.media ? (n.media.fan ? 340 : n.media.kind === "paper" ? 230 : 310) : 0);
  const mediaShown = () => !!(state.current && byId.get(state.current).media);
  let mediaTimer = null;

  // papers fanned out of a folder: a soft arc, each a little further and a little more turned
  function fanSpot(i, count) {
    const mid = (count - 1) / 2, d = i - mid;
    return `--x:${8 + i * 46}px;--y:${Math.abs(d) * 10 + 4}px;--r:${d * 5}deg;`;
  }
  // a page for a file you dropped in: its name and where it came from (the file itself opens from the caption)
  function drawnPage(p) {
    return `<span class="drawn-page">
      <span class="dp-type">${p.type}</span>
      <span class="dp-title">${p.title}</span>
      <span class="dp-from">${p.from}</span>
      <span class="dp-lines">${"<i></i>".repeat(p.lines)}</span>
    </span>`;
  }

  /* Where it hurts: on desktop her body appears large beside the network, on its own (it is not part of the web).
     Each pain point sits on the body, with what she said about it to the left; a click on one selects it. */
  function inHurts(n) { return !!n && (n.id === "hurts" || n.parent === "hurts"); }
  const hurtBody = $("#hurt-body");
  let hurtSvg = null;
  fetch("../../design/illustrations/body-female.svg").then((r) => r.text()).then((t) => { hurtSvg = t; renderBody(); });
  function renderBody() {
    const n = state.current && byId.get(state.current);
    clearTimeout(hurtBody._t);
    if (isPhone() || !inHurts(n) || !hurtSvg) {
      hurtBody.classList.remove("is-in");
      hurtBody._t = setTimeout(() => { if (!hurtBody.classList.contains("is-in")) hurtBody.hidden = true; }, 450);
      return;
    }
    if (!hurtBody.firstElementChild) {
      const items = kids("hurts");
      const pct = (n) => `left:${(n.spot[0] / 201) * 100}%;top:${((n.spot[1] + 10) / 471) * 100}%`;
      const dl = (n) => `--d:${(0.18 + (1 - (n.spot[1] + 10) / 471) * 0.55).toFixed(2)}s`;   // the body rises from the feet: lower points come first
      hurtBody.innerHTML = `<div class="hb-fig">
        ${hurtSvg.replace("<svg", '<svg class="hb-sil" aria-hidden="true"')}
        ${items.map((k) => `<button type="button" class="hb-spot marker tone-${k.tone}" data-for="${k.id}" style="${pct(k)};${dl(k)}" aria-label="${k.label}" title="${k.label}"><i class="halo"></i><i class="core"></i></button>`).join("")}
      </div>`;
      hurtBody.querySelectorAll("[data-for]").forEach((b) => {
        b.addEventListener("mouseenter", () => hintRow(b.dataset.for, true));
        b.addEventListener("mouseleave", () => hintRow(b.dataset.for, false));
      });
      hurtBody.querySelectorAll("[data-for]").forEach((b) => b.addEventListener("click", () => go(b.dataset.for)));
    }
    hurtBody.querySelectorAll("[data-for]").forEach((b) => b.classList.toggle("is-current", b.dataset.for === state.current));
    hurtBody.style.top = `${$(".brief").getBoundingClientRect().bottom - 6}px`;   // sits high, close under the header
    hurtBody.hidden = false;
    void hurtBody.offsetWidth;   // start from the hidden state, then fade in
    hurtBody.classList.add("is-in");
  }

  /* the chosen point on the body and its row in the index, tied by one soft line (it draws itself out each time) */
  const hbLink = $("#hb-link");
  let linkFor = null;
  function linkRow() {
    const id = state.current, n = id && byId.get(id);
    const dot = n && n.parent === "hurts" && !hurtBody.hidden && hurtBody.querySelector(`.hb-spot[data-for="${id}"] .core`);
    const row = dot && indexBody.querySelector(`.body-list .row[data-id="${id}"] .pain-dot`);
    const panel = indexBody.getBoundingClientRect();
    const r = row && row.getBoundingClientRect();
    if (!dot || !r || !r.width || r.top < panel.top - 4 || r.bottom > panel.bottom + 4) { hbLink.classList.remove("is-on"); linkFor = null; return; }
    const d = dot.getBoundingClientRect();
    const a = { x: d.right + 6, y: d.top + d.height / 2 }, b = { x: r.left - 7, y: r.top + r.height / 2 };
    const dx = b.x - a.x;
    hbLink.querySelector("path").setAttribute("d", `M${a.x},${a.y} C${a.x + dx * 0.5},${a.y} ${b.x - dx * 0.5},${b.y} ${b.x},${b.y}`);
    const c = hbLink.querySelector("circle.to"); c.setAttribute("cx", b.x); c.setAttribute("cy", b.y);
    const f = hbLink.querySelector("circle.from"); f.setAttribute("cx", a.x); f.setAttribute("cy", a.y);   // like the assessment web: a dot at each end
    if (linkFor !== id) {   // a new point: the line draws out from the body to the index
      hbLink.classList.remove("is-on"); void hbLink.getBoundingClientRect(); linkFor = id;
    }
    hbLink.classList.add("is-on");
  }
  const relink = () => { linkRow(); setTimeout(linkRow, 380); setTimeout(linkRow, 900); };   // again once the body and the row have settled
  addEventListener("resize", linkRow);
  addEventListener("scroll", linkRow, true);

  function renderMedia() {
    const n = state.current && byId.get(state.current);
    clearTimeout(mediaTimer);
    if (viewing) setViewing(false);
    if (!n || !n.media) {
      media.classList.remove("is-in");
      mediaTimer = setTimeout(() => { media.hidden = true; media.innerHTML = ""; }, 350);
      return;
    }
    const M = n.media;
    const quote = M.quote ? `<span class="cap-quote">“${M.quote}”</span>` : "";
    const open = M.file ? `<a class="open-file" href="${M.file.href}" target="_blank" rel="noopener">${M.file.label} ↗</a>` : "";
    media.dataset.kind = M.kind || "film";
    media.classList.toggle("from-folder", !!M.fan);
    media.innerHTML = `
      <div class="prints ${M.fan ? "is-fan" : ""}">${M.images.map((im, i) => `
        <button class="print p${i}" style="--i:${i};${M.fan ? fanSpot(i, M.images.length) : ""}" type="button" aria-label="${im.alt || im.name || (im.page && im.page.title) || "Document"}">${
          im.src ? `<img src="${im.src}" alt="">`
          : im.page ? drawnPage(im.page)
          : `<span class="blank-page"><svg class="i"><use href="#i-file-text"/></svg><span>${im.name}</span></span>`}</button>`).join("")}
      </div>
      <figcaption><span class="cap">${M.caption}</span>${quote}</figcaption>
      <p class="view-cap"><span class="cap">${M.caption}</span>${quote}<span class="view-hint">${open}${open ? " · " : ""}click anywhere to put ${M.images.length > 1 ? "them" : "it"} back</span></p>`;
    const link = media.querySelector(".open-file");
    if (link) link.addEventListener("click", (e) => e.stopPropagation());
    media.hidden = false;
    media.style.top = `${$(".brief").getBoundingClientRect().bottom + 28}px`;   // always below the header
    media.querySelectorAll(".print").forEach((p) => p.addEventListener("click", () => setViewing(!viewing)));
    requestAnimationFrame(() => requestAnimationFrame(() => media.classList.add("is-in")));
  }

  /* Viewing: the prints glide to the middle of the screen, side by side and upright, while the network,
     the index and the header fade away. Click anything, or press Esc, and they go back to the pile. */
  let viewing = false;
  const veil = $("#veil");

  function setViewing(on) {
    const prints = [...media.querySelectorAll(".print")];
    if (!prints.length) return;
    viewing = on;
    document.body.classList.toggle("is-viewing", on);
    if (!on) { prints.forEach((p) => p.style.transform = ""); return; }

    // where the prints are now (their untransformed origin) and where they should go
    const base = media.querySelector(".prints").getBoundingClientRect();
    const left = $("#rail").getBoundingClientRect().right;
    const areaW = innerWidth - left, areaH = innerHeight;
    const gap = prints.length > 2 ? 22 : 36;
    const ratios = prints.map((p) => { const img = p.querySelector("img"); return (img && img.naturalWidth / img.naturalHeight) || 0.707; });
    const fitW = (areaW * 0.9 - gap * (prints.length - 1)) / ratios.reduce((a, b) => a + b, 0);
    const H = Math.min(areaH * 0.72, 680, fitW);   // as large as fits, side by side
    const sizes = ratios.map((ratio) => ({ w: H * ratio, h: H }));
    const total = sizes.reduce((t, z) => t + z.w, 0) + gap * (sizes.length - 1);
    let x = left + (areaW - total) / 2;
    const y = (areaH - H) / 2 - 18;
    prints.forEach((p, i) => {
      const scale = sizes[i].w / p.offsetWidth;
      p.style.transform = `translate(${x - base.left}px, ${y - base.top}px) scale(${scale})`;
      x += sizes[i].w + gap;
    });
  }
  veil.addEventListener("click", () => { setViewing(false); setPortraitView(false); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && (viewing || portraitView)) { e.stopImmediatePropagation(); setViewing(false); setPortraitView(false); }
  }, true);

  /* Her photo works like the X-rays: click it and it glides to the middle, upright and large, while everything
     else fades; click anywhere (or Esc) and it goes back behind the index. */
  const portrait = $("#portrait");
  let portraitView = false;
  function setPortraitView(on) {
    if (on === portraitView) return;
    portraitView = on;
    document.body.classList.toggle("is-viewing", on);
    portrait.classList.toggle("is-viewing", on);
    if (!on) { portrait.style.transform = ""; return; }
    const left = $("#rail").getBoundingClientRect().right;
    const H = Math.min(innerHeight * 0.72, 680), W = H * 0.8;
    const x = left + (innerWidth - left - W) / 2, y = (innerHeight - H) / 2 - 18;
    portrait.style.transform = `translate(${x - portrait.offsetLeft}px, ${y - portrait.offsetTop}px) scale(${W / portrait.offsetWidth})`;
  }
  portrait.addEventListener("click", () => setPortraitView(!portraitView));
  window.addEventListener("resize", () => { if (portraitView) { portraitView = false; setPortraitView(true); } });
  window.addEventListener("resize", () => { if (viewing) setViewing(true); });

  /* ---------------- attach: drop a file onto the record ---------------- */

  // Drag a file from your computer over the page: a paper print follows the cursor and the nearest
  // point of the record lights up. Drop it, and it attaches there as a document on a dotted line,
  // then opens as prints. The file stays in this browser tab only: nothing is uploaded.
  const ghost = $("#ghost");
  let dropTarget = null, dragDepth = 0;
  const hasFiles = (e) => [...(e.dataTransfer && e.dataTransfer.types || [])].includes("Files");

  function nearestNode(x, y) {
    let best = null, bestD = 120;
    R.nodes.forEach((n) => {
      if (n.p.o < 0.5 || n.kind === "person") return;
      const r = n.el.querySelector(".shape").getBoundingClientRect();
      const d = Math.hypot(r.left + r.width / 2 - x, r.top + r.height / 2 - y);
      if (d < bestD) { best = n; bestD = d; }
    });
    return best;
  }
  function setDropTarget(n) {
    if (dropTarget === n) return;
    if (dropTarget) dropTarget.el.classList.remove("is-drop-target");
    dropTarget = n;
    if (n) n.el.classList.add("is-drop-target");
    $("#drop-hint").textContent = n ? `Attach to “${n.label}”` : "Drop it on a point of the record";
  }
  function endDrag() {
    dragDepth = 0; setDropTarget(null);
    document.body.classList.remove("is-dropping");
  }

  window.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth++; document.body.classList.add("is-dropping"); });
  window.addEventListener("dragleave", () => { if (--dragDepth <= 0) endDrag(); });
  window.addEventListener("dragover", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px) rotate(-5deg)`;
    setDropTarget(nearestNode(e.clientX, e.clientY));
  });
  window.addEventListener("drop", (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    const target = dropTarget, file = e.dataTransfer.files[0];
    endDrag();
    if (target && file) attach(file, target);
  });

  function attach(file, target) {
    const url = URL.createObjectURL(file);
    const isImage = file.type.startsWith("image/");
    const name = file.name.length > 34 ? file.name.slice(0, 31) + "…" : file.name;
    const n = {
      id: `attached-${Date.now()}`, kind: "item", source: "document", icon: "file-text", attached: true,
      label: name, sub: "Attached just now", type: "Document", links: [target.id],
      media: {
        kind: isImage ? "film" : "paper",
        caption: `${name} · attached just now to ${target.label}`,
        file: { href: url, label: "Open the file" },
        images: [isImage ? { src: url, alt: name } : { name }],
      },
    };
    R.nodes.push(n);
    byId.set(n.id, n);
    related.set(n.id, new Set([target.id]));
    related.get(target.id).add(n.id);
    makeNode(n);
    n.el.classList.add("is-new");
    if (target.folder) {   // a file dropped on the folder goes inside it
      target.media.images.push(isImage ? { src: url, alt: name } : { page: { type: "Attached just now", title: name, from: "Dropped in by you", lines: 6 } });
      target.label = target.label.replace(/\d+$/, target.media.images.length);
      target.el.querySelector(".title").textContent = target.label;
    }
    // and in the index, under Details and sources
    const list = document.getElementById("sec-sources");
    list.insertAdjacentHTML("beforeend", row(n, icon("file-text")));
    const rowEl = list.lastElementChild;
    rowEl.addEventListener("click", () => go(n.id));
    rowEl.addEventListener("mouseenter", () => hint(n.id, true));
    rowEl.addEventListener("mouseleave", () => hint(n.id, false));
    go(n.id);
  }

  /* ---------------- photos ---------------- */

  // The real photos stay on this Mac (not in git). Wherever one is missing, as on the public link,
  // a circle with initials takes its place instead of a broken image.
  function photoFallback(img) {
    const holder = img.parentElement;
    const initials = img.dataset.initials || "";
    holder.classList.add("no-photo");
    holder.insertAdjacentHTML("beforeend", `<span class="initials" aria-hidden="true">${initials}</span>`);
    img.remove();
  }
  document.querySelectorAll("img[data-initials]").forEach((img) => {
    if (img.complete && img.naturalWidth === 0) photoFallback(img);
    else img.addEventListener("error", () => photoFallback(img), { once: true });
  });

  /* ---------------- rail ---------------- */

  // The left menu folds to icons. The choice is remembered on this browser only.
  const railToggle = $("#rail-toggle");
  function setRail(collapsed) {
    document.body.classList.toggle("rail-collapsed", collapsed);
    railToggle.setAttribute("aria-expanded", !collapsed);
    railToggle.title = collapsed ? "Open the menu" : "Collapse the menu";
    try { localStorage.setItem("apiona-rail", collapsed ? "collapsed" : "open"); } catch (e) {}
  }
  railToggle.addEventListener("click", () => setRail(!document.body.classList.contains("rail-collapsed")));
  // once the map has finished resizing, the network glides back to the middle of the new space
  map.addEventListener("transitionend", (e) => { if (e.propertyName === "left") apply(); });
  try { if (localStorage.getItem("apiona-rail") === "collapsed") setRail(true); } catch (e) {}

  /* ---------------- consultation ---------------- */

  /* Start consultation: the summary and the network step aside and the consultation slides in, in the
     same place. The menu and the index stay: during the visit the index is the patient summary beside
     the notes. "← Summary", the menu, or the browser's back button return to the summary. */
  const consult = $("#consult");
  const startBtn = $(".start");
  const C = R.consultation;
  let consulting = false, clockTimer = null, startedAt = 0, hideTimer = null;

  function buildConsult() {
    const notesStep = C.steps.find((x) => x.id === "notes");
    const today = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
    $("#c-notes").innerHTML = `
      <p class="c-notes-date"><span class="tag tag-session">${today} · session 1</span></p>
      <button type="button" class="c-notes-handle" aria-expanded="false"><b>Notes</b><span class="c-notes-count">tap to write</span><span class="c-notes-done">Done</span></button>
      <ol class="jots" aria-label="Notes"></ol>
      <div class="dict-list" data-key="notes"></div>
      <textarea class="jot-input" rows="1" aria-label="Write a note" placeholder="Write a note…"></textarea>
      <textarea data-sec="notes" hidden aria-hidden="true">${notesStep.text || ""}</textarea>`;
    wireJots();
    const handle = $("#c-notes .c-notes-handle");
    // phone: the notes slide up as a sheet; Done, a tap on the dimmed page, or Esc puts them away
    const setNotes = (on) => {
      $("#c-notes").classList.toggle("is-open", on); handle.setAttribute("aria-expanded", on);
      document.body.classList.toggle("m-notes", on);   // the open sheet hides the green button behind it
      if (!on && document.activeElement && document.activeElement.closest("#c-notes")) document.activeElement.blur();
    };
    handle.addEventListener("click", () => setNotes(!$("#c-notes").classList.contains("is-open")));
    consult.appendChild($("#m-notes-scrim"));   // same layer as the sheet: it dims the page, not the notes
    $("#m-notes-scrim").addEventListener("click", () => setNotes(false));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("m-notes")) setNotes(false); });
    $("#c-sections").innerHTML = C.steps.filter((st) => st.id !== "notes").map((st, i) => `
      <article class="c-sec reveal ${i === 0 ? "is-open" : ""}" style="--d:${3 + i}" id="cs-${st.id}">
        <button class="c-sec-head" type="button" aria-expanded="${i === 0}">
          <span class="c-n c-dot" data-sec="${st.id}"><span class="sr">${i + 1}</span></span><span class="c-sec-title">${st.label}</span>
          <span class="chev" aria-hidden="true"></span>
        </button>
        <div class="c-sec-body"><div class="c-sec-inner">${st.fields ? `<div class="fields" data-fields="${st.id}">${st.fields.map((f, k) => `
            <div class="fld-row"><label class="fld-label" for="f-${st.id}-${k}">${f}</label>
              <textarea class="fld" id="f-${st.id}-${k}" rows="1" data-k="${k}" placeholder="Write, or dictate…"></textarea></div>`).join("")}</div>
            <textarea data-sec="${st.id}" hidden aria-hidden="true"></textarea><div class="dict-list" data-key="${st.id}"></div>`
          : st.id === "reason" ? `<div class="rh" id="rh"></div><textarea data-sec="reason" hidden aria-hidden="true"></textarea>`
          : st.id === "assessment" ? `<div class="assess" id="assess"></div>`
          : st.id === "goals" ? `<div class="goals" id="goals"></div>`
          : `<textarea class="c-grow" rows="3" aria-label="${st.label}" data-sec="${st.id}" placeholder="Write here, or dictate…">${st.text || ""}</textarea>
             <div class="dict-list" data-key="${st.id}"></div>`}</div></div>
      </article>`).join("");

    buildReason();
    buildFields();
    buildAssessment();
    buildGoals();
    buildAsk();
    const open = (sec, on) => {
      sec.classList.toggle("is-open", on);
      // while it unfolds, the content is clipped to the growing height; once open, it may overflow again
      clearTimeout(sec._settle); sec.classList.remove("is-settled");
      if (on) sec._settle = setTimeout(() => sec.classList.add("is-settled"), reduceMotion ? 0 : 520);
      sec.querySelector(".c-sec-head").setAttribute("aria-expanded", on);
      const chip = consult.querySelector(`.c-step[data-step="${sec.id.slice(3)}"]`);
      if (chip) chip.classList.toggle("is-open", on);
      if (on && sec.id === "cs-assessment") { requestAnimationFrame(sizePills); setTimeout(sizePills, 560); }   // again once it has unfolded
      if (on) requestAnimationFrame(() => sec.querySelectorAll(".goal textarea, textarea.c-grow").forEach((f) => { f.style.height = "auto"; if (f.scrollHeight) f.style.height = f.scrollHeight + "px"; }));
    };
    consult.querySelectorAll(".c-sec.is-open").forEach((sec) => open(sec, true));
    consult.querySelectorAll(".c-sec-head").forEach((h) => h.addEventListener("click", () => open(h.parentElement, !h.parentElement.classList.contains("is-open"))));
    consult.querySelectorAll(".c-step").forEach((b) => b.addEventListener("click", () => {
      const sec = document.getElementById(`cs-${b.dataset.step}`);
      open(sec, true);
      sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }));
    // the section texts grow with what is written: no inner scrollbar
    consult.querySelectorAll("textarea.c-grow").forEach((f) => f.addEventListener("input", () => { f.style.height = "auto"; f.style.height = f.scrollHeight + "px"; }));
    // the header condenses once you scroll (a little slack both ways, so it doesn't flicker at the edge)
    consult.addEventListener("scroll", () => {
      if (isPhone()) { consult.classList.remove("is-stuck"); return; }   // on a phone the header is always compact: nothing jumps
      const y = consult.scrollTop, stuck = consult.classList.contains("is-stuck");
      if (!stuck && y > 70) consult.classList.add("is-stuck");
      else if (stuck && y < 12) consult.classList.remove("is-stuck");
    }, { passive: true });
    // saving status: every change is saved a moment later, and says so
    const save = $("#c-save");
    let saveTimer = null;
    const markSaved = () => {
      saveConsult();
      const now = new Date();
      save.classList.remove("is-saving");
      if (C.signed) return;
      save.querySelector("span").textContent = `${C.changedAfterSign ? "Changed after signing · saved" : "All changes saved"} · ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    };
    const markChanged = () => {
      if (restoring) return;   // putting back what was saved is not a change
      C.begun = true;          // something was done: from now on the button says "Resume consultation"
      if (C.signed) { C.signed = null; C.changedAfterSign = true; applySigned(); }   // a change after signing needs a new signature
      save.classList.add("is-saving");
      save.querySelector("span").textContent = "Saving…";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(markSaved, 800);
    };
    consult.addEventListener("input", markChanged);
    consult.addEventListener("change", markChanged);
    consult.addEventListener("click", (e) => { if (e.target.closest(".seg button, .as-del, .as-add, .dict-ok, .dict-no, .dict-move, .rh-ok, .jot-del, .goal-keep")) markChanged(); });
    markSaved();
    // segmented choices: one on at a time
    consult.querySelectorAll(".seg").forEach((g) => g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      g.querySelectorAll("button").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
      g.querySelectorAll("button").forEach((x) => x.classList.toggle("is-ok", x === b && x.textContent.trim() === "Present"));
    })));
  }

  /* ---------- Ask during the session: the answer is added to the record, marked "Physio, in session" ---------- */
  function buildAsk() {
    const box = $("#c-ask");
    const askIcon = { allergies: "alert", doses: "pill" };
    box.innerHTML = `<p class="c-ask-head">Ask during the session</p>
      <div class="c-ask-list">${C.ask.map((q) => `
        <div class="ask" data-q="${q.id}">
          <span class="ask-label">${icon(askIcon[q.id] || "info")}${q.label}</span>
          ${q.answer ? `<span class="ask-answer">${q.answer}<span class="ask-by">Physio, in session</span></span>`
            : `<span class="ask-missing">Not in the record</span><button type="button" class="ask-add">Add the answer</button>`}
        </div>`).join("")}</div>`;
    box.querySelectorAll(".ask-add").forEach((b) => b.addEventListener("click", () => {
      const row = b.closest(".ask"), q = C.ask.find((x) => x.id === row.dataset.q);
      b.outerHTML = `<input class="ask-input" placeholder="Type the answer, then Enter" aria-label="${q.label}">`;
      const inp = row.querySelector(".ask-input");
      inp.focus();
      const save = () => { if (inp.value.trim()) { q.answer = inp.value.trim(); } buildAsk(); };
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { e.stopPropagation(); buildAsk(); } });
      inp.addEventListener("blur", save);
    }));
  }

  /* ---------- Goals and methods: each goal with its methods; some answer what she asked for ---------- */
  function buildGoals() {
    const box = $("#goals");
    box.innerHTML = `
      <div class="goal-head"><span>Goal</span><span>Methods</span></div>
      ${C.goals.map((g, i) => `
        <div class="goal${g.example ? " is-example" : ""}" data-i="${i}">
          <span class="goal-n">${i + 1}</span>
          <span class="goal-main"><textarea data-k="goal" rows="1" placeholder="Goal" aria-label="Goal ${i + 1}">${esc(g.goal)}</textarea>
            ${g.example ? `<span class="goal-ex">Example · <button type="button" class="goal-keep">Keep it</button></span>` : ""}</span>
          <textarea data-k="methods" rows="1" placeholder="Methods" aria-label="Methods for goal ${i + 1}">${esc(g.methods)}</textarea>
          <button class="as-del" type="button" aria-label="Remove this goal">×</button>
        </div>`).join("")}
      <button class="as-add" type="button">+ Add a goal and its methods</button>
      <div class="dict-list" data-key="goals"></div>`;
    box.querySelectorAll(".goal").forEach((row) => {
      const g = C.goals[+row.dataset.i];
      // the text wraps: each field grows to show all of it
      const fit = (f) => { f.style.height = "auto"; if (f.scrollHeight) f.style.height = f.scrollHeight + "px"; };
      row.querySelectorAll("[data-k]").forEach((f) => {
        f.addEventListener("input", () => { g[f.dataset.k] = f.value; if (g.example) { g.example = false; row.classList.remove("is-example"); row.querySelector(".goal-ex")?.remove(); } fit(f); });
        f.addEventListener("focus", () => fit(f));
        requestAnimationFrame(() => fit(f));
      });
      row.querySelector(".as-del").addEventListener("click", () => { C.goals.splice(+row.dataset.i, 1); buildGoals(); });
      row.querySelector(".goal-keep")?.addEventListener("click", () => { g.example = false; row.classList.remove("is-example"); row.querySelector(".goal-ex").remove(); });
    });
    box.querySelector(".as-add").addEventListener("click", () => {
      C.goals.push({ goal: "", methods: "" });
      buildGoals();
      const rows = box.querySelectorAll(".goal");
      rows[rows.length - 1].querySelector("textarea").focus();
    });
    renderDictated(box.querySelector(".dict-list"), "goals");
  }

  /* ---------- Dictation (simulated): sentences arrive where you are working and wait to be approved ---------- */
  const dict = {};            // where each dictated sentence waits: key → [text]
  let dictating = false, dictTimer = null, dictClock = null, dictStart = 0, dictNext = 0;

  function dictTarget() {
    const open = [...consult.querySelectorAll(".c-sec.is-open")].map((sec) => sec.id.slice(3));
    if (open.includes("assessment")) {
      const a = C.areas.find((x) => x.id === areaId);
      return { key: `assessment:${areaId}`, label: `Assessment › ${a.label}` };
    }
    const id = open.find((x) => x !== "reason") || "notes";   // notes are always there
    return { key: id, label: C.steps.find((x) => x.id === id).label };
  }

  function listFor(key) {
    if (key.startsWith("assessment:")) return key === `assessment:${areaId}` ? $("#as-work .dict-list") : null;
    return document.querySelector(`.dict-list[data-key="${key}"]`);
  }

  function renderDictated(el, key) {
    if (!el) return;
    el.innerHTML = (dict[key] || []).map((text, i) => `
      <div class="dictated" data-i="${i}">
        <span class="dict-text">${text}</span>
        <span class="dict-tag">Dictated · to approve</span>
        <button type="button" class="dict-ok">Approve</button>
        <button type="button" class="dict-move">Move to notes</button>
      </div>`).join("");
    el.querySelectorAll(".dictated").forEach((row) => {
      const i = +row.dataset.i;
      row.querySelector(".dict-ok").addEventListener("click", () => {
        const text = dict[key].splice(i, 1)[0];
        if (key.startsWith("assessment:")) {
          const a = C.areas.find((x) => `assessment:${x.id}` === key);
          a.notes = (a.notes ? a.notes.trim() + " " : "") + text;
          const ta = $("#as-work .as-notes"); if (ta && key === `assessment:${areaId}`) ta.value = a.notes;
        } else if (key === "notes") {
          addJot(text);
        } else if (C.fieldVals[key]) {
          addToField(key, text);
        } else {
          const ta = document.querySelector(`textarea[data-sec="${key}"]`);
          if (ta) ta.value = (ta.value.trim() ? ta.value.trim() + " " : "") + text;
        }
        renderDictated(el, key);
      });
      row.querySelector(".dict-move").addEventListener("click", () => {
        const text = dict[key].splice(i, 1)[0];
        (dict.notes = dict.notes || []).push(text);
        renderDictated(el, key);
        renderDictated(listFor("notes"), "notes");
      });
    });
  }

  function setDictation(on) {
    dictating = on;
    $("#dict-bar").hidden = !on;
    consult.querySelector(".c-dictate").classList.toggle("is-on", on);
    clearInterval(dictTimer); clearInterval(dictClock);
    if (!on) return;
    dictStart = Date.now();
    const tick = () => {
      const t = Math.floor((Date.now() - dictStart) / 1000);
      $("#dict-time").textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
      $("#dict-target").textContent = dictTarget().label;
    };
    tick(); dictClock = setInterval(tick, 500);
    dictTimer = setInterval(() => {
      const tgt = dictTarget();
      (dict[tgt.key] = dict[tgt.key] || []).push(C.dictation[dictNext++ % C.dictation.length]);
      renderDictated(listFor(tgt.key), tgt.key);
    }, 3200);
  }

  /* ---------- Finish: the report, assembled from what was written, shown as a paper page ---------- */
  let reportOpen = false;
  let tagFresh = false;
  function openReport(on, from) {
    reportOpen = on;
    const box = $("#report");
    document.body.classList.toggle("is-viewing", on);
    if (!on) { box.classList.remove("is-in"); setTimeout(() => { if (!reportOpen) box.hidden = true; }, 400); return; }
    if (dictating) setDictation(false);
    const val = (id) => (document.querySelector(`textarea[data-sec="${id}"]`) || {}).value || "";
    const para = (t) => (t.trim() ? t.trim().split(/\n\s*\n/).map((x) => `<p>${x.trim()}</p>`).join("") : `<p class="r-empty">Not written yet.</p>`);
    const areas = C.areas.map((a) => {
      const tests = a.tests.filter((t) => t.test && t.result);   // only tests with a result go into the report
      if (!tests.length && !a.notes) return "";
      return `<h4>${a.label}</h4>${tests.length ? `<ul>${tests.map((t) => `<li>${t.test} (${t.side}): ${t.result || "—"}${t.ref ? ` · other side: ${t.ref}` : ""}</li>`).join("")}</ul>` : ""}${a.notes ? `<p>${a.notes}</p>` : ""}`;
    }).join("");
    const type = consult.querySelector('.seg[aria-label="Assessment type"] .is-on').textContent.trim();
    const date = consult.querySelector('.c-date-field input').value;

    // what still needs a look before signing; each item takes you back to its place
    const goTo = (secId, then) => () => {
      openReport(false);
      const sec = secId && document.getElementById(`cs-${secId}`);
      if (sec && !sec.classList.contains("is-open")) sec.querySelector(".c-sec-head").click();
      setTimeout(() => { if (then) then(); else if (sec) sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }); }, 80);
    };
    const reasonRows = C.steps.find((x) => x.id === "reason").rows || [];
    const unconfirmed = reasonRows.filter((r) => !r.ok).length;
    const emptyAreas = C.areas.filter((a) => !a.tests.some((t) => t.result) && !a.notes);
    const todo = [
      !date && { text: "Assessment date not set", go: goTo(null, () => { const f = consult.querySelector(".c-date-field input"); f.scrollIntoView({ block: "center" }); f.focus(); }) },
      ...C.ask.filter((q) => !q.answer).map((q) => ({ text: `${q.label} not asked yet`, go: goTo(null, () => $("#c-ask").scrollIntoView({ block: "center" })) })),
      unconfirmed && { text: `Reason and history · ${unconfirmed} of ${reasonRows.length} lines not confirmed with her`, go: goTo("reason") },
      ...emptyAreas.map((a) => ({ text: `Assessment · no results for ${a.label.toLowerCase()}`, go: goTo("assessment", () => { selectArea(a.id); $("#cs-assessment").scrollIntoView({ behavior: "smooth", block: "start" }); }) })),
      C.goals.some((g) => g.example) && { text: `Goals and methods · ${C.goals.filter((g) => g.example).length} examples not kept or edited`, go: goTo("goals") },
      C.changedAfterSign && { text: "Changed after signing · sign again", go: goTo(null) },
      !val("conclusion").trim() && { text: "Conclusion not written", go: goTo("conclusion") },
      !val("recommendations").trim() && { text: "Recommendations not written", go: goTo("recommendations") },
    ].filter(Boolean);
    const asked = C.ask.filter((q) => q.answer).map((q) => `<li>${q.label}: ${q.answer} <span class="r-by">Physio, in session</span></li>`).join("");
    box.innerHTML = `
      ${C.signed ? `<aside class="r-review is-done"><p class="r-review-head"><i aria-hidden="true"></i>Signed and sent to Dr Favre, GP · ${C.signed.at}</p></aside>`
      : todo.length ? `<aside class="r-review" aria-label="Still to review">
        <p class="r-review-head">Still to review before signing</p>
        <ul>${todo.map((t, i) => `<li><button type="button" data-i="${i}"><i aria-hidden="true"></i>${t.text}<span aria-hidden="true">→</span></button></li>`).join("")}</ul>
      </aside>` : `<aside class="r-review is-done"><p class="r-review-head"><i aria-hidden="true"></i>Everything reviewed · ready to sign</p></aside>`}
      <article class="paper">
        <p class="r-kicker">Apiona · ${type}</p>
        <h2>Camille M. · 28 · female</h2>
        <p class="r-meta">Session 1 of 9 · Accident · mid-foot sprain · ${date ? date.split("-").reverse().join(".") : "assessment date not set"} · prescribed by the emergency department, Clinique Bois-Cerf</p>
        <h3>1 · Reason and history</h3>${para(val("reason"))}
        ${asked ? `<h4>Completed in session</h4><ul>${asked}</ul>` : ""}
        <h3>2 · Assessment</h3>${areas || `<p class="r-empty">No results entered yet.</p>`}
        <h3>3 · Goals and methods</h3><ol>${C.goals.filter((g) => g.goal).map((g) => `<li><b>${g.goal}</b>${g.methods ? ` · ${g.methods}` : ""}</li>`).join("")}</ol>
        <h3>4 · Notes</h3>${para(val("notes"))}
        <h3>5 · Conclusion</h3>${para(val("conclusion"))}
        <h3>6 · Recommendations</h3>${para(val("recommendations"))}
        <p class="r-sign">${C.signed ? `Signed by Lena Keller, physiotherapist · sent to Dr Favre, GP · ${C.signed.at}` : "Lena Keller, physiotherapist · draft, not signed"}</p>
      </article>
      <div class="report-actions">
        <button type="button" class="r-back-btn">${isPhone() ? "← Consultation" : "Back to the consultation"}</button>${C.signed ? `
        <button type="button" class="r-done-btn">${isPhone() ? "Done" : "Done · back to the summary"}</button>` : `
        <button type="button" class="r-sign-btn">${isPhone() ? "Sign and send" : "Sign and send to Dr Favre, GP"}</button>`}
      </div>`;
    box.hidden = false;
    const o = (from && from.isConnected ? from : startBtn).getBoundingClientRect();
    box.querySelectorAll(".paper, .r-review").forEach((el) => {
      const r = el.getBoundingClientRect();
      el.style.transformOrigin = `${o.left + o.width / 2 - r.left}px ${o.top + o.height / 2 - r.top}px`;
    });
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("is-in")));
    box.querySelector(".r-back-btn").addEventListener("click", () => openReport(false));
    box.querySelectorAll(".r-review li button").forEach((b) => b.addEventListener("click", () => todo[+b.dataset.i].go()));
    box.querySelector(".r-done-btn")?.addEventListener("click", () => { openReport(false); setConsult(false); });
    box.querySelector(".r-sign-btn")?.addEventListener("click", (e) => {
      // with things left to review, the first click says so; a second click signs anyway
      if (todo.length && !e.target.dataset.sure) {
        e.target.dataset.sure = "1";
        e.target.textContent = isPhone() ? `${todo.length} to review · tap again` : `${todo.length} still to review · click again to sign anyway`;
        e.target.classList.add("is-warn");
        return;
      }
      const now = new Date();
      C.signed = { at: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` };
      C.changedAfterSign = false;
      saveConsult(); applySigned(); tagFresh = true;
      // one calm moment: a green check draws itself, then the report shows as signed
      const seal = document.createElement("div");
      seal.className = "r-seal";
      seal.innerHTML = `<svg viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="24" pathLength="1"/><path d="M15 27l7 7 15-16" pathLength="1"/></svg><b>Signed and sent</b><span>to Dr Favre, GP</span>`;
      box.appendChild(seal);
      void seal.offsetWidth;   // start from the hidden state, then draw
      seal.classList.add("is-in");
      setTimeout(() => { seal.remove(); openReport(true); }, reduceMotion ? 0 : 1500);
    });
  }

  /* Assessment by area: tabs for the areas; for each, what the record says (by the practice's rules),
     a small table of tests to fill in, and free notes. What you type is kept when you switch areas. */
  let areaId = "balance";
  let bodySvgText = null;
  fetch("../../design/illustrations/body-female.svg").then((x) => x.text()).then((t) => { bodySvgText = t; syncFigure(); });
  const esc = (v) => String(v || "").replace(/"/g, "&quot;");

  /* The body is how you choose what to assess. Each area has a labelled hotspot (Balance at the centre of gravity,
     Function at the hips, Muscles at the calf, Joints at the ankle). Click one to assess it: that part of the body
     fills in blue, following the body's own outline. Hovering a hotspot or a tab lights up the other. */
  const HOT = { balance: [100, 200], function: [122, 292], muscles: [80, 362], joints: [74, 424] };
  function bodyFigure() {
    if (!bodySvgText) return "";
    const shapes = (bodySvgText.match(/<g[^>]*>([\s\S]*)<\/g>/) || [])[1] || "";
    const zones = C.areas.map((a) => `<g class="zone" data-area="${a.id}" clip-path="url(#as-clip)">${
      (a.zones || []).map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join("")}</g>`).join("");
    const ground = `<line class="ground" data-area="balance" x1="20" y1="466" x2="120" y2="466"/>`;
    const pains = kids("hurts").map((n) => `<circle class="tone-${n.tone}" cx="${n.spot[0]}" cy="${n.spot[1]}" r="5.5"><title>${n.label} · from the record</title></circle>`).join("");
    const spots = C.areas.map((a, i) => {
      const [x, y] = HOT[a.id];
      return `<g class="spot" data-area="${a.id}" tabindex="0" role="button" aria-label="Assess ${a.label}">
        <rect class="hit" x="${x - 16}" y="${y - 16}" width="${236 - x + 16}" height="32"/>
        <line class="lead" x1="${x}" y1="${y}" x2="150" y2="${y}"/>
        <circle class="pulse" cx="${x}" cy="${y}" r="7" style="animation-delay:${i * 0.6}s"/>
        <circle class="ring" cx="${x}" cy="${y}" r="12"/><circle class="dot" cx="${x}" cy="${y}" r="7"/>
        <rect class="pill" x="0" y="0" width="0" height="0"/>
        <text x="162" y="${y}">${a.label}</text></g>`;
    }).join("");
    return `<svg class="as-body" viewBox="0 -10 236 481" aria-label="Choose what to assess on the body">
      <defs><clipPath id="as-clip">${shapes}</clipPath></defs>
      <g class="sil">${shapes}</g>${zones}${ground}${spots}
    </svg>`;
  }

  function syncFigure() {
    const fig = $("#as-figure");
    if (!fig) return;
    if (!fig.firstElementChild && bodySvgText) {
      fig.innerHTML = bodyFigure();
      fig.querySelectorAll(".spot").forEach((sp) => {
        const pick = () => selectArea(sp.dataset.area);
        sp.addEventListener("click", pick);
        sp.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
        sp.addEventListener("mouseenter", () => hoverArea(sp.dataset.area, true));
        sp.addEventListener("mouseleave", () => hoverArea(sp.dataset.area, false));
      });
      fig.querySelectorAll(".zone").forEach((z) => z.addEventListener("click", () => selectArea(z.dataset.area)));
    }
    fig.querySelectorAll("[data-area]").forEach((el) => el.classList.toggle("is-on", el.dataset.area === areaId));
    sizePills();
  }

  // the web from the home screen: thin lines from the chosen label to each fact from the record
  /* ---------- Keeping the consultation: "All changes saved" is true — it lives in this browser until ?fresh ---------- */
  const STORE = "apiona-consultation-v1";
  let restoring = false;
  let stored = null;
  function saveConsult() {
    const segIndex = (sel) => [...consult.querySelectorAll(`${sel} button`)].findIndex((b) => b.classList.contains("is-on"));
    const text = (id) => (document.querySelector(`textarea[data-sec="${id}"]`) || {}).value || "";
    const data = {
      date: consult.querySelector(".c-date-field input").value,
      type: segIndex('.seg[aria-label="Assessment type"]'), attendance: segIndex('.seg[aria-label="Attendance"]'),
      areas: C.areas.map((a) => ({ tests: a.tests, notes: a.notes || "" })),
      goals: C.goals, fields: C.fieldVals,
      texts: { conclusion: text("conclusion"), recommendations: text("recommendations") }, signed: C.signed || null, changedAfterSign: !!C.changedAfterSign,
      ask: C.ask.map((q) => q.answer || ""),
      reason: (C.steps.find((x) => x.id === "reason").rows || []).map((r) => ({ text: r.text, ok: !!r.ok, edited: !!r.edited })),
      jots, begun: !!C.begun,
    };
    try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {}
  }
  // data first (before the page is built from it) …
  function restoreConsult() {
    try {
      if (new URLSearchParams(location.search).has("fresh")) { localStorage.removeItem(STORE); return; }
      stored = JSON.parse(localStorage.getItem(STORE) || "null");
    } catch (e) { stored = null; }
    if (!stored) return;
    stored.areas?.forEach((x, i) => { if (C.areas[i]) { C.areas[i].tests = x.tests; C.areas[i].notes = x.notes; } });
    if (stored.goals) C.goals.splice(0, C.goals.length, ...stored.goals);
    if (stored.fields) Object.keys(C.fieldVals).forEach((id) => { if (Array.isArray(stored.fields[id])) C.fieldVals[id] = stored.fields[id]; });
    C.signed = stored.signed || null; C.changedAfterSign = !!stored.changedAfterSign; C.begun = !!stored.begun;   // only real work counts; merely opening the consultation does not
    stored.ask?.forEach((a, i) => { if (C.ask[i] && a) C.ask[i].answer = a; });
    const rows = C.steps.find((x) => x.id === "reason").rows || [];
    stored.reason?.forEach((x, i) => { if (rows[i]) Object.assign(rows[i], x); });
    if (stored.jots) jots.push(...stored.jots);
  }
  // … then the fields that only exist on the page
  function restoreConsultFields() {
    if (!stored) return;
    restoring = true;
    const pick = (sel, i) => { const b = consult.querySelectorAll(`${sel} button`)[i]; if (b && i >= 0) b.click(); };
    if (stored.date) consult.querySelector(".c-date-field input").value = stored.date;
    pick('.seg[aria-label="Assessment type"]', stored.type); pick('.seg[aria-label="Attendance"]', stored.attendance);
    if (jots.length) renderJots();
    // the conclusion and recommendations, as plain text (older saves kept them as labelled fields)
    ["conclusion", "recommendations"].forEach((id) => {
      const f = document.querySelector(`textarea[data-sec="${id}"]`);
      const old = stored.fields && Array.isArray(stored.fields[id]) ? stored.fields[id].filter((v) => v.trim()).join("\n\n") : "";
      const v = (stored.texts && stored.texts[id]) || old;
      if (f && v) f.value = v;
    });
    const ta = document.querySelector('textarea[data-sec="reason"]'), rows = C.steps.find((x) => x.id === "reason").rows || [];
    if (ta) ta.value = rows.map((r) => `${r.label}: ${r.text}`).join("\n\n");
    const n = $('#c-notes textarea[data-sec="notes"]'); if (n) n.value = jots.map((j) => `${j.time}  ${j.text}`).join("\n");
    restoring = false;
    saveConsult();   // the page saved itself while it was being built; store the restored version again
    applySigned();
  }

  /* ---------- Notes as timed jottings: Enter files a note with the time in the session ---------- */
  const jots = [];
  const sessionTime = () => {
    const t = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  function syncNotes() {
    const ta = $('#c-notes textarea[data-sec="notes"]');
    ta.value = jots.map((j) => `${j.time}  ${j.text}`).join("\n");
    ta.dispatchEvent(new Event("input", { bubbles: true }));   // the saving status follows
  }
  function renderJots(fresh) {
    const list = $("#c-notes .jots");
    list.innerHTML = jots.map((j, i) => `
      <li class="jot${fresh && i === jots.length - 1 ? " is-new" : ""}" data-i="${i}">
        <time>${j.time}</time>
        <span class="jot-text" contenteditable="plaintext-only" spellcheck="true">${j.text.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</span>
        <button type="button" class="jot-del" aria-label="Remove this note">×</button>
      </li>`).join("");
    list.querySelectorAll(".jot").forEach((li) => {
      const j = jots[+li.dataset.i];
      li.querySelector(".jot-text").addEventListener("input", (e) => { j.text = e.target.textContent; syncNotes(); });
      li.querySelector(".jot-del").addEventListener("click", () => { jots.splice(+li.dataset.i, 1); renderJots(); syncNotes(); });
    });
    list.scrollTop = list.scrollHeight;
    const cnt = $("#c-notes .c-notes-count"); if (cnt) cnt.textContent = jots.length ? `${jots.length} · tap to write` : "tap to write";
  }
  function addJot(text) {
    text = text.trim();
    if (!text) return;
    jots.push({ time: sessionTime(), text });
    renderJots(true); syncNotes();
  }
  function wireJots() {
    const input = $("#c-notes .jot-input");
    const fit = () => { input.style.height = "auto"; input.style.height = input.scrollHeight + "px"; };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addJot(input.value); input.value = ""; fit(); }
    });
    input.addEventListener("input", fit);
  }

  /* ---------- Conclusion and Recommendations: a few labelled fields, structure without pre-written content ---------- */
  C.fieldVals = C.fieldVals || {};
  C.steps.filter((st) => st.fields).forEach((st) => { C.fieldVals[st.id] = C.fieldVals[st.id] || st.fields.map(() => ""); });
  function syncField(id) {
    const st = C.steps.find((x) => x.id === id), ta = document.querySelector(`textarea[data-sec="${id}"]`);
    ta.value = st.fields.map((f, k) => (C.fieldVals[id][k].trim() ? `${f}: ${C.fieldVals[id][k].trim()}` : "")).filter(Boolean).join("\n\n");
  }
  function buildFields() {
    document.querySelectorAll(".fields[data-fields]").forEach((box) => {
      const id = box.dataset.fields;
      box.querySelectorAll("textarea.fld").forEach((f) => {
        const k = +f.dataset.k;
        f.value = C.fieldVals[id][k] || "";
        const fit = () => { f.style.height = "auto"; if (f.scrollHeight) f.style.height = f.scrollHeight + "px"; };
        f.addEventListener("input", () => { C.fieldVals[id][k] = f.value; syncField(id); fit(); });
        f.addEventListener("focus", fit);
      });
      syncField(id);
    });
  }
  function addToField(id, text) {
    const k = Math.max(0, C.fieldVals[id].findIndex((v) => !v.trim()));   // the first empty field, else the first
    C.fieldVals[id][k] = (C.fieldVals[id][k].trim() ? C.fieldVals[id][k].trim() + " " : "") + text;
    const f = document.getElementById(`f-${id}-${k}`); if (f) f.value = C.fieldVals[id][k];
    syncField(id);
  }

  /* ---------- After signing: the visit is done, and the summary says so ---------- */
  const sessionTag = R.patient.tags[0].text;
  function renderTags() { $("#p-tags").innerHTML = R.patient.tags.map((t) => `<li class="tag tag-${t.tone}"><span class="t-long">${t.text}</span><span class="t-short">${shortTag(t)}</span></li>`).join(""); }
  function applySigned() {
    R.patient.tags[0].text = C.signed ? "Session 1 of 9 · done today" : sessionTag;
    renderTags();
    startBtn.querySelector("span").textContent = startLabel(consulting);
    const save = $("#c-save");
    if (C.signed) { save.classList.remove("is-saving"); save.querySelector("span").textContent = `Signed and sent · ${C.signed.at}`; }
  }

  /* ---------- Reason and history: lines to go through with her, confirm or correct ---------- */
  function buildReason() {
    const rows = C.steps.find((x) => x.id === "reason").rows;
    const box = $("#rh"), ta = $('textarea[data-sec="reason"]');
    const sync = () => {
      ta.value = rows.map((r) => `${r.label}: ${r.text}`).join("\n\n");
      ta.dispatchEvent(new Event("input", { bubbles: true }));   // the saving status follows
    };
    box.innerHTML = rows.map((r, i) => `
      <div class="rh-row" data-i="${i}">
        <span class="rh-label">${r.label}</span>
        <span class="rh-body"><span class="rh-text" contenteditable="plaintext-only" spellcheck="true" aria-label="${r.label}">${r.text}</span>
          <span class="rh-src">${r.src}<span class="rh-today"> · corrected today</span></span></span>
        <button type="button" class="rh-ok" aria-pressed="false"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" pathLength="1"/></svg><span>Confirm with her</span></button>
      </div>`).join("");
    box.querySelectorAll(".rh-row").forEach((row) => {
      const r = rows[+row.dataset.i], text = row.querySelector(".rh-text"), ok = row.querySelector(".rh-ok");
      row.classList.toggle("is-edited", !!r.edited);
      row.classList.toggle("is-ok", !!r.ok); ok.setAttribute("aria-pressed", !!r.ok);
      if (r.ok) ok.querySelector("span").textContent = "Confirmed with her";
      text.addEventListener("input", () => { r.text = text.textContent; r.edited = true; row.classList.add("is-edited"); sync(); });
      ok.addEventListener("click", () => {
        const on = !row.classList.contains("is-ok");
        r.ok = on;
        row.classList.toggle("is-ok", on); ok.setAttribute("aria-pressed", on);
        ok.querySelector("span").textContent = on ? "Confirmed with her" : "Confirm with her";
      });
    });
    ta.value = rows.map((r) => `${r.label}: ${r.text}`).join("\n\n");
  }

  // documents attached to the facts of an area: one node per document, however many facts point to it
  function docNodes(a) {
    const ids = [...new Set(a.record.map((x) => x.doc).filter(Boolean))];
    return ids.map((id) => {
      const M = byId.get(id).media, im = M.images[0];
      return `<button class="as-doc" type="button" data-doc="${id}" aria-label="View ${M.caption}">
        <span class="as-doc-page"><img src="${im.src}" alt=""></span><span class="as-doc-cap">GP report</span></button>`;
    }).join("");
  }

  // a document, large in the middle of the screen; click anywhere or Esc to put it back
  function openDoc(id, from) {
    const M = byId.get(id).media;
    const view = document.createElement("div");
    view.className = "doc-view";
    view.innerHTML = `<div class="doc-pages">${M.images.map((im) => `<img src="${im.src}" alt="${im.alt}">`).join("")}</div>
      <p class="doc-cap"><span>${M.caption}</span>${M.file ? `<a href="${M.file.href}" target="_blank" rel="noopener">${M.file.label} ↗</a>` : ""}<span class="doc-hint">click anywhere to put it back</span></p>`;
    const r = from.getBoundingClientRect();
    view.style.setProperty("--ox", `${r.left + r.width / 2}px`);
    view.style.setProperty("--oy", `${r.top + r.height / 2}px`);
    document.body.appendChild(view);
    const close = () => { view.classList.remove("is-in"); document.removeEventListener("keydown", onKey, true); setTimeout(() => view.remove(), 400); };
    const onKey = (e) => { if (e.key === "Escape") { e.stopImmediatePropagation(); close(); } };
    view.addEventListener("click", (e) => { if (!e.target.closest("a")) close(); });
    document.addEventListener("keydown", onKey, true);
    const pages = view.querySelector(".doc-pages"), pr = pages.getBoundingClientRect();
    pages.style.transformOrigin = `${r.left + r.width / 2 - pr.left}px ${r.top + r.height / 2 - pr.top}px`;
    requestAnimationFrame(() => requestAnimationFrame(() => view.classList.add("is-in")));
  }

  // the facts float a little, like the nodes on the home screen, and lean towards the pointer;
  // soft curves tie them to the chosen label
  const web = { lay: null, svg: null, a: null, facts: [], ptr: null, raf: 0 };
  function linkFacts(animate) {
    const lay = document.querySelector("#assess .as-layout");
    if (!lay || !lay.offsetWidth) return;
    let svg = lay.querySelector(".as-links");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "as-links");
      svg.setAttribute("aria-hidden", "true");
      lay.appendChild(svg);
      lay.addEventListener("pointermove", (e) => { const L = lay.getBoundingClientRect(); web.ptr = { x: e.clientX - L.left, y: e.clientY - L.top }; });
      lay.addEventListener("pointerleave", () => { web.ptr = null; });
    }
    const pill = lay.querySelector(`.spot[data-area="${areaId}"] .pill`);
    const els = [...lay.querySelectorAll(".as-fact")];
    if (!pill || !els.length || !(+pill.getAttribute("width"))) { svg.innerHTML = ""; web.facts = []; return; }
    els.forEach((el) => { el.style.transform = ""; });
    const L = lay.getBoundingClientRect(), P = pill.getBoundingClientRect();
    web.lay = lay; web.svg = svg;
    web.a = { x: P.right - L.left, y: P.top + P.height / 2 - L.top };
    const body = (el, x, y, i) => ({ el, i, bx: x, by: y, ox: 0, oy: 0, vx: 0, vy: 0, seed: i * 1.7 + Math.random() });
    web.facts = els.map((el, i) => {
      const r = el.querySelector(".as-mark").getBoundingClientRect();
      const f = body(el, r.left - L.left - 6, r.top + r.height / 2 - L.top, i);
      const t = el.querySelector(".src-t").getBoundingClientRect();
      f.end = { x: t.right - L.left + 6, y: t.top + t.height / 2 - L.top };   // where a document link leaves the fact
      return f;
    });
    // documents sit level with the facts that point to them, and float too
    web.docs = [...lay.querySelectorAll(".as-doc")].map((el, i) => {
      const from = web.facts.filter((f) => f.el.dataset.doc === el.dataset.doc);
      el.style.transform = "";
      el.style.top = `${from.reduce((t, f) => t + f.end.y, 0) / from.length - lay.querySelector("#as-panel").getBoundingClientRect().top + L.top - el.offsetHeight / 2}px`;
      const r = el.getBoundingClientRect();
      const d = body(el, r.left - L.left, r.top + r.height / 2 - L.top, i + 5);
      d.from = from;
      if (!el.dataset.wired) { el.dataset.wired = 1; el.addEventListener("click", () => openDoc(el.dataset.doc, el)); }
      return d;
    });
    web.links = web.docs.flatMap((d) => d.from.map((f) => ({ f, d })));
    svg.innerHTML = web.facts.map((f) => `<path pathLength="1" style="--i:${f.i}"/><circle r="2" style="--i:${f.i}"/>`).join("")
      + web.links.map((l, k) => `<path class="to-doc" pathLength="1" style="--i:${web.facts.length + k}"/>`).join("")
      + `<circle class="from" cx="${web.a.x}" cy="${web.a.y}" r="2.5"/>`;
    drawWeb(performance.now());
    svg.classList.toggle("is-drawn", !animate);
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => svg.classList.add("is-drawn")));
    if (!web.raf && !reduceMotion && !isPhone()) web.raf = requestAnimationFrame(floatWeb);   // on a phone there are no lines, so the facts stay still
  }

  function drawWeb(t) {
    const { a, svg } = web;
    const paths = svg.querySelectorAll("path:not(.to-doc)"), dots = svg.querySelectorAll("circle:not(.from)");
    svg.querySelectorAll("path.to-doc").forEach((p, k) => {
      const { f, d } = web.links[k];
      const s0 = { x: f.end.x + f.ox, y: f.end.y + f.oy }, e = { x: d.bx + d.ox - 4, y: d.by + d.oy };
      const dx = e.x - s0.x, sway = Math.sin(t / 2100 + d.seed + k) * 6;
      p.setAttribute("d", `M${s0.x},${s0.y} C${s0.x + dx * 0.5},${s0.y + sway} ${e.x - dx * 0.5},${e.y - sway} ${e.x},${e.y}`);
    });
    web.docs.forEach((d) => { d.el.style.transform = `translate(${d.ox.toFixed(2)}px, ${d.oy.toFixed(2)}px)`; });
    web.facts.forEach((f, k) => {
      const b = { x: f.bx + f.ox, y: f.by + f.oy };
      const dx = b.x - a.x, sway = Math.sin(t / 1900 + f.seed) * 10;
      paths[k].setAttribute("d", `M${a.x},${a.y} C${a.x + dx * 0.45},${a.y + sway} ${b.x - dx * 0.45},${b.y - sway} ${b.x},${b.y}`);
      dots[k].setAttribute("cx", b.x); dots[k].setAttribute("cy", b.y);
      f.el.style.transform = `translate(${f.ox.toFixed(2)}px, ${f.oy.toFixed(2)}px)`;
    });
  }

  function floatWeb(t) {
    web.raf = 0;
    if (isPhone()) { web.facts.concat(web.docs || []).forEach((f) => { f.el.style.transform = ""; }); return; }
    if (!web.lay || !web.lay.isConnected || !web.lay.offsetWidth || !web.facts.length) return;   // restarts on the next linkFacts
    web.facts.concat(web.docs || []).forEach((f) => {
      // a slow drift around its place, plus a lean towards the pointer when it is near
      let tx = Math.sin(t / 2300 + f.seed) * 3, ty = Math.cos(t / 1700 + f.seed * 1.3) * 3.5;
      if (web.ptr) {
        const px = web.ptr.x - f.bx, py = web.ptr.y - f.by, d = Math.hypot(px, py);
        if (d < 160) { const k = (1 - d / 160) * 0.12; tx += px * k; ty += py * k; }
      }
      // spring towards the target, as the home network does
      f.vx = (f.vx + (tx - f.ox) * 0.06) * 0.82; f.vy = (f.vy + (ty - f.oy) * 0.06) * 0.82;
      f.ox += f.vx; f.oy += f.vy;
    });
    drawWeb(t);
    web.raf = requestAnimationFrame(floatWeb);
  }
  addEventListener("resize", () => linkFacts(false));

  // each label sits in a pill sized to its text, so it reads as a button (measured once it is visible)
  function sizePills() {
    const spots = document.querySelectorAll("#as-figure .spot");
    if (!spots.length || spots[0].querySelector(".pill").getAttribute("width") > 30) return;
    spots.forEach((sp) => {
      const b = sp.querySelector("text").getBBox();
      if (!b.width) return;
      const h = b.height + 12, r = sp.querySelector(".pill");
      Object.entries({ x: b.x - 11, y: b.y + b.height / 2 - h / 2, width: b.width + 22, height: h, rx: h / 2 })
        .forEach(([k, v]) => r.setAttribute(k, v));
    });
    linkFacts(true);
  }

  function hoverArea(id, on) {
    document.querySelectorAll(`#assess [data-area="${id}"]`).forEach((el) => el.classList.toggle("is-hover", on));
    const body = document.querySelector("#assess .as-body");
    if (body) body.classList.toggle("has-hover", on && id !== areaId);
  }

  function selectArea(id) {
    areaId = id;
    renderArea();
  }

  // affected side against the other side, when both are numbers: a two-part bar and the ratio in words
  function compareBar(t) {
    const num = (v) => { const m = String(v || "").replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
    const a = num(t.result), b = num(t.ref);
    if (a === null || b === null || b <= 0) return "";
    const max = Math.max(a, b), unit = (String(t.result).match(/[a-z°%]+/i) || [""])[0];
    return `<div class="cmp-bar">
      <span class="cmp-row"><span class="cmp-k">This side</span><i style="width:${(a / max) * 100}%"></i><b>${a} ${unit}</b></span>
      <span class="cmp-row is-ref"><span class="cmp-k">Other side</span><i style="width:${(b / max) * 100}%"></i><b>${b} ${unit}</b></span>
      <span class="cmp-ratio">${Math.round((a / b) * 100)}% of the other side</span>
    </div>`;
  }

  function buildAssessment() {
    const box = $("#assess");
    box.innerHTML = `
      <div class="as-layout">
        <figure class="as-figure" id="as-figure"></figure>
        <div class="as-panel" id="as-panel"></div>
      </div>
      <div class="as-work" id="as-work"></div>`;
    renderArea();
  }

  function renderArea() {
    const a = C.areas.find((x) => x.id === areaId);
    const panel = $("#as-panel");
    panel.classList.remove("is-in");
    panel.innerHTML = `
      <div class="as-record">
          <h4 class="as-area-name">${a.label}</h4>
          ${a.record.length ? `<details class="as-ctx"${isPhone() ? "" : " open"}><summary><span>From the record · ${a.record.length}</span></summary>`
            + a.record.map((x) => `<p class="as-fact"${x.doc ? ` data-doc="${x.doc}"` : ""}><i class="as-mark" aria-hidden="true"></i><span class="as-fact-text">${x.text}<span class="src"><span class="src-t">${x.src}</span></span></span></p>`).join("")
            + docNodes(a) + `</details>`
            : `<p class="as-none">Nothing highlighted by your rules for this area.</p>`}
      </div>`;
    const work = $("#as-work");
    work.classList.remove("is-in");
    work.innerHTML = `
      <table class="as-tests">
        <colgroup><col style="width:30%"><col style="width:20%"><col style="width:20%"><col style="width:26%"><col style="width:4%"></colgroup>
        <thead><tr><th>Test</th><th>Side</th><th>Result</th><th>Other side</th><th aria-label="Remove"></th></tr></thead>
        <tbody>${a.tests.map((t, i) => `
          <tr data-i="${i}">
            <td><input data-k="test" value="${esc(t.test)}" aria-label="Test"></td>
            <td><select data-k="side" aria-label="Side">${C.sides.map((sd) => `<option${sd === t.side ? " selected" : ""}>${sd}</option>`).join("")}</select></td>
            <td><input data-k="result" value="${esc(t.result)}" placeholder="result" aria-label="Result"></td>
            <td><input data-k="ref" value="${esc(t.ref)}" placeholder="reference" aria-label="Reference or other side"></td>
            <td><button class="as-del" type="button" aria-label="Remove this test">×</button></td>
          </tr>
          <tr class="cmp" data-for="${i}"><td colspan="5">${compareBar(t)}</td></tr>`).join("")}
        </tbody>
      </table>
      <button class="as-add" type="button">+ Add a test</button>
      <div class="dict-list"></div>
      <textarea class="as-notes" rows="3" placeholder="Specific tests and free remarks for ${a.label.toLowerCase()}…" aria-label="Notes for ${a.label}">${a.notes || ""}</textarea>`;
    work.querySelectorAll("tbody tr[data-i]").forEach((tr) => {
      const t = a.tests[+tr.dataset.i];
      tr.querySelectorAll("[data-k]").forEach((f) => f.addEventListener("input", () => {
        t[f.dataset.k] = f.value;
        work.querySelector(`tr.cmp[data-for="${tr.dataset.i}"] td`).innerHTML = compareBar(t);   // the bar follows the numbers
      }));
      tr.querySelector(".as-del").addEventListener("click", () => { a.tests.splice(+tr.dataset.i, 1); renderArea(); });
    });
    work.querySelector(".as-add").addEventListener("click", () => {
      a.tests.push({ test: "", side: "Both sides" });
      renderArea();
      const rows = work.querySelectorAll("tbody tr[data-i]");
      rows[rows.length - 1].querySelector("input").focus();
    });
    work.querySelector(".as-notes").addEventListener("input", (e) => { a.notes = e.target.value; });
    renderDictated(work.querySelector(".dict-list"), `assessment:${a.id}`);
    syncFigure();
    requestAnimationFrame(() => { panel.classList.add("is-in"); work.classList.add("is-in"); linkFacts(true); });
  }

  // the analog clock: hands for the time now; a blue arc from when the session started to now
  (function drawTicks() {
    const g = $(".clock .ticks");
    g.innerHTML = Array.from({ length: 12 }, (_, i) => {
      const a = (i * 30 * Math.PI) / 180, r1 = i % 3 ? 15.5 : 14, r2 = 17;
      return `<line x1="${20 + r1 * Math.sin(a)}" y1="${20 - r1 * Math.cos(a)}" x2="${20 + r2 * Math.sin(a)}" y2="${20 - r2 * Math.cos(a)}"/>`;
    }).join("");
  })();
  const onFace = (deg, r) => [20 + r * Math.sin((deg * Math.PI) / 180), 20 - r * Math.cos((deg * Math.PI) / 180)];

  function tickClock() {
    const now = new Date(), t = Math.floor((Date.now() - startedAt) / 1000);
    $("#c-clock").textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
    $("#c-now").textContent = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const mDeg = (now.getMinutes() + now.getSeconds() / 60) * 6, hDeg = ((now.getHours() % 12) + now.getMinutes() / 60) * 30;
    const [mx, my] = onFace(mDeg, 13), [hx, hy] = onFace(hDeg, 8.5);
    $("#c-minute").setAttribute("x2", mx); $("#c-minute").setAttribute("y2", my);
    $("#c-hour").setAttribute("x2", hx); $("#c-hour").setAttribute("y2", hy);
    // session arc, on the minute ring: from the start minute to now (a full turn = one hour)
    const start = new Date(startedAt), sDeg = (start.getMinutes() + start.getSeconds() / 60) * 6;
    const span = Math.min(359.9, Math.max(1.5, mDeg - sDeg + (mDeg < sDeg ? 360 : 0)));
    const [ax, ay] = onFace(sDeg, 18), [bx, by] = onFace(sDeg + span, 18);
    $("#c-arc").setAttribute("d", `M20,20 L${ax},${ay} A18,18 0 ${span > 180 ? 1 : 0} 1 ${bx},${by} Z`);
  }

  // the green button says where the visit stands
  function startLabel(inConsult) {
    if (C.signed) return "View the signed report";
    if (inConsult) return isPhone() ? "Finish report" : "Finish and prepare the report";
    return C.begun ? "Resume consultation" : "Start consultation";
  }
  function setConsult(on, push = true) {
    if (on === consulting) return;

    setDir(on ? "consultation" : "summary");
    consulting = on;
    if (on && viewing) setViewing(false);
    if (on && state.current) select(null);
    document.body.classList.toggle("is-consult", on);
    clearTimeout(hideTimer);
    if (on) {
      consult.hidden = false;
      consult.classList.remove("is-out");
      consult.scrollTop = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => { consult.classList.add("is-in"); }));
      startedAt = Date.now(); tickClock(); clockTimer = setInterval(tickClock, 1000);
    } else {
      if (dictating) setDictation(false);
      if (reportOpen) openReport(false);
      consult.classList.remove("is-in");
      consult.classList.add("is-out");
      hideTimer = setTimeout(() => { consult.hidden = true; }, 500);
      clearInterval(clockTimer);
    }
    syncMenu(on ? "consultation" : "summary");
    // the green button becomes the next step of the visit
    startBtn.querySelector("span").textContent = startLabel(on);
    if (push) history.pushState(null, "", on ? "#consultation" : location.pathname + location.search);
  }

  /* ---------- Phone: the menu opens as a sheet from the ☰ button ---------- */
  const burger = $("#m-burger");
  const setMenu = (on) => { document.body.classList.toggle("m-menu", on); burger.setAttribute("aria-expanded", on); };
  burger.addEventListener("click", () => setMenu(!document.body.classList.contains("m-menu")));
  $("#m-scrim").addEventListener("click", () => setMenu(false));
  $("#rail").addEventListener("click", (e) => { if (e.target.closest("a[href]")) setMenu(false); });
  let wasPhone = isPhone();
  function placeAttendance() {   // phone: Present / Absent sits in the page, next to the assessment type; desktop: in the header
    const seg = consult.querySelector('.seg[aria-label="Attendance"]');
    if (seg) (isPhone() ? consult.querySelector(".c-type") : consult.querySelector(".c-tools")).prepend(seg);
  }
  placeAttendance();
  addEventListener("resize", () => { if (isPhone() !== wasPhone) { wasPhone = isPhone(); setMenu(false); placeAttendance(); if (aux === "followup") renderFollowup(); if (!isPhone()) document.querySelectorAll(".as-ctx").forEach((d) => { d.open = true; }); } apply(); });

  /* ---------- Pages: Summary · Consultation · Follow-up · Documents ---------- */
  let aux = null;   // "followup" or "documents" while one of them is shown
  const ORDER = ["summary", "consultation", "followup", "documents"];
  let curPage = "summary";
  function setDir(p, d) {   // forward in the menu: the new page comes from the right; back: from the left
    document.body.style.setProperty("--dir", d || (ORDER.indexOf(p) >= ORDER.indexOf(curPage) ? 1 : -1));
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && curPage === "summary") kick(); });
  function syncMenu(p) {
    curPage = p;
    if (p === "summary") kick();   // the web starts drifting again
    if (p === "summary" && tagFresh) { tagFresh = false; setTimeout(() => { const t = $("#p-tags li"); if (t) t.classList.add("is-fresh"); }, 520); }
    document.querySelectorAll(".page[data-page]").forEach((a) => {
      const here = a.dataset.page === p;
      a.classList.toggle("is-current", here);
      a.classList.toggle("is-live", here && p === "consultation");
      if (here) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }
  function showAux(p) {
    ["followup", "documents"].forEach((id) => {
      const el = document.getElementById(id), on = id === p;
      if (on) { (id === "followup" ? renderFollowup : renderDocuments)(); el.hidden = false; el.classList.remove("is-out"); el.scrollTop = 0; requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-in"))); }
      else if (!el.hidden) { el.classList.remove("is-in"); el.classList.add("is-out"); setTimeout(() => { if (aux !== id) el.hidden = true; }, 450); }
    });
    aux = p;
    document.body.classList.toggle("is-page", !!p);
  }
  function setPage(p, push = true) {
    const d = ORDER.indexOf(p) >= ORDER.indexOf(curPage) ? 1 : -1;
    setDir(p, d);
    if (reportOpen) openReport(false);
    if (p === "consultation") { showAux(null); setConsult(true, push); syncMenu(p); return; }
    if (consulting) { setConsult(false, false); setDir(p, d); }   // leaving the consultation must not flip the direction
    if (p !== "summary" && state.current) select(null);
    showAux(p === "summary" ? null : p);
    syncMenu(p);
    startBtn.querySelector("span").textContent = startLabel(false);
    if (push) history.pushState(null, "", { followup: "#follow-up", documents: "#documents" }[p] || location.pathname + location.search);
  }
  const hm = () => { const n = new Date(); return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`; };
  const pageBar = (title, sub) => `<header class="pg-bar"><div class="c-title"><h2>${title} · Camille M.</h2><p>${sub}</p></div></header>`;

  /* Follow-up: a calm list, newest first. Dates on the left, plain text, a thin line; colour only in small dots. */
  function renderFollowup() {
    const box = $("#followup");
    const attendance = ((consult.querySelector('.seg[aria-label="Attendance"] .is-on') || {}).textContent || "Present").trim();
    const goals = C.goals.filter((g) => g.goal);
    const kept = goals.filter((g) => !g.example), examples = goals.filter((g) => g.example);
    const asked = C.ask.filter((q) => q.answer);
    const done = C.signed ? 1 : 0;
    if (isPhone()) {
      // phone: one timeline that holds everything; what is next sits on top, then today, then before
      box.innerHTML = pageBar("Follow-up", `Session 1 of 9 · ${C.signed ? "done today" : "today, in progress"}`) + `
      <div class="pg-main">
        <div class="fu-m-sessions">
          <div class="fu-bar" aria-label="${done} of 9 sessions done">${Array.from({ length: 9 }, (_, k) => `<i class="${k < done ? "is-done" : k === 0 ? "is-today" : ""}"></i>`).join("")}</div>
          <p><b>${done} of 9 sessions done</b></p>
          <p class="cl-quiet">Prescribed by the emergency department, Bois-Cerf</p>
        </div>
        <ol class="cl-list">
          <li class="cl-item is-next">
            <div class="cl-when">Next</div>
            <div class="cl-body">
              <h3><i class="cl-dot is-next" aria-hidden="true"></i>Session 2 of 9</h3>
              <p class="cl-quiet">Not booked yet</p>
              <p class="cl-quiet">After session 9 · final report to the GP</p>
            </div>
          </li>
          <li class="cl-item">
            <div class="cl-when">Today<span>${C.signed ? C.signed.at : "in progress"}</span></div>
            <div class="cl-body">
              <h3><i class="cl-dot is-session" aria-hidden="true"></i>Session 1 · initial assessment <span class="cl-quiet">· ${attendance.toLowerCase()}</span></h3>
              ${kept.length ? `<ol class="fu-m-goals">${kept.map((g) => `<li><span>${g.goal}</span><span class="cl-quiet">set today</span></li>`).join("")}</ol>` : `<p class="cl-quiet">Goals not set yet</p>`}
              <p class="cl-line"><i class="cl-dot ${C.signed ? "is-ok" : "is-wait"}" aria-hidden="true"></i>${C.signed ? `Report sent to Dr Favre, GP · ${C.signed.at}` : "Report not signed yet"}</p>
              ${asked.length ? `<p>${asked.map((q) => `${q.label}: ${q.answer.toLowerCase()}`).join(" · ")} <span class="cl-mark">Physio, in session</span></p>` : ""}
              ${jots.length ? `<p class="cl-quiet">${jots.length} timed note${jots.length > 1 ? "s" : ""}</p>` : ""}
              <p class="cl-quiet fu-m-by">Lena Keller · ${C.signed ? "validated and signed" : C.changedAfterSign ? "changed after signing" : "in progress"}</p>
              <div class="fu-m-actions"><button type="button" class="fu-m-btn" data-go="report">${C.signed ? "View the report" : "Finish the report"}</button><button type="button" class="fu-m-btn" data-go="consultation">Open the consultation</button></div>
            </div>
          </li>
          <li class="cl-item is-before">
            <div class="cl-when">Sunday<span>1 Nov</span></div>
            <div class="cl-body">
              <h3><i class="cl-dot is-prep" aria-hidden="true"></i>Preparation received</h3>
              <p class="cl-quiet">Her summary and 2 documents</p>
              <div class="fu-m-actions"><button type="button" class="fu-m-btn" data-go="summary">View the summary</button></div>
            </div>
          </li>
        </ol>
      </div>`;
      wireGo(box);
      return;
    }
    box.innerHTML = pageBar("Follow-up", `Session 1 of 9 · ${C.signed ? "done today" : "today, in progress"}`) + `
      <div class="pg-main">
        <ol class="cl-list">
          <li class="cl-item">
            <div class="cl-when">Today<span>${C.signed ? C.signed.at : "in progress"}</span></div>
            <div class="cl-body">
              <h3><i class="cl-dot is-session" aria-hidden="true"></i>Session 1 of 9 · initial assessment <span class="cl-quiet">· ${attendance.toLowerCase()}</span></h3>
              <p>${kept.length ? `${kept.length} goal${kept.length > 1 ? "s" : ""} set` : `<span class="cl-quiet">Goals not set yet</span>`}</p>
              <p class="cl-line"><i class="cl-dot ${C.signed ? "is-ok" : "is-wait"}" aria-hidden="true"></i>${C.signed ? `Report sent to Dr Favre, GP · ${C.signed.at}` : "Report not signed yet"}
                · <button type="button" data-go="report">${C.signed ? "view the report" : "finish it"}</button></p>
              ${asked.length ? `<p>${asked.map((q) => `${q.label}: ${q.answer.toLowerCase()}`).join(" · ")} <span class="cl-mark">Physio, in session</span></p>` : ""}
              ${jots.length ? `<p class="cl-quiet">${jots.length} timed note${jots.length > 1 ? "s" : ""}</p>` : ""}
              <p class="cl-sign"><span>Lena Keller · ${C.signed ? "assessment validated and signed" : C.changedAfterSign ? "changed after signing, to sign again" : "in progress"}</span><button type="button" data-go="consultation">Open the consultation</button></p>
            </div>
          </li>
          <li class="cl-item is-before">
            <div class="cl-when">Sunday<span>1 Nov</span></div>
            <div class="cl-body">
              <h3><i class="cl-dot is-prep" aria-hidden="true"></i>Preparation received</h3>
              <p class="cl-quiet">Her summary and 2 documents · <button type="button" data-go="summary">view the summary</button></p>
            </div>
          </li>
        </ol>
      </div>
      <aside class="pg-side">
        <h4><svg class="i" aria-hidden="true"><use href="#i-calendar"/></svg>Sessions</h4>
        <div class="fu-bar" aria-label="${done} of 9 sessions done">${Array.from({ length: 9 }, (_, k) => `<i class="${k < done ? "is-done" : k === 0 ? "is-today" : ""}"></i>`).join("")}</div>
        <p class="fu-strong">${done} of 9 done${done ? "" : " · session 1 today"}</p>
        <p class="fu-sub">Prescribed by the emergency department, Clinique Bois-Cerf</p>
        <h4><svg class="i" aria-hidden="true"><use href="#i-flag"/></svg>Goals of the initial assessment</h4>
        ${kept.length ? `<ol class="fu-side-goals">${kept.map((g) => `<li><span>${g.goal}</span><span class="fu-sub">0 sessions</span></li>`).join("")}</ol>
          <p class="fu-foot">Sessions where the goal was worked on, from the session notes</p>` : `<p class="fu-sub">Not set yet</p>`}
        ${C.signed ? `<h4><svg class="i" aria-hidden="true"><use href="#i-send"/></svg>Sent to other carers</h4>
          <p class="fu-row"><span>Initial assessment report</span><span class="fu-sub">GP · today ${C.signed.at}</span></p>` : ""}
        <h4><svg class="i" aria-hidden="true"><use href="#i-clock"/></svg>Still to come</h4>
        <p class="fu-row"><span>Session 2</span><span class="fu-sub">not booked yet</span></p>
        <p class="fu-row"><span>Final report to the GP</span><span class="fu-sub">after session 9</span></p>
      </aside>`;
    wireGo(box);
  }
  function wireGo(box) {
    box.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
      const g = b.dataset.go;
      if (g === "report") { setPage("consultation"); setTimeout(() => openReport(true), 450); }
      else setPage(g);
    }));
  }

  /* Documents: only what really exists in her record, plus what the practice created */
  let docSel = "emergency", docFilter = "all", reminded = null, docSheet = false;
  function docList() {
    const emer = byId.get("emergency").media, heds = byId.get("heds").media;
    return [
      { id: "emergency", group: "shared", name: "Foot X-ray · 2 views", type: "Imaging", from: "Emergency, Clinique Bois-Cerf", added: "1 Nov 2026", images: emer.images,
        meta: [["From", "Emergency, Clinique Bois-Cerf"], ["Shared by", "Her, in the preparation"], ["Added", "1 November 2026"], ["Used in", "Summary · “X-ray: no fracture”"], ["Seen by", "The practice"]] },
      { id: "heds", group: "shared", name: "Medical report · hypermobile Ehlers-Danlos", type: "Medical report", from: "GP", added: "1 Nov 2026", images: heds.images, file: heds.file,
        meta: [["From", "GP"], ["Shared by", "Her, in the preparation"], ["Added", "1 November 2026"], ["Used in", "Know before the session · Assessment › Joints, Balance"], ["Seen by", "The practice"]] },
      { id: "report", group: "practice", name: "Initial assessment report", type: "Report", from: C.signed ? `GP · sent today ${C.signed.at}` : "Not sent yet",
        by: `Lena Keller · ${C.signed ? "signed" : "draft"}`, added: "Today",
        meta: [["Written by", "Lena Keller, physiotherapist"], ["State", C.signed ? `Signed and sent · ${C.signed.at}` : "Draft, not signed"], ["Shared with", C.signed ? "Dr Favre, GP" : "Nobody yet"], ["Seen by", "The practice"]] },
      ...(jots.length ? [{ id: "notes", group: "practice", name: "Session 1 notes", type: "Session notes", from: "Practice only", by: `${jots.length} timed note${jots.length > 1 ? "s" : ""}`, added: "Today",
        meta: [["Written by", "Lena Keller, physiotherapist"], ["Shared with", "Nobody · practice only"], ["Also in", "Follow-up"]] }] : []),
    ];
  }
  /* Documents: the prints you know from the summary, slightly turned, one per document; the awaited one is a dashed gap */
  function renderDocuments() {
    const box = $("#documents"), docs = docList();
    if (docSel !== "waiting" && !docs.find((d) => d.id === docSel)) docSel = docs[0].id;
    const shared = docs.filter((d) => d.group === "shared"), practice = docs.filter((d) => d.group === "practice");
    const face = (d) => d.images ? `<img src="${d.images[0].src}" alt="">`
      : `<span class="pr-paper"><b>${d.id === "report" ? "Initial assessment" : "Session 1 notes"}</b><i></i><i></i><i></i><i></i>${d.id === "report" && C.signed ? "<em>signed</em>" : ""}</span>`;
    let turn = 0;
    const print = (d) => { const r = [-4, 3, -2, 4, -3][turn++ % 5]; return `
      <button type="button" class="pr-item${d.id === docSel ? " is-sel" : ""}" data-doc="${d.id}" style="--r:${r}deg">
        <span class="pr-face${d.images ? " is-img" : ""}${d.id === "report" ? " is-report" : ""}">${face(d)}</span>
        <span class="pr-name">${d.name}</span><span class="pr-from">${d.from}</span>
      </button>`; };
    const waitSel = docSel === "waiting";
    const sel = waitSel ? null : docs.find((d) => d.id === docSel);
    box.innerHTML = pageBar("Documents", `${docs.length} documents · 1 awaited`) + `
      <div class="pg-main">
        <section class="pr-group"><h3>From her <span>· shared in her preparation</span></h3><div class="prints-row">${shared.map(print).join("")}</div></section>
        <section class="pr-group"><h3>From the practice <span>· who it went to</span></h3><div class="prints-row">${practice.map(print).join("")}</div></section>
        <section class="pr-group"><h3>Awaited</h3><div class="prints-row">
          <button type="button" class="pr-item is-wait${waitSel ? " is-sel" : ""}" data-doc="waiting" style="--r:-2deg"><span class="pr-face is-gap"><i aria-hidden="true"></i></span>
            <span class="pr-name">Insurer’s letter on cover</span><span class="pr-from">${reminded ? `reminder sent · ${reminded}` : "she said “not yet”"}</span></button></div></section>
      </div>
      <aside class="pg-side doc-preview" aria-live="polite">${waitSel ? `
        <h3>Insurer’s letter on cover</h3>
        <div class="pr-face is-gap is-large"><i aria-hidden="true"></i></div>
        <dl class="doc-meta"><dt>From</dt><dd>Her accident insurer</dd><dt>State</dt><dd>Not received yet</dd><dt>Her answer</dt><dd>“Not yet”, in her preparation</dd></dl>
        <div class="doc-actions"><button type="button" class="pg-chip" data-remind ${reminded ? "disabled" : ""}>${reminded ? `Reminder sent · ${reminded}` : "Remind her"}</button></div>` : `
        <h3>${sel.name}</h3>
        ${sel.images ? `<div class="dp-imgs">${sel.images.map((im) => `<img src="${im.src}" alt="${im.alt || ""}">`).join("")}</div>`
          : `<div class="doc-paper"><b>${sel.name}</b>${sel.id === "report" ? "<span>Reason and history · Assessment · Goals · Notes · Conclusion · Recommendations</span>" : `<span>${jots.slice(0, 3).map((jt) => `${jt.time} ${jt.text.replace(/</g, "&lt;")}`).join("<br>")}</span>`}</div>`}
        <dl class="doc-meta">${sel.meta.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
        <div class="doc-actions">${sel.images ? `<button type="button" class="pg-chip" data-view>View large</button>` : ""}
          ${sel.file ? `<a class="pg-chip" href="${sel.file.href}" target="_blank" rel="noopener">Open the PDF ↗</a>` : ""}
          ${sel.id === "report" ? `<button type="button" class="pg-chip" data-go="report">Open the report</button>` : ""}
          ${sel.id === "notes" ? `<button type="button" class="pg-chip" data-go="consultation">Open the notes</button>` : ""}</div>`}
      </aside>`;
    box.querySelectorAll(".pr-item").forEach((b) => b.addEventListener("click", () => { docSel = b.dataset.doc; docSheet = true; renderDocuments(); }));
    const pv = box.querySelector(".doc-preview");
    pv.classList.toggle("is-open", docSheet);
    // phone: the details sheet is gone until a print is tapped; Done, a tap outside or Esc puts it away
    const closeSheet = () => { docSheet = false; pv.classList.remove("is-open"); };
    const done = document.createElement("button");
    done.type = "button"; done.className = "dp-done"; done.textContent = "Done";
    done.addEventListener("click", closeSheet);
    pv.prepend(done);
    if (!box.dataset.sheetWired) {
      box.dataset.sheetWired = "1";
      box.addEventListener("click", (e) => { if (docSheet && !e.target.closest(".doc-preview, .pr-item")) { docSheet = false; box.querySelector(".doc-preview").classList.remove("is-open"); } });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && docSheet) { docSheet = false; box.querySelector(".doc-preview").classList.remove("is-open"); } });
    }
    box.querySelector("[data-view]")?.addEventListener("click", (e) => openDoc(docSel, e.currentTarget));
    box.querySelector("[data-remind]")?.addEventListener("click", () => { reminded = hm(); renderDocuments(); });
    wireGo(box);
  }

  restoreConsult();
  buildConsult();
  restoreConsultFields();
  startBtn.addEventListener("click", () => {
    if (aux) { setPage("consultation"); if (C.signed) setTimeout(() => openReport(true), 450); return; }
    if (consulting) openReport(true);
    else { setConsult(true); if (C.signed) setTimeout(() => openReport(true), 450); }   // done: straight to the signed report
  });
  consult.querySelector(".c-dictate").addEventListener("click", () => setDictation(!dictating));
  $("#dict-stop").addEventListener("click", () => setDictation(false));
  veil.addEventListener("click", () => { if (reportOpen) openReport(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && reportOpen) { e.stopImmediatePropagation(); openReport(false); } }, true);
  consult.querySelector("[data-to-summary]").addEventListener("click", () => setPage("summary"));
  document.querySelectorAll(".page[data-page]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    setPage(a.dataset.page);
  }));
  window.addEventListener("popstate", () => {
    const p = { "#consultation": "consultation", "#follow-up": "followup", "#documents": "documents" }[location.hash] || "summary";
    setPage(p, false);
  });

  /* ---------------- start ---------------- */

  buildIndex();
  // a refresh always starts from the overview: the first view grows out of Camille, then stays still
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  select(null);
  const cs = cameraTarget(layout(state.current).L);
  cam.x = cs.x; cam.y = cs.y;
})();
