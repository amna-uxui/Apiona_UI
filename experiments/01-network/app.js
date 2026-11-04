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
  const related = new Map(R.nodes.map((n) => [n.id, new Set(n.links || [])]));
  R.nodes.forEach((n) => (n.links || []).forEach((l) => related.get(l) && related.get(l).add(n.id)));

  const $ = (s) => document.querySelector(s);
  const map = $("#map"), world = $("#world"), svg = $("#lines"), layer = $("#nodes");
  const indexBody = $("#index-body"), indexToggle = $("#index-toggle");

  const state = { current: null, visited: new Set(), pan: { x: 0, y: 0 }, lastAngle: 0, cursor: null };

  /* ---------------- brief ---------------- */

  $("#p-name").textContent = R.patient.name;
  $("#p-meta").textContent = R.patient.meta;
  $("#p-occ").textContent = R.patient.occupation || "";
  $("#p-new").hidden = !R.patient.isNew;
  $("#p-new").title = "New patient";
  $("#p-brief").innerHTML = R.patient.brief.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  $("#p-tags").innerHTML = R.patient.tags.map((t) => `<li class="tag tag-${t.tone}">${t.text}</li>`).join("");

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
  const half = (n) => (n.kind === "person" ? 17 : n.kind === "section" ? 13 : n.folder ? 13 : 8);

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

  function layout(currentId) {
    const L = {};
    const c = currentId && byId.get(currentId);

    if (!c) {
      L.camille = { x: 0, y: 0 };
      sections.forEach((s) => (L[s.id] = polar(ANGLE[s.id], 260, 185)));
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

  function cameraTarget(L) {
    const pts = Object.values(L);
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const m = map.getBoundingClientRect();
    const top = $(".brief").getBoundingClientRect().bottom + 30;
    const bottom = m.height - 40;
    const room = m.width - (state.profile ? 170 : mediaWidth(state.current && byId.get(state.current)));   // prints or her photo take the right of the map
    const centred = room / 2 - (Math.min(...xs) + Math.max(...xs)) / 2;
    return {
      x: Math.max(centred, 120 - Math.min(...xs)),   // never push a label past the left edge
      y: (top + bottom) / 2 - (Math.min(...ys) + Math.max(...ys) + 40) / 2,   // labels hang below
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
  const at = (n) => ({ x: n.p.x + n.m.x, y: n.p.y + n.m.y });

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

    draw();
    if (moving) requestAnimationFrame(tick);
    else running = false;
  }

  /* ---------------- drawing ---------------- */

  function elbow(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const j = Math.min(Math.abs(b.x - a.x) * 0.14, 16) * Math.sign(b.x - a.x || 1);
    return `M${a.x},${a.y} L${mx - j},${my} L${mx + j},${my} L${b.x},${b.y}`;
  }

  function draw() {
    let out = "";
    // in an item view only its own path is drawn solid; everything else it relates to is dotted
    const c = state.current && byId.get(state.current);
    const path = c && c.kind === "item" ? new Set([c.id, c.parent]) : null;
    R.nodes.forEach((n) => {
      if (!n.parent || n.p.o <= 0.01) return;
      if (path && !path.has(n.id) && n.t.o > 0) return;
      const p = byId.get(n.parent);
      if (p.p.o <= 0.01) return;
      out += `<path class="${n.mark === "missing" ? "dashed" : ""}" style="opacity:${Math.min(n.p.o, p.p.o)}" d="${elbow(at(p), at(n))}"/>`;
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
    world.style.transform = `translate(${cam.x + state.pan.x}px, ${cam.y + state.pan.y}px)`;
  }

  /* ---------------- navigation ---------------- */

  const back = (n) => (n && n.parent && n.parent !== "camille" ? n.parent : null);

  // A click, on the map or in the index, moves the map. The index stays as it is: no detail card.
  function go(id) {
    const hash = id ? `#${id}` : "";
    if (location.hash !== hash) history.pushState(null, "", hash || location.pathname);
    select(id);
  }

  // Her details open at the top of the index; her photo slides in behind the index, like the reference's images
  function setProfile(on) {
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
    if (id && state.profile) { state.profile = false; byId.get("camille").el.classList.remove("is-profile"); $("#portrait").classList.remove("is-in"); }
    state.current = id;
    if (id) state.visited.add(id);
    renderIndexState();
    renderMedia();
    apply(instant);
  }

  window.addEventListener("popstate", () => { if (location.hash !== "#consultation") select(location.hash.slice(1) || null); });
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

  const bodyFor = {

    know: (items) => {
      const points = items.filter((n) => n.id !== "treatments");
      const treat = items.find((n) => n.id === "treatments");
      return `
        ${points.map((n) => row(n, icon(n.icon))).join("")}
        ${treat ? row(treat, icon(treat.icon)) : ""}
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

    hurts: (items) => `
      <div class="body-map">
        <div class="figure" id="figure">
          <svg class="markers" viewBox="0 -10 201 471" aria-hidden="true">
            ${items.map((n) => `<g class="marker tone-${n.tone}" data-for="${n.id}" transform="translate(${n.spot[0]} ${n.spot[1]})">
              <circle class="halo" r="13"/><circle class="core" r="6"/></g>`).join("")}
          </svg>
        </div>
        <div class="body-list">${items.map((n) => row(n, `<i class="pain-dot tone-${n.tone}"></i>`, n.label, n.quote)).join("")}</div>
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
    const key = !c ? (state.profile ? "sources" : null) : c.kind === "section" ? c.id : c.parent || "sources";
    indexBody.querySelectorAll(".sec-head").forEach((b) => {
      const open = b.getAttribute("aria-controls") === `sec-${key}`;
      b.setAttribute("aria-expanded", open);
      b.classList.toggle("is-current", open);
      document.getElementById(b.getAttribute("aria-controls")).hidden = !open;
    });
  }

  function setIndexOpen(open) {
    indexToggle.setAttribute("aria-expanded", open);
    indexBody.hidden = !open;
  }
  indexToggle.addEventListener("click", () => setIndexOpen(indexBody.hidden));

  function hintNode(id, on) { byId.get(id).el.classList.toggle("is-hint", on); }
  function hintRow(id, on) {
    indexBody.querySelectorAll(`.row[data-id="${id}"]:not([data-doc]), .marker[data-for="${id}"]`).forEach((r) => r.classList.toggle("is-hover", on));
  }

  /* ---------------- media: a pile of prints ---------------- */

  // Like the reference: when a record has images, they arrive as overlapping prints beside the network,
  // one after another, and leave when you move on. Hover or click brings a print to the front.
  const media = $("#media");
  // the room the prints take on the right: a loose pile of films, or a tight stack of paper pages
  const mediaWidth = (n) => (n && n.media ? (n.media.fan ? 340 : n.media.kind === "paper" ? 230 : 310) : 0);
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
  veil.addEventListener("click", () => setViewing(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && viewing) { e.stopImmediatePropagation(); setViewing(false); } }, true);
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
    $("#c-steps").innerHTML = C.steps.map((st) => `
      <li><button class="c-step state-${st.state}" data-step="${st.id}" type="button">
        <span class="c-n">${st.n}</span>${st.label}<i class="c-state" aria-hidden="true"></i></button></li>`).join("");
    $("#c-sections").innerHTML = C.steps.map((st, i) => `
      <article class="c-sec reveal ${i === 0 ? "is-open" : ""}" style="--d:${3 + i}" id="cs-${st.id}">
        <button class="c-sec-head" type="button" aria-expanded="${i === 0}">
          <span class="c-n">${st.n}</span><span class="c-sec-title">${st.label}</span>
          <span class="c-sec-note">${st.state === "review" ? st.note : `${st.note ? st.note + " · " : ""}empty`}</span>
          <span class="chev" aria-hidden="true"></span>
        </button>
        <div class="c-sec-body">${st.id === "assessment" ? `<div class="assess" id="assess"></div>` : st.text
          ? `<textarea rows="7" aria-label="${st.label}">${st.text}</textarea>`
          : `<textarea rows="3" aria-label="${st.label}" placeholder="Write here, or dictate…"></textarea>`}</div>
      </article>`).join("");

    buildAssessment();
    const open = (sec, on) => { sec.classList.toggle("is-open", on); sec.querySelector(".c-sec-head").setAttribute("aria-expanded", on); };
    consult.querySelectorAll(".c-sec-head").forEach((h) => h.addEventListener("click", () => open(h.parentElement, !h.parentElement.classList.contains("is-open"))));
    consult.querySelectorAll(".c-step").forEach((b) => b.addEventListener("click", () => {
      const sec = document.getElementById(`cs-${b.dataset.step}`);
      open(sec, true);
      sec.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }));
    // segmented choices: one on at a time
    consult.querySelectorAll(".seg").forEach((g) => g.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      g.querySelectorAll("button").forEach((x) => { x.classList.toggle("is-on", x === b); x.setAttribute("aria-checked", x === b); });
    })));
  }

  /* Assessment by area: tabs for the areas; for each, what the record says (by the practice's rules),
     a small table of tests to fill in, and free notes. What you type is kept when you switch areas. */
  let areaId = "balance";
  const esc = (v) => String(v || "").replace(/"/g, "&quot;");

  function buildAssessment() {
    const box = $("#assess");
    box.innerHTML = `
      <div class="as-tabs" role="tablist">${C.areas.map((a) => `
        <button role="tab" type="button" class="as-tab" data-area="${a.id}" aria-selected="${a.id === areaId}">
          <span class="as-tab-name">${a.label}</span><span class="as-tab-sub">${a.sub}</span></button>`).join("")}
      </div>
      <div class="as-panel" id="as-panel"></div>`;
    box.querySelectorAll(".as-tab").forEach((t) => t.addEventListener("click", () => {
      areaId = t.dataset.area;
      box.querySelectorAll(".as-tab").forEach((x) => x.setAttribute("aria-selected", x === t));
      renderArea();
    }));
    renderArea();
  }

  function renderArea() {
    const a = C.areas.find((x) => x.id === areaId);
    const panel = $("#as-panel");
    panel.classList.remove("is-in");
    panel.innerHTML = `
      <div class="as-record">
        <p class="as-record-head"><i class="sw know"></i>From the record for this area</p>
        ${a.record.length ? a.record.map((x) => `<p class="as-fact">${x.text}<span>${x.src}</span></p>`).join("")
          + `<p class="as-rule">Your practice’s rule · ${a.rule} · text taken from the record</p>`
          : `<p class="as-none">Nothing highlighted by your rules for this area.</p>`}
      </div>
      <table class="as-tests">
        <thead><tr><th>Test</th><th>Side</th><th>Result</th><th>Reference / other side</th><th aria-label="Remove"></th></tr></thead>
        <tbody>${a.tests.map((t, i) => `
          <tr data-i="${i}">
            <td><input data-k="test" value="${esc(t.test)}" aria-label="Test"></td>
            <td><select data-k="side" aria-label="Side">${C.sides.map((sd) => `<option${sd === t.side ? " selected" : ""}>${sd}</option>`).join("")}</select></td>
            <td><input data-k="result" value="${esc(t.result)}" placeholder="result" aria-label="Result"></td>
            <td><input data-k="ref" value="${esc(t.ref)}" placeholder="reference" aria-label="Reference or other side"></td>
            <td><button class="as-del" type="button" aria-label="Remove this test">×</button></td>
          </tr>`).join("")}
        </tbody>
      </table>
      <button class="as-add" type="button">+ Add a test</button>
      <textarea class="as-notes" rows="3" placeholder="Specific tests and free remarks for ${a.label.toLowerCase()}…" aria-label="Notes for ${a.label}">${a.notes || ""}</textarea>`;
    panel.querySelectorAll("tbody tr").forEach((tr) => {
      const t = a.tests[+tr.dataset.i];
      tr.querySelectorAll("[data-k]").forEach((f) => f.addEventListener("input", () => { t[f.dataset.k] = f.value; }));
      tr.querySelector(".as-del").addEventListener("click", () => { a.tests.splice(+tr.dataset.i, 1); renderArea(); });
    });
    panel.querySelector(".as-add").addEventListener("click", () => {
      a.tests.push({ test: "", side: "Both sides" });
      renderArea();
      const rows = panel.querySelectorAll("tbody tr");
      rows[rows.length - 1].querySelector("input").focus();
    });
    panel.querySelector(".as-notes").addEventListener("input", (e) => { a.notes = e.target.value; });
    requestAnimationFrame(() => panel.classList.add("is-in"));
  }

  function tickClock() {
    const t = Math.floor((Date.now() - startedAt) / 1000);
    $("#c-clock").textContent = `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function setConsult(on, push = true) {
    if (on === consulting) return;
    consulting = on;
    if (on && viewing) setViewing(false);
    if (on && state.current) select(null);
    document.body.classList.toggle("is-consult", on);
    clearTimeout(hideTimer);
    if (on) {
      consult.hidden = false;
      consult.scrollTop = 0;
      requestAnimationFrame(() => requestAnimationFrame(() => consult.classList.add("is-in")));
      startedAt = Date.now(); tickClock(); clockTimer = setInterval(tickClock, 1000);
    } else {
      consult.classList.remove("is-in");
      hideTimer = setTimeout(() => { consult.hidden = true; }, 500);
      clearInterval(clockTimer);
    }
    // the menu follows
    document.querySelectorAll(".page[data-page]").forEach((a) => {
      const here = a.dataset.page === (on ? "consultation" : "summary");
      a.classList.toggle("is-current", here);
      a.classList.toggle("is-live", here && on);
      if (here) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    // the green button becomes the next step of the visit
    startBtn.querySelector("span").textContent = on ? "Finish and prepare the report" : "Start consultation";
    if (push) history.pushState(null, "", on ? "#consultation" : location.pathname + location.search);
  }

  buildConsult();
  startBtn.addEventListener("click", () => { if (!consulting) setConsult(true); });
  consult.querySelector("[data-to-summary]").addEventListener("click", () => setConsult(false));
  document.querySelectorAll(".page[data-page]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    setConsult(a.dataset.page === "consultation");
  }));
  window.addEventListener("popstate", () => {
    if (location.hash === "#consultation") setConsult(true, false);
    else if (consulting) setConsult(false, false);
  });

  /* ---------------- start ---------------- */

  buildIndex();
  // a refresh always starts from the overview: the first view grows out of Camille, then stays still
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  select(null);
  const cs = cameraTarget(layout(state.current).L);
  cam.x = cs.x; cam.y = cs.y;
})();
