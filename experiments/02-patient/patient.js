/*
  Camille prepares her first session with Marc. One question at a time; she answers with a tap, by typing, or by speaking.
  What she says becomes the green "told by her" lines on Marc's side. The conversation is scripted (no AI): it goes the same way
  every time, so the demo is reliable. ?still turns the motion off.
*/
(function () {
  const $ = (s) => document.querySelector(s);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
  const wait = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));
  const log = $("#log"), say = $("#say"), composer = $("#composer"), dock = $("#c-dock");   // dock: Done, low by the thumb

  // the body, front view: her right is on the left of the picture (the same drawing as on Marc's side)
  // places on the body, head to feet: what she colours is named after the nearest of them, so Marc reads words
  const SPOTS = [
    ["head", "Head", 100, 22], ["neck", "Neck", 100, 60],
    ["r-shoulder", "Right shoulder", 62, 86], ["l-shoulder", "Left shoulder", 139, 86],
    ["chest", "Chest", 100, 112],
    ["r-arm", "Right arm", 53, 150], ["l-arm", "Left arm", 148, 150],
    ["belly", "Belly", 100, 175],
    ["r-wrist", "Right wrist", 33, 221], ["l-wrist", "Left wrist", 168, 221],
    ["r-hip", "Right hip", 78, 222], ["l-hip", "Left hip", 123, 222],
    ["r-hand", "Right hand", 20, 250], ["l-hand", "Left hand", 181, 250],
    ["r-thigh", "Right thigh", 81, 270], ["l-thigh", "Left thigh", 120, 270],
    ["r-knee", "Right knee", 77, 317], ["l-knee", "Left knee", 124, 317],
    ["r-shin", "Right shin", 77, 380], ["l-shin", "Left shin", 124, 380],
    ["r-foot", "Right foot", 76, 440], ["l-foot", "Left foot", 125, 440],
  ];

  // the seven questions, in order. `label` names the line on the review; `sample` is what she says when she speaks.
  const STEPS = [
    { id: "why", label: "Why", lines: ["What brings you to physiotherapy?"],
      tool: { type: "chips", options: ["I fell", "Pain started gradually", "After surgery"] }, sample: "I fell" },
    { id: "how", label: "What happened", lines: ["I'm sorry to hear that. When did it happen, and how?"],
      tool: { type: "chips", options: ["Saturday, on the stairs of my building", "During sport", "At work"] }, sample: "Saturday, I missed a step on the stairs of my building" },
    { id: "where", label: "Where", lines: ["Where does it hurt? Tap on the body. You can choose more than one place."],
      tool: { type: "body" }, sample: "My right foot, my right knee and my right wrist" },
    { id: "pain", label: "Pain", lines: ["At its worst, how strong is the pain?"],
      tool: { type: "pain" }, sample: "About 6 out of 10" },
    { id: "worst", label: "Worst when", lines: ["When is it worst? You can choose more than one."],
      tool: { type: "chips", multi: true, options: ["Walking", "On the stairs", "At night", "Sitting"] }, sample: "When I walk, and at night" },
    { id: "health", label: "Also", lines: ["Is there anything else about your health Marc should know? Even if it seems unrelated."],
      tool: { type: "chips", multi: true, options: ["I often feel dizzy", "I get breathless on stairs", "Headaches", "Nothing else"] }, sample: "I often feel dizzy, and I get breathless when I climb stairs" },
    { id: "wants", label: "You would like", lines: ["What would you most like from this first session?"],
      tool: { type: "chips", multi: true, options: ["Less pain", "To know how long it will take", "Exercises for home", "Back to site visits"] }, sample: "Above all, less pain. And to know how long it will take" },
    { id: "papers", label: "Papers", lines: ["Did the emergency give you any papers? A photo is enough."],
      tool: { type: "papers" }, sample: null },
  ];
  const ACK = {};   // no reply lines between questions: the next question follows her answer
  const answers = {};
  let step = -1, editing = false, busy = false;

  /* ---------- screens ---------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-on", s.id === id));
    $("#p-back").hidden = id === "welcome" || id === "sent";
    $("#p-step").hidden = id !== "chat";
    $(".p-me").hidden = id !== "welcome";   // her photo belongs to the home greeting
  }
  function progress() { $("#p-step").textContent = `${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`; }

  /* ---------- the conversation ---------- */
  // each new question moves up to the top of the chat, with her last answer just above it,
  // so what she has to answer always has the screen to itself; the earlier lines scroll away
  const room = () => { log.style.paddingBottom = `${Math.max(0, log.clientHeight - 200)}px`; };
  room(); addEventListener("resize", room);
  const scroll = () => setTimeout(() => {
    room();
    const q = [...log.querySelectorAll(".msg.bot:not(.intro)")].pop();
    let top = 0;
    if (q) {
      const before = q.previousElementSibling;
      top = before && before.classList.contains("her") ? before.offsetTop - 14 : q.offsetTop - 14;
      if (!before || before.classList.contains("intro")) top = 0;   // the first question stays under the hello
    }
    const last = log.lastElementChild;   // never leave something new (a paper she added) out of sight
    if (last && last.offsetTop + last.offsetHeight > top + log.clientHeight) top = Math.max(top, last.offsetTop + last.offsetHeight - log.clientHeight + 16);
    log.scrollTo({ top: Math.max(0, top), behavior: still ? "auto" : "smooth" });
  }, 30);
  function add(html, cls) {
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = html;
    log.appendChild(li);
    scroll();
    return li;
  }
  // questions sit in a grey bubble; everything else the assistant says (hello, thank you) is plain, quieter text
  async function bot(text, question = false) {
    const t = add("<i></i><i></i><i></i>", "msg bot typing");
    t.setAttribute("aria-label", "Typing");
    // the opening keeps its longer beat; once she is answering, the next line follows sooner
    await wait(step < 0 ? Math.min(1100, 380 + text.length * 12) : Math.min(1000, 550 + text.length * 7));
    // the message settles in place of the dots: the bubble opens from its corner, the words fade in.
    // Only transform and opacity move, so the text never re-wraps or gets clipped.
    t.classList.remove("typing"); t.removeAttribute("aria-label");
    if (!question) t.classList.add("note");
    t.innerHTML = `<span class="msg-text">${esc(text)}</span>`;
    t.classList.add("arrive");
    scroll();
  }
  function her(text, extra = "") { add(`${esc(text)}${extra}`, "msg her"); }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // a paper she added: a photo shows itself; a PDF or other file shows as a little page with its name. Tap to see it large.
  const paper = (p, cls = "") => p.url && p.kind === "img"
    ? `<span class="paper is-photo ${cls}" data-id="${p.id}" role="button" tabindex="0" aria-label="See ${esc(p.title)}"><img src="${p.url}" alt=""></span>`
    : `<span class="paper ${cls}" data-id="${p.id}" role="button" tabindex="0" aria-label="See ${esc(p.title)}"><b>${esc(p.title)}</b><i></i><i></i><i></i><i></i>${p.kind === "pdf" ? "<em>PDF</em>" : ""}</span>`;

  async function ask(k) {
    step = k; progress();
    dock.replaceChildren();
    const s = STEPS[k];
    composer.classList.add("is-off");
    for (const line of s.lines) await bot(line, true);
    composer.classList.remove("is-off");
    say.placeholder = "Type your answer…";
    tool(s);
    log.lastElementChild.querySelectorAll(".chip").forEach((c, i) => c.style.setProperty("--i", i));   // one after another
  }

  function tool(s) {
    const box = add("", "tool");
    box.dataset.step = s.id;
    const t = s.tool;
    if (t.type === "chips") {
      box.innerHTML = `<div class="chips">${t.options.map((o) => `<button type="button" class="chip" ${t.multi ? 'aria-pressed="false"' : ""}>${o}</button>`).join("")}</div>`;
      box.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
        if (!t.multi) return answer(c.textContent);
        const none = c.textContent === "Nothing else";
        if (none) box.querySelectorAll('.chip[aria-pressed]').forEach((x) => x !== c && x.setAttribute("aria-pressed", "false"));
        else box.querySelectorAll('.chip[aria-pressed]').forEach((x) => x.textContent === "Nothing else" && x.setAttribute("aria-pressed", "false"));
        c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true");
        compose(list([...box.querySelectorAll('.chip[aria-pressed="true"]')].map((x) => x.textContent)));
      }));
    }
    if (t.type === "body") {   // she taps a part of the body and it turns soft red; a second tap clears it
      box.innerHTML = `<div class="body-pick"><div class="body-fig"><span class="body-side is-r" aria-hidden="true">Right</span><span class="body-side is-l" aria-hidden="true">Left</span>${bodySvg}<canvas class="body-paint" aria-hidden="true"></canvas></div>
        <div class="body-chosen"></div></div>`;
      const fig = box.querySelector(".body-fig"), cv = box.querySelector(".body-paint"), ctx = cv.getContext("2d");
      const shown = box.querySelector(".body-chosen");
      const shape = new Path2D();   // the silhouette, in the drawing's own units (viewBox 0 -10 201 471)
      const p = fig.querySelector("svg path"); if (p) shape.addPath(new Path2D(p.getAttribute("d")));
      shape.ellipse(100.7, 2, 12, 10, 0, 0, Math.PI * 2);
      const k = window.devicePixelRatio || 1;
      cv.width = fig.clientWidth * k; cv.height = fig.clientHeight * k;
      ctx.setTransform(cv.width / 201, 0, 0, cv.height / 471, 0, (10 * cv.height) / 471);
      const hit = new Set();
      const at = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * 201, ((e.clientY - r.top) / r.height) * 471 - 10]; };
      const nearest = ([x, y]) => SPOTS.reduce((a, b) => (Math.hypot(b[2] - x, b[3] - y) < Math.hypot(a[2] - x, a[3] - y) ? b : a));
      const inside = ([x, y]) => ctx.isPointInPath(shape, x * (cv.width / 201), (y + 10) * (cv.height / 471));
      function paint() {   // each chosen part as a soft red area, kept inside the silhouette
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.restore();
        ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#EE6E5B";
        SPOTS.filter((x) => hit.has(x[1])).forEach(([, , x, y]) => { ctx.beginPath(); ctx.ellipse(x, y, 17, 22, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.globalCompositeOperation = "destination-in"; ctx.fill(shape);
      }
      function refresh() {
        paint();
        const names = SPOTS.map((x) => x[1]).filter((n) => hit.has(n));
        const html = names.map((n) => `<span class="body-tag">${n}</span>`).join("");
        if (shown.innerHTML !== html) shown.innerHTML = html;
        compose(list(names));
      }
      cv.addEventListener("click", (e) => {
        const pt = at(e);
        if (!inside(pt)) return;
        const n = nearest(pt)[1];
        hit.has(n) ? hit.delete(n) : hit.add(n);
        refresh();
      });
    }
    if (t.type === "pain") {   // three words, the usual mild / moderate / strong bands; one tap is the answer
      const LEVELS = [["Mild", "1–3"], ["Moderate", "4–6"], ["Strong", "7–10"]];
      box.innerHTML = `<div class="chips">${LEVELS.map(([w, n]) => `<button type="button" class="chip pain-w">${w}</button>`).join("")}</div>`;
      box.querySelectorAll(".pain-w").forEach((b, i) => b.addEventListener("click", () => {
        b.classList.add("is-on");
        answer(LEVELS[i][0]);   // she says the word; Marc reads the word and its numbers
        answers.pain = `${LEVELS[i][0]} (${LEVELS[i][1]} out of 10)`;
      }));
    }
    if (t.type === "papers") {
      box.innerHTML = `<div class="chips"><button type="button" class="chip" data-a="photo">Take a photo</button><button type="button" class="chip" data-a="file">Choose a file</button><button type="button" class="chip" data-a="none">I have none</button></div>`;
      box.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
        if (c.dataset.a === "none") return answer("None");
        // the phone's own camera, or her files and photos; what she picks becomes her answer
        (c.dataset.a === "photo" ? $("#c-camera") : $("#c-file")).click();
      }));
    }
    scroll();
  }
  // "Less pain and to know how long it will take": one sentence, capital only at its start
  const list = (a) => { a = a.map((x, i) => (i ? x.charAt(0).toLowerCase() + x.slice(1) : x)); return a.length < 2 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`; };

  async function answer(text, extra = "") {
    if (busy) return;
    busy = true;
    const s = STEPS[step];
    const box = log.querySelector(`.tool[data-step="${s.id}"]:not(.is-done)`);
    if (box) leave(box);
    dock.replaceChildren();
    her(text, extra);
    answers[s.id] = text;
    if (s.id === "papers" && text === "None" && !(answers.files || []).length) answers.files = [];
    say.value = ""; ready();
    if (editing) { editing = false; await wait(500); review(s.id); busy = false; return; }
    if (ACK[s.id]) await bot(typeof ACK[s.id] === "function" ? ACK[s.id](text) : ACK[s.id]);
    busy = false;
    if (step + 1 < STEPS.length) return ask(step + 1);
    await bot("That's everything. Here is what Marc will read. You can change anything before you send it.");
    dock.innerHTML = `<div class="tool-row"><button type="button" class="chip is-done">Check and send</button></div>`;
    dock.querySelector("button").addEventListener("click", () => review());
    composer.classList.add("is-off");
    step = STEPS.length; progress();
  }

  // answered chips fold away instead of vanishing, so her reply slides up into their place
  function leave(box) {
    box.classList.add("is-done");
    if (still) return box.remove();
    box.style.overflow = "hidden";
    box.animate([{ height: `${box.offsetHeight}px`, opacity: 1, paddingTop: "2px", paddingBottom: "4px", marginTop: "0px" }, { height: "0px", opacity: 0, paddingTop: "0px", paddingBottom: "0px", marginTop: "-10px" }],
                { duration: 450, easing: "cubic-bezier(.45, 0, .25, 1)" }).finished.then(() => box.remove());
    box.style.cssText += "margin-top:-10px;height:0;padding:0;opacity:0";   // hold the folded state until it is removed
  }

  say.addEventListener("input", ready);
  // the send arrow stays neutral until there is something to send
  function ready() { $("#c-send").classList.toggle("is-ready", !!say.value.trim()); }
  // when she can choose several, her choices write her answer in the field; the green arrow sends it, like any message
  function compose(text) { say.value = text; ready(); }

  // typing and speaking answer the open question
  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    const v = say.value.trim();
    if (!v || step < 0 || step >= STEPS.length) return;
    answer(v);
  });
  $("#c-mic").addEventListener("click", async () => {
    const s = STEPS[step], mic = $("#c-mic");
    if (!s || !s.sample || mic.classList.contains("is-on")) return;
    mic.classList.add("is-on"); say.value = ""; say.placeholder = "Listening…";
    await wait(900);
    for (const ch of s.sample) { say.value += ch; ready(); await wait(28); }   // her words arrive as she says them
    mic.classList.remove("is-on");
    say.placeholder = "Type your answer…"; ready();
  });

  // the paperclip: she can add a document at any moment. On the papers question it is her answer;
  // anywhere else it is added for Marc and the conversation carries on where it was.
  const files = [];   // everything she added, kept so a print can be opened large
  function added(e) {
    const picked = [...e.target.files].map((f, i) => {
      const kind = /^image\//.test(f.type) ? "img" : /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name) ? "pdf" : "file";
      const p = { id: `f${Date.now()}-${i}`, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 28) || "Photo", from: "Added by you", kind, url: URL.createObjectURL(f) };
      files.push(p); return p;
    });
    e.target.value = "";
    if (!picked.length || step < 0) return;
    answers.files = [...(answers.files || []), ...picked];
    const prints = `<span class="files">${picked.map((p) => paper(p, "is-in")).join("")}</span>`;
    const n = answers.files.length, photos = answers.files.every((p) => p.kind === "img");
    if (STEPS[step] && STEPS[step].id === "papers") return answer(`${n} ${photos ? "photo" : "paper"}${n > 1 ? "s" : ""}`, prints);
    her(`${picked.length > 1 ? `${picked.length} documents` : picked[0].kind === "img" ? "A photo" : "A document"} for Marc`, prints);
    if (!answers.papers) answers.papers = "Added in the conversation";
  }
  $("#c-file").addEventListener("change", added);
  $("#c-camera").addEventListener("change", added);

  // tap a print: a photo opens large over the page, a PDF opens in the phone's own viewer
  const viewer = $("#viewer");
  function openPaper(id) {
    const p = files.find((x) => x.id === id);
    if (!p) return;
    if (p.kind !== "img") return window.open(p.url, "_blank");
    viewer.querySelector("img").src = p.url;
    viewer.querySelector("p").textContent = p.title;
    viewer.hidden = false;
  }
  document.addEventListener("click", (e) => { const t = e.target.closest(".paper[data-id]"); if (t) { e.stopPropagation(); openPaper(t.dataset.id); } }, true);
  document.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest(".paper[data-id]");
    if (t && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); openPaper(t.dataset.id); }
    if (e.key === "Escape") viewer.hidden = true;
  });
  viewer.addEventListener("click", () => { viewer.hidden = true; });

  /* ---------- review ---------- */
  function review(changed) {
    $("#r-list").innerHTML = STEPS.map((s) => {
      const v = s.id === "papers" && answers.files && answers.files.length
        ? `<span class="r-files">${answers.files.map((p) => paper(p)).join("")}</span>` : `<span class="mark">${esc(answers[s.id] || "—")}</span>`;
      return `<button type="button" class="r-row${s.id === changed ? " is-new" : ""}" data-step="${s.id}"><dt>${s.label}</dt><dd>${v}</dd><span class="r-edit">Change</span></button>`;
    }).join("");
    $("#r-list").querySelectorAll(".r-row").forEach((r) => { if (sent) { r.disabled = true; r.querySelector(".r-edit").remove(); } else r.addEventListener("click", () => change(r.dataset.step)); });
    $("#r-title").textContent = sent ? "What you sent to Marc" : "What Marc will read";
    $(".r-text").textContent = sent ? "Marc will read it before your session." : "Check it. Tap a line to change it.";
    $(".r-foot").hidden = sent;
    show("review");
  }
  // changing a line goes back to the conversation and asks that one question again
  async function change(id) {
    show("chat");
    editing = true;
    const k = STEPS.findIndex((s) => s.id === id);
    await bot("Of course. Let's change that.");
    ask(k);
  }

  /* ---------- start, back, send ---------- */
  let sent = false;
  $("#w-start").addEventListener("click", async () => {
    if (sent) return review();   // after sending: what she sent, to read again
    show("chat");
    if (step >= 0) return;   // coming back: the conversation is where she left it
    await bot("Hi Camille M., I'll ask you a few short questions so Marc knows what happened before your session. Only Marc will read your answers, and you can check them before you send.");
    const hello = log.lastElementChild; if (hello) hello.classList.add("intro");
    await wait(1800);   // time to read the hello before the first question; it then stays, and scrolls away with the next question
    ask(0);
  });
  $("#p-back").addEventListener("click", () => {
    if ($("#review").classList.contains("is-on") && !sent) return show("chat");
    home();
  });
  $("#r-send").addEventListener("click", () => { sent = true; show("sent"); });
  $("#s-home").addEventListener("click", home);

  // home, as it is now: before, the one thing to do; after sending, that it is done
  function home() {
    const text = $("#welcome .w-act > .w-text"), btn = $("#w-start");
    if (sent) {
      text.innerHTML = `<span class="w-done"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9"/><path d="M6 10.4l2.6 2.6L14 7.6"/></svg>Sent to Marc</span>He will read it before your session. Nothing else to do until Tuesday.`;
      btn.textContent = "See what you sent";
    } else btn.textContent = step >= 0 ? "Continue preparing" : "Prepare my session";
    show("welcome");
  }


  let bodySvg = "";
  fetch("../../design/illustrations/body-female.svg").then((r) => r.text()).then((t) => (bodySvg = t.replace("<svg", '<svg aria-hidden="true"')));
})();
