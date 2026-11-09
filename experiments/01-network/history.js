/*
  Her history: a second layer under the summary, after the reference of a browsing history drawn as a spiral.
  One hand-drawn line of time unwinds from her first record (centre) to today (edge). The events are words
  written on the line, coloured by who wrote them; no dots. A key finding sits off the line in a circle that
  holds what it explains. The line grows; the words and circles appear as it reaches them.
*/
(function () {
  const H = window.RECORD.history;
  if (!H) return;
  const $ = (s) => document.querySelector(s);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
  const FROM = { her: "From her", clinician: "Clinician", dismissed: "Ended without a diagnosis", you: "This practice" };
  const evById = Object.fromEntries(H.events.map((e) => [e.id, e]));
  const branchOf = (e) => H.branches.find((b) => b.id === e.branch);
  const clusters = H.clusters || {};
  const inCluster = {};   // child id → the finding it belongs to
  Object.entries(clusters).forEach(([k, kids]) => kids.forEach((c) => (inCluster[c] = k)));
  // drawn by hand: a loop that is never quite round and overshoots where it closes; a line that wavers a little
  function sketchCircle(cx, cy, r, seed = 0) {
    const pts = [], start = seed * 1.7, turn = Math.PI * 2 + 0.35;
    for (let k = 0; k <= 36; k++) {
      const a = start + (turn * k) / 36;
      const rr = r * (1 + Math.sin(a * 3 + seed) * 0.055 + Math.sin(a * 5 + seed * 2.1) * 0.03) + (k / 36) * r * 0.06;
      pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }
  function sketchLine(x1, y1, x2, y2, bend = 0, seed = 0) {
    const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, pts = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16, w = Math.sin(t * Math.PI) * bend + Math.sin(t * 9 + seed) * 1.1 * Math.sin(t * Math.PI);
      pts.push(`${(x1 + dx * t + nx * w).toFixed(1)},${(y1 + dy * t + ny * w).toFixed(1)}`);
    }
    return "M" + pts.join(" L");
  }
  function docsOf(e) {
    if (e.doc) return { caption: e.doc.caption, paper: !e.doc.images, pages: e.doc.images || [{ drawn: e.doc.page }] };   // the one document that goes with this finding
    if (!e.docs && !e.images) return null;
    const node = e.media && window.RECORD.nodes.find((n) => n.id === e.media);
    if (node && node.media) return { caption: node.media.caption, paper: node.media.kind === "paper", pages: node.media.images.map((im) => ({ src: im.src, alt: im.alt })) };
    if (e.images) return { caption: `${e.title} · X-ray · ${branchOf(e).who}`, paper: false, pages: e.images };
    const who = branchOf(e).who;
    return { caption: `${e.title} · ${who}`, paper: true, pages: Array.from({ length: e.docs }, (_, i) => ({ drawn: { type: i ? "Attachment" : "Report", title: e.title, from: `${who} · ${e.year}` } })) };
  }
  const page = (p, big) => p.src ? `<img src="${p.src}" alt="${p.alt}">`
    : `<span class="drawn-page${big ? " is-big" : ""}"><span class="dp-type">${p.drawn.type}</span><span class="dp-title">${p.drawn.title}</span><span class="dp-from">${p.drawn.from}</span><span class="dp-lines">${"<i></i>".repeat(big ? 14 : 6)}</span></span>`;
  const onLine = H.events.filter((e) => !clusters[e.id]);   // every incident is written along the spiral, in time order (findings have their circle)

  /* ---------- the switch and the year slider ---------- */
  const bar = document.createElement("div");
  bar.className = "hist-bar";
  bar.innerHTML = `
    <div class="hist-seg" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked="true" data-v="today" class="is-on">Today</button>
      <button type="button" role="radio" aria-checked="false" data-v="history">Her history</button>
    </div>
    <button type="button" class="hist-play" aria-label="Grow her history again" title="Grow it again" hidden>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"/></svg></button>`;
  $(".stage").appendChild(bar);

  const count = (f) => H.events.filter((e) => e.from === f).length;
  const garden = document.createElement("section");
  garden.className = "garden";
  garden.setAttribute("aria-label", "Her history as a spiral, from her first record to today");
  garden.hidden = true;
  garden.innerHTML = `<svg class="g-svg"></svg>
`;
  $(".stage").appendChild(garden);
  const svg = garden.querySelector("svg");

  // the index beside it: closed, only the specialties; one opens when you choose one of its events
  const list = document.createElement("section");
  list.className = "panel hist-index";
  list.hidden = true;
  list.innerHTML = `<p class="hist-head"><i class="head-icon"></i><span>Her history</span><span class="hist-count"></span></p>
    <p class="hist-hint">Click any word on the spiral to read its details here.</p>
    <ul class="hist-key" aria-label="Key"><li><i class="k-her"></i>Told by her</li><li><i class="k-dis"></i>No diagnosis</li><li><i class="k-you"></i>Today</li></ul>
    <div class="hist-body">${H.branches.map((b) => {
      const evs = H.events.filter((e) => e.branch === b.id).sort((a, c) => a.year - c.year);
      return `<div class="hb-sec"><button type="button" class="hb-name" data-b="${b.id}" aria-pressed="false">${b.label}<span class="hb-n">${evs.length}</span></button>
        ${evs.map((e) => `<button type="button" class="h-row from-${e.from}" data-ev="${e.id}">
          <span class="h-year">${e.year}</span><span class="h-mark" aria-hidden="true"></span>
          <span class="h-text"><span class="h-title">${e.title}</span>
            <span class="h-more"><span class="h-note">${e.note}</span>${clusters[e.id] ? `<span class="h-rel">${{ h16: "Led to", h9: "Followed by" }[e.id] || "Explains"}: ${clusters[e.id].map((k) => `${evById[k].title.charAt(0).toLowerCase() + evById[k].title.slice(1)} (${evById[k].year})`).join(", ")}.</span>` : ""}<span class="h-meta">${FROM[e.from]}${e.docs ? ` · ${e.docs} document${e.docs > 1 ? "s" : ""}` : ""}</span></span></span></button>`).join("")}</div>`;
    }).join("")}</div>`;
  $(".side").appendChild(list);

  const viewer = document.createElement("div");
  viewer.className = "h-viewer";
  viewer.hidden = true;
  viewer.setAttribute("role", "dialog");
  viewer.setAttribute("aria-label", "Document");
  $(".stage").appendChild(viewer);
  function openDocs(id) {
    const d = docsOf(evById[id]); if (!d) return;
    viewer.innerHTML = `<div class="hv-pages">${d.pages.map((p, i) => `<figure class="hv-page${d.paper ? " is-paper" : ""}" style="--i:${i}">${page(p, true)}</figure>`).join("")}</div>
      <p class="hv-cap">${d.caption}<span>Click anywhere or press Esc to put ${d.pages.length > 1 ? "them" : "it"} back</span></p>`;
    viewer.hidden = false; void viewer.offsetWidth; viewer.classList.add("is-in");
  }
  function closeDocs() { viewer.classList.remove("is-in"); setTimeout(() => { if (!viewer.classList.contains("is-in")) viewer.hidden = true; }, 350); }
  viewer.addEventListener("click", closeDocs);
  addEventListener("keydown", (e) => { if (e.key === "Escape" && !viewer.hidden) closeDocs(); });
  // the chosen event's documents: a small pile of prints in the free corner of the view, as on the home screen
  const pile = document.createElement("button");
  pile.type = "button";
  pile.className = "h-pile";
  pile.hidden = true;
  $(".stage").appendChild(pile);   // to the left of the index, level with its top; the index itself never moves
  pile.addEventListener("click", () => openDocs(pile.dataset.ev));
  function showPile(id) {
    const d = id && docsOf(evById[id]);
    if (!d) { pile.classList.remove("is-in"); setTimeout(() => { if (!pile.classList.contains("is-in")) pile.hidden = true; }, 300); return; }
    pile.dataset.ev = id;
    pile.setAttribute("aria-label", `Open: ${d.caption}`);
    pile.innerHTML = `<span class="hp-prints">${d.pages.map((p, i) => `<span class="h-print${d.paper ? " is-paper" : ""}" style="--i:${i}">${page(p)}</span>`).join("")}</span>
      <span class="hp-text"><span class="hp-cap">${d.caption}</span><span class="hp-hint">Click to open</span></span>`;
    pile.hidden = false;

    void pile.offsetWidth; pile.classList.add("is-in");
  }

  /* ---------- the spiral ---------- */
  let G = null, current = null, branchOn = null, year = H.end;
  const TURNS = 2.2;
  const when = {};
  H.events.forEach((e) => {
    const same = H.events.filter((x) => x.year === e.year);
    when[e.id] = e.year + 0.05 + ((same.indexOf(e) + 1) / (same.length + 1)) * 0.9;
  });
  const tEnd = H.end + 0.95;
  year = tEnd;   // shown complete unless it is growing
  // how far along the line a moment sits: partly by time, partly by how much is written along the line by then
  const lineT = H.events.map((e) => when[e.id]).sort((a, b) => a - b);   // words and circle titles each get room
  const fracOf = (t) => {
    const time = Math.max(0, Math.min(1, (t - H.start) / (tEnd - H.start)));
    let k = 0; while (k < lineT.length && lineT[k] < t) k++;
    const lo = k ? lineT[k - 1] : H.start, hi = k < lineT.length ? lineT[k] : tEnd;
    const rank = (k + (hi > lo ? (t - lo) / (hi - lo) : 0)) / (lineT.length + 1);
    return Math.max(0, Math.min(1, time * 0.12 + rank * 0.88));
  };
  // drawn by hand: the radius wanders a little, slowly and unevenly
  const wobble = (a) => Math.sin(a * 2.1) * 3 + Math.sin(a * 5.3 + 1.2) * 1.4 + Math.sin(a * 11.7 + 0.4) * 0.6;
  function spiral() {
    const th = TURNS * 2 * Math.PI, b = (G.R - G.r0) / th, pts = [];
    let len = 0, prev = null;
    for (let k = 0; k <= 1000; k++) {
      const a = (th * k) / 1000, r = G.r0 + b * a + wobble(a) * Math.min(1, a / 2);
      const p = { x: G.cx + Math.cos(a - Math.PI / 2) * r, y: G.cy + Math.sin(a - Math.PI / 2) * r, a, r };
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
      p.s = len; pts.push(p); prev = p;
    }
    G.b = b;
    return pts;
  }
  function at(t) {
    const S = G.pts[G.pts.length - 1].s, target = S * fracOf(t);
    let lo = 0, hi = G.pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (G.pts[m].s < target) lo = m; else hi = m; }
    return { ...G.pts[hi], k: hi };
  }
  const pathTo = (t) => { const k = at(t).k, D = null; return "M" + G.pts.slice(0, k + 1).map((p, n) => [p, n]).filter(([, n]) => n % 3 === 0 || n === k)
    .map(([p, n]) => `${(p.x + (D ? D[n].x : 0)).toFixed(1)},${(p.y + (D ? D[n].y : 0)).toFixed(1)}`).join(" L"); };
  // the tangent at a point, so the words follow the line
  function tangent(k) {
    const a = G.pts[Math.max(0, k - 3)], b = G.pts[Math.min(G.pts.length - 1, k + 3)];
    let deg = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
    if (deg > 90) deg -= 180; if (deg < -90) deg += 180;   // never upside down
    return deg;
  }
  const words = (s, max = 22) => {   // a title on one line, or two balanced lines (split at the space nearest the middle)
    if (s.length <= max) return [s];
    let best = -1;
    for (let k = 0; k < s.length; k++) if (s[k] === " " && (best < 0 || Math.abs(k - s.length / 2) < Math.abs(best - s.length / 2))) best = k;
    return best > 0 ? [s.slice(0, best), s.slice(best + 1)] : [s];
  };

  function build() {
    const box = garden.getBoundingClientRect();
    // a strip on the right stays free for the report; the spiral sits left of it, leaving room around it for the circles
    const REPORT = box.width < 1100 ? 190 : 230, usable = box.width - REPORT;
    G = { cx: usable / 2, cy: box.height / 2, r0: 26, R: Math.max(150, Math.min(usable / 2 - 30, box.height / 2 - 34) * (box.width < 1100 ? 0.9 : 0.8)) };
    G.pts = spiral();
    G.disp = null;
    const gapR = G.b * 2 * Math.PI;   // distance between two turns
    svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);

    const lineEvents = onLine.map((e) => {
      const p = at(when[e.id]);
      const lines = words(e.title, 17);   // horizontal; a long title wraps onto a second line
      return `<g class="g-ev from-${e.from}" data-ev="${e.id}" data-b="${e.branch}" data-t="${when[e.id]}" tabindex="0" role="button" aria-label="${e.year}, ${branchOf(e).label}: ${e.title}"
          transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
          <text class="g-word" text-anchor="middle">${lines.map((l, i) => `<tspan x="0" dy="${i ? 18 : lines.length > 1 ? -4 : 5}">${l}</tspan>`).join("")}</text>
          <text class="g-when" text-anchor="middle" y="${lines.length > 1 ? -22 : -14}">${e.year}</text></g>`;
    }).join("");

    // each key finding: a circle off the line, holding the events it explains, tied to its place by a short stem.
    // It goes where there is the most free space, clear of the words' real outlines and of the other circles.
    const placed = [];
    const circlesHTML = (rects) => Object.entries(clusters).map(([id, kids]) => {
      const e = evById[id], p = at(when[id]);
      const ux = (p.x - G.cx) / p.r, uy = (p.y - G.cy) / p.r;
      // the circle must never touch the line: small enough to sit between two turns, and placed where it does
      const rad = 58;
      const toRect = (c, r) => Math.hypot(Math.max(r.x - c.x, 0, c.x - (r.x + r.w)), Math.max(r.y - c.y, 0, c.y - (r.y + r.h)));
      let best = null;
      // only outside the spiral: anywhere beyond its last turn, as close to the finding's title as possible
      for (let gx = rad + 8; gx <= box.width - rad - 8; gx += 12) for (let gy = rad + 8; gy <= box.height - rad - 8; gy += 12) {
        const c = { x: gx, y: gy }, dist = Math.hypot(c.x - p.x, c.y - p.y);
        if (Math.hypot(c.x - G.cx, c.y - G.cy) < G.R + rad + 16) continue;   // never inside the spiral
        let line = Infinity;
        for (let n = 0; n < G.pts.length; n += 2) { const q = G.pts[n]; line = Math.min(line, Math.hypot(q.x - c.x, q.y - c.y)); }
        if (line < rad + 9) continue;   // never across the spiral
        let free = Infinity;
        rects.forEach((r) => { free = Math.min(free, toRect(c, r) - rad - 8); });
        placed.forEach((o) => { free = Math.min(free, Math.hypot(o.x - c.x, o.y - c.y) - rad - o.r - 18); });
        if (free < 0) continue;   // never over a word or another circle
        const score = Math.min(free, 40) + Math.min(line - rad, 30) - dist * 0.35;   // close to its title, with room around it
        if (!best || score > best.score) best = { score, c };
      }
      if (!best) best = { c: { x: p.x + ux * (rad + 46), y: p.y + uy * (rad + 46) } };   // a fallback that should not happen
      const c = best.c;
      placed.push({ ...c, r: rad, id });
      const dx = p.x - c.x, dy = p.y - c.y, dl = Math.hypot(dx, dy) || 1;
      const edge = { x: c.x + (dx / dl) * rad, y: c.y + (dy / dl) * rad };
      const stem = `M${p.x},${p.y} Q${(p.x + edge.x) / 2 + uy * 12},${(p.y + edge.y) / 2 - ux * 12} ${edge.x},${edge.y}`;
      const all = kids.map((k) => evById[k]);
      return `<g class="g-cl from-${e.from}" data-ev="${id}" data-b="${e.branch}" data-t="${when[id]}" tabindex="0" role="button" aria-label="${e.year}, ${e.title}, with ${all.length} related events" style="transform-origin:${c.x}px ${c.y}px">
          <path class="g-stem" pathLength="1" d="${stem}"/>
          <circle class="g-ring-c" cx="${c.x}" cy="${c.y}" r="${rad}"/>
          <text class="g-when g-cl-when" x="${p.x}" y="${p.y - (words(e.title, 17).length > 1 ? 18 : 12)}" text-anchor="middle">${e.year}</text>
          <text class="g-cl-title" x="${p.x}" y="${p.y + 5}" text-anchor="middle">${words(e.title, 17).map((l, i, a) => `<tspan x="${p.x}" dy="${i ? 18 : a.length > 1 ? -4 : 0}">${l}</tspan>`).join("")}</text>
          <text class="g-cl-sum" x="${c.x}" data-cx="${c.x}" data-cy="${c.y}" data-r="${rad}" text-anchor="middle">${e.summary || ""}</text>
        </g>`;
    }).join("");

    svg.innerHTML = `
      <path class="g-ghost" d="${pathTo(tEnd)}"/>
      <path class="g-line" d=""/>
      <circle class="g-tip" r="3.5"/>
      <g class="g-centre"><circle cx="${G.cx}" cy="${G.cy}" r="7" class="g-me"/><text x="${G.cx}" y="${G.cy + 22}" text-anchor="middle" class="g-me-t">${H.start}</text></g>

      <g class="g-circles"></g>
      <g class="g-events">${lineEvents}</g>`;

    // words never touch: in time order, a word that would cover an earlier one (or the centre) moves to the nearest free
    // spot just off the line, outward or inward first, then a little along it
    {
      const box2 = (el) => { const b = el.getBoundingClientRect(), r0 = svg.getBoundingClientRect(); return { x: b.left - r0.left - 3, y: b.top - r0.top - 2, w: b.width + 6, h: b.height + 4 }; };
      const hit = (a, b) => !(a.x > b.x + b.w || a.x + a.w < b.x || a.y > b.y + b.h || a.y + a.h < b.y);
      const taken = [{ x: G.cx - 24, y: G.cy - 14, w: 48, h: 48 }];
      Object.keys(clusters).forEach((id) => { const p = at(when[id]), ls = words(evById[id].title, 17), w = Math.max(...ls.map((l) => l.length)) * 9.4 + 12; taken.push({ x: p.x - w / 2, y: p.y - 32, w, h: ls.length * 18 + 24 }); });   // the findings' titles
      [...svg.querySelectorAll(".g-ev")].sort((a, b) => +a.dataset.t - +b.dataset.t).forEach((g) => {
        const p = at(+g.dataset.t), ux = (p.x - G.cx) / (p.r || 1), uy = (p.y - G.cy) / (p.r || 1);
        let best = null;
        for (const [ox, oy] of [[0, 0], [ux * 14, uy * 14], [-ux * 14, -uy * 14], [ux * 26, uy * 26], [-ux * 26, -uy * 26], [-uy * 22, ux * 22], [uy * 22, -ux * 22], [ux * 38, uy * 38], [-ux * 38, -uy * 38],
          [-uy * 44, ux * 44], [uy * 44, -ux * 44], [-uy * 30 + ux * 18, ux * 30 + uy * 18], [uy * 30 + ux * 18, -ux * 30 + uy * 18], [-uy * 30 - ux * 18, ux * 30 - uy * 18], [uy * 30 - ux * 18, -ux * 30 - uy * 18], [-uy * 64, ux * 64], [uy * 64, -ux * 64]]) {
          g.setAttribute("transform", `translate(${(p.x + ox).toFixed(1)} ${(p.y + oy).toFixed(1)})`);
          const b = box2(g);
          if (!taken.some((t) => hit(b, t))) { best = [ox, oy, b]; break; }
        }
        if (!best) { g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`); best = [0, 0, box2(g)]; }
        g.dataset.ox = best[0]; g.dataset.oy = best[1];
        taken.push(best[2]);
      });
    }

    // the words' real outlines (and each circle's title, written on the line), then the circles around them
    const sr = svg.getBoundingClientRect();
    const rects = [...svg.querySelectorAll(".g-ev")].map((t) => { const b = t.getBoundingClientRect(); return { x: b.left - sr.left - 4, y: b.top - sr.top - 2, w: b.width + 8, h: b.height + 4 }; });
    svg.querySelectorAll(".g-cl-title").forEach(() => {});
    Object.keys(clusters).forEach((id) => { const p = at(when[id]), ls = words(evById[id].title, 17), w = Math.max(...ls.map((l) => l.length)) * 9.4 + 12; rects.push({ x: p.x - w / 2, y: p.y - 30, w, h: ls.length * 18 + 26 }); });
    rects.push({ x: G.cx - 22, y: G.cy - 12, w: 44, h: 46 });   // the centre and its year
    rects.push({ x: box.width - REPORT, y: 0, w: REPORT, h: box.height });   // the report's strip
    svg.querySelector(".g-circles").innerHTML = circlesHTML(rects);

    // a slim marker stroke under the lower half of each line, like a highlighter pen
    svg.querySelectorAll(".g-ev.from-her, .g-ev.from-dismissed, .g-ev.from-you").forEach((g) => {
      const t = g.querySelector(".g-word");
      [...t.querySelectorAll("tspan")].forEach((ts, n) => {
        const w = ts.getComputedTextLength(), y = n === 0 ? +ts.getAttribute("dy") : +t.querySelector("tspan").getAttribute("dy") + 18;
        const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        Object.entries({ class: "g-mark", x: -w / 2 - 3, y: y - 6, width: w + 6, height: 8, rx: 1.5 }).forEach(([k, v]) => r.setAttribute(k, v));
        g.insertBefore(r, t);
      });
    });
    // the sentence inside each circle wraps to the circle's own shape: each line as wide as the circle is at that height
    svg.querySelectorAll(".g-cl-sum").forEach((t) => {
      const cx = +t.dataset.cx, cy = +t.dataset.cy, r = +t.dataset.r, lh = 15.5, words = t.textContent.trim().split(/\s+/);
      const meas = (str) => { t.textContent = str; return t.getComputedTextLength(); };
      for (let n = 2; n <= 7; n++) {   // the fewest lines that fit
        const top = cy - ((n - 1) * lh) / 2, lines = [];
        let k = 0, ok = true;
        for (let li = 0; li < n && k < words.length; li++) {
          const y = top + li * lh, room = 2 * Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy))) - 18;
          let line = words[k++];
          while (k < words.length && meas(line + " " + words[k]) <= room) line += " " + words[k++];
          if (meas(line) > room) ok = false;
          lines.push(line);
        }
        if (ok && k >= words.length) {
          t.innerHTML = lines.map((l, li) => `<tspan x="${cx}" y="${(top + li * lh + 4.5).toFixed(1)}">${l}</tspan>`).join("");
          const mark = evById[t.closest(".g-cl").dataset.ev].mark;   // a word to highlight inside the circle
          if (mark) [...t.querySelectorAll("tspan")].forEach((ts) => {
            const at = ts.textContent.toLowerCase().indexOf(mark.toLowerCase());
            if (at < 0) return;
            const x0 = ts.getStartPositionOfChar(at).x, w = ts.getSubStringLength(at, mark.length), y = +ts.getAttribute("y");
            const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
            Object.entries({ class: "g-mark m-her", x: x0 - 2, y: y - 5, width: w + 4, height: 7, rx: 1.5 }).forEach(([k, v]) => r.setAttribute(k, v));
            t.parentNode.insertBefore(r, t);
          });
          return;
        }
      }
      t.setAttribute("y", cy + 4);
    });
    svg.querySelectorAll(".g-ev, .g-cl").forEach((el) => {
      // today's word leads back to today: the summary and its network
      const isToday = evById[el.dataset.ev] && evById[el.dataset.ev].from === "you";
      if (isToday) el.setAttribute("aria-label", "Today, session 1 of 9: back to today's summary");
      el.addEventListener("click", () => { if (isToday) return setView("today"); choose(el.dataset.ev); });
      el.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (isToday) return setView("today"); choose(el.dataset.ev); } });
      el.addEventListener("mouseenter", () => hint(el.dataset.ev, true));
      el.addEventListener("mouseleave", () => hint(el.dataset.ev, false));
    });
    grow(year);
    choose(current, true);
    lightBranch(branchOn);
  }

  // the history as it stood at a moment: the line drawn that far, and only what was written by then
  function grow(y) {
    year = y;
    const whole = Math.min(H.end, Math.floor(y + 1e-6));
    const t = Math.min(y, tEnd);   // this year grows one incident at a time too
    svg.querySelector(".g-line").setAttribute("d", pathTo(t));
    const tip = at(t), c = svg.querySelector(".g-tip"); c.setAttribute("cx", tip.x); c.setAttribute("cy", tip.y);
    svg.classList.toggle("is-grown", t >= tEnd - 1e-6);
    svg.querySelectorAll("[data-t]").forEach((el) => el.classList.toggle("is-out", +el.dataset.t > t + 1e-6));
    list.querySelectorAll(".h-row").forEach((row) => row.classList.toggle("is-out", when[row.dataset.ev] > t + 1e-6));
    const n = H.events.filter((e) => when[e.id] <= t + 1e-6).length;
    list.querySelector(".hist-count").textContent = `${n} event${n === 1 ? "" : "s"}`;
  }

  function choose(id, keep) {
    if (!keep) current = current === id ? null : id;
    const host = current && (clusters[current] ? current : inCluster[current]);
    svg.querySelectorAll(".g-ev").forEach((el) => { el.classList.toggle("is-current", el.dataset.ev === current); el.classList.toggle("is-related", !!host && inCluster[el.dataset.ev] === host && el.dataset.ev !== current); });
    svg.querySelectorAll(".g-cl").forEach((el) => el.classList.toggle("is-current", el.dataset.ev === host));
    list.querySelectorAll(".h-row").forEach((r) => r.classList.toggle("is-current", r.dataset.ev === current));
    garden.classList.toggle("has-current", !!current);
    openSections();
    showPile(current);
    const row = current && list.querySelector(`.h-row[data-ev="${current}"]`);
    if (row && !keep) setTimeout(() => row.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" }), 30);
  }
  function hint(id, on) {
    svg.querySelectorAll(`.g-ev[data-ev="${id}"], .g-cl[data-ev="${id}"]`).forEach((el) => el.classList.toggle("is-hint", on));
    list.querySelectorAll(`.h-row[data-ev="${id}"]`).forEach((r) => r.classList.toggle("is-hint", on));
  }
  function openSections() {
    const curB = current && evById[current].branch;
    list.querySelectorAll(".hb-sec").forEach((sec) => { const b = sec.querySelector(".hb-name").dataset.b; sec.classList.toggle("is-open", b === curB || b === branchOn); });
  }
  // a specialty chosen in the list: its words stand out along the line, the others step back
  function lightBranch(id) {
    branchOn = id;
    garden.classList.toggle("has-branch", !!id);
    svg.querySelectorAll(".g-ev, .g-cl").forEach((el) => el.classList.toggle("in-branch", el.dataset.b === id));
    list.querySelectorAll(".hb-name").forEach((b) => { const on = b.dataset.b === id; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on); });
    openSections();
  }
  list.querySelectorAll(".hb-name").forEach((b) => b.addEventListener("click", () => lightBranch(branchOn === b.dataset.b ? null : b.dataset.b)));
  list.querySelectorAll(".h-row").forEach((r) => {
    r.addEventListener("click", () => choose(r.dataset.ev));
    r.addEventListener("mouseenter", () => hint(inCluster[r.dataset.ev] || r.dataset.ev, true));
    r.addEventListener("mouseleave", () => hint(inCluster[r.dataset.ev] || r.dataset.ev, false));
  });

  /* ---------- a little life: near the pointer the line and its words lean towards it, then spring back ---------- */
  let ptr = null, lifeRaf = 0;
  garden.addEventListener("pointermove", (e) => { const r = svg.getBoundingClientRect(); ptr = { x: e.clientX - r.left, y: e.clientY - r.top }; wake(); });
  garden.addEventListener("pointerleave", () => { ptr = null; wake(); });
  function wake() { if (!reduce && !lifeRaf && G) lifeRaf = requestAnimationFrame(live); }
  function live() {
    lifeRaf = 0;
    if (!G || garden.hidden) return;
    if (!G.disp) G.disp = G.pts.map(() => ({ x: 0, y: 0, vx: 0, vy: 0 }));
    const RAD = 130, MAX = 9;
    let moving = false;
    G.pts.forEach((p, n) => {
      const d = G.disp[n];
      let tx = 0, ty = 0;
      if (ptr) { const dx = ptr.x - p.x, dy = ptr.y - p.y, dist = Math.hypot(dx, dy); if (dist < RAD && dist > 0.1) { const k = Math.pow(1 - dist / RAD, 2) * MAX; tx = (dx / dist) * k; ty = (dy / dist) * k; } }
      d.vx = (d.vx + (tx - d.x) * 0.12) * 0.78; d.vy = (d.vy + (ty - d.y) * 0.12) * 0.78;
      d.x += d.vx; d.y += d.vy;
      if (Math.abs(d.vx) + Math.abs(d.vy) + Math.abs(tx - d.x) + Math.abs(ty - d.y) > 0.02) moving = true;
    });
    svg.querySelectorAll(".g-ev").forEach((g) => {   // each word rides on its point of the line
      const p = at(when[g.dataset.ev]), d = G.disp[p.k];
      g.setAttribute("transform", `translate(${(p.x + d.x + +(g.dataset.ox || 0)).toFixed(1)} ${(p.y + d.y + +(g.dataset.oy || 0)).toFixed(1)})`);
    });
    svg.querySelectorAll(".g-cl").forEach((g) => {
      const c = g.querySelector(".g-ring-c"), cx = +c.getAttribute("cx"), cy = +c.getAttribute("cy");
      const o = g._lean || (g._lean = { x: 0, y: 0, vx: 0, vy: 0 });
      let tx = 0, ty = 0;
      if (ptr) { const dx = ptr.x - cx, dy = ptr.y - cy, dist = Math.hypot(dx, dy); if (dist < 170 && dist > 0.1) { const k = Math.pow(1 - dist / 170, 2) * 8; tx = (dx / dist) * k; ty = (dy / dist) * k; } }
      o.vx = (o.vx + (tx - o.x) * 0.12) * 0.78; o.vy = (o.vy + (ty - o.y) * 0.12) * 0.78; o.x += o.vx; o.y += o.vy;
      if (Math.abs(o.vx) + Math.abs(o.vy) + Math.abs(tx - o.x) + Math.abs(ty - o.y) > 0.02) moving = true;
      g.style.translate = `${o.x.toFixed(2)}px ${o.y.toFixed(2)}px`;
    });
    if (moving || ptr) lifeRaf = requestAnimationFrame(live);
  }

  /* ---------- growing ---------- */
  let raf = 0;
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function play() {
    cancelAnimationFrame(raf);
    if (reduce) { grow(tEnd); return; }
    const dur = 10000, t0 = performance.now();
    // the moment that sits at a given share of the line's length (the inverse of fracOf)
    const momentAt = (f) => { let lo = H.start, hi = tEnd; for (let n = 0; n < 40; n++) { const m = (lo + hi) / 2; if (fracOf(m) < f) lo = m; else hi = m; } return hi; };
    const pace = (k) => (k < 0.08 ? (k * k) / 0.16 : k > 0.94 ? 1 - ((1 - k) * (1 - k)) / 0.12 : k - 0.04) / 0.98;   // steady, with a soft start and finish
    bar.querySelector(".hist-play").classList.add("is-on");
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      grow(momentAt(Math.min(1, Math.max(0, pace(k)))));
      if (k < 1) raf = requestAnimationFrame(step);
      else { grow(tEnd); bar.querySelector(".hist-play").classList.remove("is-on"); }
    };
    grow(H.start);
    raf = requestAnimationFrame(step);
  }
  // replay starts her history from scratch: nothing chosen, no specialty lit, no document out, the list closed
  function restart() {
    if (!viewer.hidden) closeDocs();
    if (current) choose(current);       // choosing the same one again clears it
    if (branchOn) lightBranch(null);
    current = null; branchOn = null;
    choose(null, true);
    list.querySelector(".hist-body").scrollTop = 0; list.scrollTop = 0;
    play();
  }
  bar.querySelector(".hist-play").addEventListener("click", restart);


  /* ---------- Today / Her history ---------- */
  function setView(v) {
    const on = v === "history";
    bar.querySelectorAll(".hist-seg button").forEach((b) => { const me = b.dataset.v === v; b.classList.toggle("is-on", me); b.setAttribute("aria-checked", me); });
    bar.querySelector(".hist-play").hidden = !on;
    document.body.classList.toggle("is-history", on);
    $("#index").hidden = on;
    list.hidden = !on;
    if (on) {
      if (location.hash) { history.pushState(null, "", location.pathname + location.search); dispatchEvent(new PopStateEvent("popstate")); }
      garden.hidden = false;
      void garden.offsetWidth;
      garden.classList.add("is-in");
      build();
      play();
    } else {
      cancelAnimationFrame(raf);
      garden.classList.remove("is-in");
      setTimeout(() => { if (!garden.classList.contains("is-in")) garden.hidden = true; }, 450);
    }
  }
  bar.querySelectorAll(".hist-seg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.v)));
  addEventListener("resize", () => { if (!garden.hidden) build(); });

  /* ---------- on a phone: the same history as one hand-drawn line running down the page ---------- */
  const phone = matchMedia("(max-width: 760px)");
  const mSeg = document.createElement("div");
  mSeg.className = "m-hist-bar";
  mSeg.innerHTML = `<div class="hist-seg" role="radiogroup" aria-label="View">
      <button type="button" role="radio" aria-checked="true" data-v="today" class="is-on">Today</button>
      <button type="button" role="radio" aria-checked="false" data-v="history">Her history</button></div>
    <button type="button" class="m-hist-play" aria-label="Grow her history again" hidden>
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3"/></svg></button>`;
  ($(".brief .tags") || $(".brief")).after(mSeg);
  // at the top right, beside her photo: the two tabs, then the summary's button
  const seg = mSeg.querySelector(".hist-seg");
  const sumBtn = $("#m-sum-btn");
  const ctl = document.createElement("div");
  ctl.className = "m-who-ctl";
  ctl.append(seg);
  if (sumBtn) ctl.append(sumBtn);
  ($(".brief .who") || $(".brief")).append(ctl);

  const related = {};   // an incident → the findings it belongs with, and each finding → itself and its incidents
  Object.entries(clusters).forEach(([k, kids]) => { related[k] = [k, ...kids]; });
  const mRow = (e) => {
    const finding = !!clusters[e.id], d = finding && docsOf(e);
    const mark = { her: "m-her", dismissed: "m-dis", you: "m-you" }[e.from];
    return `<li class="mh-row${finding ? " is-finding" : ""}" data-ev="${e.id}">
      <span class="mh-year">${e.year}</span>${finding ? `<span class="mh-dot" aria-hidden="true"></span>` : ""}
      <div class="mh-text">
        <button type="button" class="mh-title"${e.id === "h21" ? ` data-today` : ""}>${mark ? `<span class="mh-mark ${mark}">${e.title}</span>` : e.title}</button>
        ${finding ? `<p class="mh-sum">${e.summary}</p>` : ""}
        ${d ? `<button type="button" class="mh-doc" data-doc="${e.id}" aria-label="Open: ${d.caption}">
          <span class="mh-thumb${d.paper ? " is-paper" : ""}">${page(d.pages[0])}</span><span class="mh-doc-name">${d.caption.split(" · ")[0]}</span></button>` : ""}
      </div></li>`;
  };
  const mHist = document.createElement("section");
  mHist.className = "m-hist";
  mHist.hidden = true;
  mHist.setAttribute("aria-label", "Her history, from her first record to today");
  mHist.innerHTML = `<div class="mh-head"><ul class="mh-key" aria-label="Key"><li><i class="k-her"></i>Told by her</li><li><i class="k-dis"></i>No diagnosis</li><li><i class="k-you"></i>Today</li></ul></div>
    <div class="mh-body"><svg class="mh-line" aria-hidden="true"><path/></svg>
      <ol class="mh-list">${[...H.events].sort((a, b) => when[a.id] - when[b.id]).map(mRow).join("")}</ol></div>`;
  $(".side").prepend(mHist);
  mHist.querySelector(".mh-head").appendChild(mSeg.querySelector(".m-hist-play"));   // the replay sits with the key, at the top of the line

  // the line, drawn by hand down the page: it wavers a little from side to side
  function mLine() {
    const body = mHist.querySelector(".mh-body"), h = body.offsetHeight, x = 66, pts = [];
    for (let y = 0; y <= h; y += 8) pts.push(`${(x + Math.sin(y / 97) * 2.2 + Math.sin(y / 31 + 1.3) * 0.9).toFixed(1)},${y}`);
    const sv = mHist.querySelector(".mh-line"), path = sv.querySelector("path");
    sv.setAttribute("viewBox", `0 0 ${body.offsetWidth} ${h}`);
    sv.style.height = h + "px";
    path.setAttribute("d", "M" + pts.join(" L"));
    return path;
  }
  // it grows from 2010 down to today; each line of her history appears as the line reaches it
  let mTimers = [];
  function mGrow() {
    mTimers.forEach(clearTimeout); mTimers = [];
    const path = mLine(), rows = [...mHist.querySelectorAll(".mh-row")];
    const play = mHist.querySelector(".m-hist-play");
    if (reduce) { path.style.strokeDasharray = ""; rows.forEach((r) => r.classList.add("is-in")); return; }
    const len = path.getTotalLength(), h = mHist.querySelector(".mh-body").offsetHeight, dur = 4200;
    rows.forEach((r) => r.classList.remove("is-in"));
    path.style.transition = "none";
    path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
    void path.getBoundingClientRect();
    path.style.transition = `stroke-dashoffset ${dur}ms cubic-bezier(.45, .05, .35, 1)`;
    path.style.strokeDashoffset = 0;
    play.classList.add("is-on");
    // the same easing, inverted roughly: a row appears when the line passes its top
    const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
    const timeAt = (f) => { let lo = 0, hi = 1; for (let n = 0; n < 24; n++) { const m = (lo + hi) / 2; if (ease(m) < f) lo = m; else hi = m; } return hi * dur; };
    rows.forEach((r) => mTimers.push(setTimeout(() => r.classList.add("is-in"), timeAt(Math.min(1, (r.offsetTop + 6) / h)))));
    mTimers.push(setTimeout(() => { play.classList.remove("is-on"); path.style.strokeDasharray = ""; }, dur + 100));
  }

  // choosing a finding lights it and what it explains; the rest of her history steps back
  let mOn = null;
  function mChoose(id) {
    mOn = id && id !== mOn ? id : null;
    const lit = mOn ? related[mOn] || [mOn] : [];
    mHist.classList.toggle("has-current", !!mOn);
    mHist.querySelectorAll(".mh-row").forEach((r) => r.classList.toggle("is-lit", lit.includes(r.dataset.ev)));
  }

  // a document comes up as a sheet from the bottom
  const sheet = document.createElement("div");
  sheet.className = "m-doc-sheet";
  sheet.hidden = true;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", "Document");
  document.body.appendChild(sheet);
  function mOpenDoc(id) {
    const d = docsOf(evById[id]); if (!d) return;
    sheet.innerHTML = `<div class="mds-card"><span class="mds-handle" aria-hidden="true"></span>
      <div class="mds-pages">${d.pages.map((p) => `<figure class="mds-page${d.paper ? " is-paper" : ""}">${page(p, true)}</figure>`).join("")}</div>
      <p class="mds-cap">${d.caption}</p><button type="button" class="mds-close">Close</button></div>`;
    sheet.hidden = false; void sheet.offsetWidth; sheet.classList.add("is-in");
  }
  function mCloseDoc() { sheet.classList.remove("is-in"); setTimeout(() => { if (!sheet.classList.contains("is-in")) sheet.hidden = true; }, 400); }
  sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest(".mds-close") || e.target.closest(".mds-handle")) mCloseDoc(); });

  mHist.addEventListener("click", (e) => {
    const doc = e.target.closest(".mh-doc");
    if (doc) { mOpenDoc(doc.dataset.doc); return; }
    const t = e.target.closest(".mh-title");
    if (!t) return;
    if (t.hasAttribute("data-today")) { mView("today"); $(".stage").scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); return; }
    const id = t.closest(".mh-row").dataset.ev;
    mChoose(clusters[id] ? id : inCluster[id] || null);
  });

  function mView(v) {
    const on = v === "history";
    seg.querySelectorAll("button").forEach((b) => { const me = b.dataset.v === v; b.classList.toggle("is-on", me); b.setAttribute("aria-checked", me); });
    mHist.querySelector(".m-hist-play").hidden = !on;
    document.body.classList.toggle("m-history", on);
    mHist.hidden = !on;
    if (on) { if (sumBtn && sumBtn.classList.contains("is-on")) sumBtn.click(); mChoose(null); mGrow(); }
    else { mTimers.forEach(clearTimeout); if (!sheet.hidden) mCloseDoc(); }
  }
  seg.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => mView(b.dataset.v)));
  mHist.querySelector(".m-hist-play").addEventListener("click", () => { if (!sheet.hidden) mCloseDoc(); mChoose(null); mGrow(); });
  phone.addEventListener("change", () => { if (!phone.matches && document.body.classList.contains("m-history")) mView("today"); });
  addEventListener("resize", () => { if (!mHist.hidden) mLine(); });
})();
