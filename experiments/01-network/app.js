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
  const half = (n) => (n.kind === "person" ? 17 : n.kind === "section" ? 13 : 8);

  R.nodes.forEach((n) => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = ["node", `kind-${n.kind}`, n.source && `src-${n.source}`, n.mark && `mark-${n.mark}`].filter(Boolean).join(" ");
    el.dataset.id = n.id;
    const shape = n.kind === "section" ? `${HEX}<b>${n.n}</b>` : n.kind === "person" ? STAR : "";
    el.innerHTML = `<span class="shape">${shape}</span>
      <span class="label"><span class="title">${n.label}</span><span class="sub">${n.sub || ""}</span></span>`;
    el.setAttribute("aria-label", `${n.label}. ${n.sub || ""}`);
    el.addEventListener("click", () => go(n.kind === "person" ? null : n.id));
    el.addEventListener("mouseenter", () => hintRow(n.id, true));
    el.addEventListener("mouseleave", () => hintRow(n.id, false));
    layer.appendChild(el);
    n.el = el;
    n.p = { x: 0, y: 0, vx: 0, vy: 0, o: 0 };   // drawn state
    n.t = { x: 0, y: 0, o: 0 };                 // target
    n.release = 0;                              // when it starts moving to its target
    n.m = { x: 0, y: 0, vx: 0, vy: 0 };         // magnetic offset toward the cursor
  });

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
      Object.assign(L, fan(kids(c.id).map((k) => k.id), a, 270, 195, 40, 200));
      return { L, focus: c.id, angle: a };
    }

    // an item: its path back to Camille behind it, what it relates to in front
    const parent = c.parent && byId.get(c.parent);
    const a = parent ? ANGLE[parent.id] : state.lastAngle;
    L[c.id] = { x: 0, y: 0 };
    if (parent) {
      L[parent.id] = polar(a + 180, 220, 150);
      L.camille = polar(a + 180, 440, 300);
    } else {
      L.camille = polar(a + 180, 260, 180);
    }
    const front = [...related.get(c.id)].filter((id) => !(id in L));
    Object.assign(L, fan(front, a, 270, 190, 42, 220));
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
    return {
      x: m.width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2,
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

  function select(id, instant = false) {
    if (id && !byId.has(id)) id = null;
    state.current = id;
    if (id) state.visited.add(id);
    renderIndexState();
    apply(instant);
  }

  window.addEventListener("popstate", () => select(location.hash.slice(1) || null));
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

    sources: (items) => items.map((n) => row(n, icon(n.icon))).join(""),
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
    indexBody.querySelectorAll(".row").forEach((r) => {
      r.addEventListener("click", () => go(r.dataset.id));
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
    const key = !c ? null : c.kind === "section" ? c.id : c.parent || "sources";
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

  /* ---------------- start ---------------- */

  buildIndex();
  // a refresh always starts from the overview: the first view grows out of Camille, then stays still
  if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  select(null);
  const cs = cameraTarget(layout(state.current).L);
  cam.x = cs.x; cam.y = cs.y;
})();
