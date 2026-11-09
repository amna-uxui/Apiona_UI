/*
  Camille prepares her first session with Marc. One question at a time; she answers with a tap, by typing, or by speaking.
  What she says becomes the green "told by her" lines on Marc's side. The conversation is scripted (no AI): it goes the same way
  every time, so the demo is reliable. ?still turns the motion off.
*/
(function () {
  const $ = (s) => document.querySelector(s);
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches || new URLSearchParams(location.search).has("still");
  const wait = (ms) => new Promise((r) => setTimeout(r, still ? 0 : ms));
  const log = $("#log"), say = $("#say"), composer = $("#composer");

  // the body, front view: her right is on the left of the picture (the same drawing as on Marc's side)
  const SPOTS = [
    ["head", "Head", 100, 22], ["neck", "Neck", 100, 60],
    ["r-shoulder", "Right shoulder", 62, 86], ["l-shoulder", "Left shoulder", 139, 86],
    ["back", "Lower back", 100, 175],
    ["r-wrist", "Right wrist", 33, 221], ["l-wrist", "Left wrist", 168, 221],
    ["r-hip", "Right hip", 78, 222], ["l-hip", "Left hip", 123, 222],
    ["r-knee", "Right knee", 77, 317], ["l-knee", "Left knee", 124, 317],
    ["r-foot", "Right foot", 76, 440], ["l-foot", "Left foot", 125, 440],
  ];
  const PAPERS = [{ id: "xray", title: "X-ray report", from: "Bois-Cerf emergency" }, { id: "rx", title: "Prescription", from: "9 sessions" }];

  // the seven questions, in order. `label` names the line on the review; `sample` is what she says when she speaks.
  const STEPS = [
    { id: "why", label: "Why", lines: ["What brings you to physiotherapy?"],
      tool: { type: "chips", options: ["I fell", "A pain that came slowly", "After an operation"] }, sample: "I fell" },
    { id: "how", label: "What happened", lines: ["I'm sorry to hear that. When did it happen, and how?"],
      tool: { type: "chips", options: ["Saturday, on the stairs of my building", "During sport", "At work"] }, sample: "Saturday, I missed a step on the stairs of my building" },
    { id: "where", label: "Where", lines: ["Where does it hurt? Tap on the body. You can choose more than one place."],
      tool: { type: "body" }, sample: "My right foot, my right knee and my right wrist" },
    { id: "pain", label: "Pain", lines: ["At its worst, how strong is the pain?", "And when is it worst?"],
      tool: { type: "pain", options: ["Walking", "On the stairs", "At night", "Sitting"] }, sample: "About 6 out of 10, when I walk and at night" },
    { id: "health", label: "Also", lines: ["Is there anything else about your health Marc should know? Even if it seems unrelated."],
      tool: { type: "chips", multi: true, options: ["I often feel dizzy", "I get breathless on stairs", "Headaches", "Nothing else"] }, sample: "I often feel dizzy, and I get breathless when I climb stairs" },
    { id: "wants", label: "You would like", lines: ["What would you most like from this first session?"],
      tool: { type: "chips", multi: true, options: ["Less pain", "To know how long it will take", "Exercises for home", "Back to site visits"] }, sample: "Above all, less pain. And to know how long it will take" },
    { id: "papers", label: "Papers", lines: ["Did the emergency give you any papers? A photo is enough."],
      tool: { type: "papers" }, sample: null },
  ];
  const ACK = { where: "Thank you. Marc will look at each of them.", health: "Good to know. Marc will keep it in mind.", wants: "Noted." };
  const answers = {};
  let step = -1, editing = false, busy = false;

  /* ---------- screens ---------- */
  function show(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("is-on", s.id === id));
    $("#p-back").hidden = id === "welcome" || id === "sent";
    $("#p-step").hidden = id !== "chat";
  }
  function progress() { $("#p-step").textContent = `Preparing · ${Math.min(step + 1, STEPS.length)} of ${STEPS.length}`; }

  /* ---------- the conversation ---------- */
  const scroll = () => setTimeout(() => log.scrollTo({ top: log.scrollHeight, behavior: still ? "auto" : "smooth" }), 30);
  function add(html, cls) {
    const li = document.createElement("li");
    li.className = cls;
    li.innerHTML = html;
    log.appendChild(li);
    scroll();
    return li;
  }
  async function bot(text) {
    const t = add("<i></i><i></i><i></i>", "msg bot typing");
    t.setAttribute("aria-label", "Typing");
    await wait(Math.min(1100, 380 + text.length * 12));
    t.classList.remove("typing"); t.removeAttribute("aria-label");
    t.textContent = text;
    scroll();
  }
  function her(text, extra = "") { add(`${esc(text)}${extra}`, "msg her"); }
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const paper = (p, cls = "") => `<span class="paper ${cls}" aria-label="${p.title}"><b>${p.title}</b><i></i><i></i><i></i><i></i></span>`;

  async function ask(k) {
    step = k; progress();
    const s = STEPS[k];
    composer.classList.add("is-off");
    for (const line of s.lines) await bot(line);
    composer.classList.remove("is-off");
    say.placeholder = s.tool.type === "papers" ? "Or tell Marc about them" : "Or type your answer";
    tool(s);
  }

  function tool(s) {
    const box = add("", "tool");
    box.dataset.step = s.id;
    const t = s.tool;
    if (t.type === "chips") {
      box.innerHTML = `<div class="chips">${t.options.map((o) => `<button type="button" class="chip" ${t.multi ? 'aria-pressed="false"' : ""}>${o}</button>`).join("")}</div>
        ${t.multi ? `<div class="tool-row"><button type="button" class="chip is-done" disabled>Done</button></div>` : ""}`;
      const done = box.querySelector(".is-done");
      box.querySelectorAll(".chip:not(.is-done)").forEach((c) => c.addEventListener("click", () => {
        if (!t.multi) return answer(c.textContent);
        const none = c.textContent === "Nothing else";
        if (none) box.querySelectorAll('.chip[aria-pressed]').forEach((x) => x !== c && x.setAttribute("aria-pressed", "false"));
        else box.querySelectorAll('.chip[aria-pressed]').forEach((x) => x.textContent === "Nothing else" && x.setAttribute("aria-pressed", "false"));
        c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true");
        done.disabled = !box.querySelector('.chip[aria-pressed="true"]');
      }));
      if (done) done.addEventListener("click", () => answer(list([...box.querySelectorAll('.chip[aria-pressed="true"]')].map((x) => x.textContent))));
    }
    if (t.type === "body") {
      box.innerHTML = `<div class="body-pick"><div class="body-fig">${bodySvg}${SPOTS.map(([id, name, x, y]) =>
          `<button type="button" class="spot" data-id="${id}" aria-pressed="false" aria-label="${name}" style="left:${(x / 201) * 100}%;top:${((y + 10) / 471) * 100}%"></button>`).join("")}</div>
        <div><p class="tool-label">Where it hurts</p><ul class="body-list"><li class="none">Nothing chosen yet</li></ul></div></div>
        <div class="tool-row"><button type="button" class="chip is-done" disabled>Done</button></div>`;
      const ul = box.querySelector(".body-list"), done = box.querySelector(".is-done");
      const chosen = () => [...box.querySelectorAll('.spot[aria-pressed="true"]')].map((b) => b.getAttribute("aria-label"));
      box.querySelectorAll(".spot").forEach((b) => b.addEventListener("click", () => {
        b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") !== "true");
        const c = chosen();
        ul.innerHTML = c.length ? c.map((n) => `<li>${n}</li>`).join("") : `<li class="none">Nothing chosen yet</li>`;
        done.disabled = !c.length;
      }));
      done.addEventListener("click", () => answer(list(chosen())));
    }
    if (t.type === "pain") {
      box.innerHTML = `<div class="scale" role="group" aria-label="Pain from 0 to 10">${Array.from({ length: 11 }, (_, n) => `<button type="button" aria-pressed="false">${n}</button>`).join("")}</div>
        <div class="scale-ends"><span>No pain</span><span>The worst</span></div>
        <p class="tool-label">Worst when</p>
        <div class="chips">${t.options.map((o) => `<button type="button" class="chip" aria-pressed="false">${o}</button>`).join("")}</div>
        <div class="tool-row"><button type="button" class="chip is-done" disabled>Done</button></div>`;
      const done = box.querySelector(".is-done");
      let level = null;
      box.querySelectorAll(".scale button").forEach((b) => b.addEventListener("click", () => {
        box.querySelectorAll(".scale button").forEach((x) => x.setAttribute("aria-pressed", x === b));
        level = b.textContent; done.disabled = false;
      }));
      box.querySelectorAll(".chips .chip").forEach((c) => c.addEventListener("click", () => c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") !== "true")));
      done.addEventListener("click", () => {
        const when = [...box.querySelectorAll('.chips .chip[aria-pressed="true"]')].map((x) => x.textContent.toLowerCase());
        answer(`${level} out of 10${when.length ? `, worst ${list(when)}` : ""}`);
      });
    }
    if (t.type === "papers") {
      box.innerHTML = `<div class="chips"><button type="button" class="chip" data-a="photo">Take a photo</button><button type="button" class="chip" data-a="file">Choose a file</button><button type="button" class="chip" data-a="none">I have none</button></div>`;
      box.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => {
        if (c.dataset.a === "none") return answer("None");
        // the prototype has her two papers ready: the X-ray report and the prescription
        answers.files = PAPERS;
        answer(`${PAPERS.length} papers`, `<span class="files">${PAPERS.map((p) => paper(p, "is-in")).join("")}</span>`);
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
    if (box) box.classList.add("is-done");
    her(text, extra);
    answers[s.id] = text;
    if (s.id === "papers" && text === "None" && !(answers.files || []).length) answers.files = [];
    say.value = "";
    if (editing) { editing = false; await wait(500); review(s.id); busy = false; return; }
    if (ACK[s.id]) await bot(ACK[s.id]);
    busy = false;
    if (step + 1 < STEPS.length) return ask(step + 1);
    await bot("That's everything. Here is what Marc will read. You can change anything before you send it.");
    const end = add(`<div class="tool-row" style="justify-content:flex-start"><button type="button" class="chip is-done">Check and send</button></div>`, "tool");
    end.querySelector("button").addEventListener("click", () => review());
    composer.classList.add("is-off");
    step = STEPS.length; progress();
  }

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
    for (const ch of s.sample) { say.value += ch; await wait(28); }   // her words arrive as she says them
    mic.classList.remove("is-on");
    say.placeholder = "Or type your answer";
  });

  // the paperclip: she can add a document at any moment. On the papers question it is her answer;
  // anywhere else it is added for Marc and the conversation carries on where it was.
  $("#c-file").addEventListener("change", (e) => {
    const picked = [...e.target.files].map((f, i) => ({ id: `f${Date.now()}-${i}`, title: f.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 28), from: "Added by you" }));
    e.target.value = "";
    if (!picked.length || step < 0) return;
    answers.files = [...(answers.files || []), ...picked];
    const prints = `<span class="files">${picked.map((p) => paper(p, "is-in")).join("")}</span>`;
    if (STEPS[step] && STEPS[step].id === "papers") return answer(`${answers.files.length} paper${answers.files.length > 1 ? "s" : ""}`, prints);
    her(`${picked.length > 1 ? `${picked.length} documents` : "A document"} for Marc`, prints);
    if (!answers.papers) answers.papers = "Added in the conversation";
  });

  /* ---------- review ---------- */
  function review(changed) {
    $("#r-list").innerHTML = STEPS.map((s) => {
      const v = s.id === "papers" && answers.files && answers.files.length
        ? `<span class="r-files">${answers.files.map((p) => paper(p)).join("")}</span>` : `<span class="mark">${esc(answers[s.id] || "—")}</span>`;
      return `<button type="button" class="r-row${s.id === changed ? " is-new" : ""}" data-step="${s.id}"><dt>${s.label}</dt><dd>${v}</dd><span class="r-edit">Change</span></button>`;
    }).join("");
    $("#r-list").querySelectorAll(".r-row").forEach((r) => r.addEventListener("click", () => change(r.dataset.step)));
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
  $("#w-start").addEventListener("click", async () => {
    show("chat");
    if (step >= 0) return;   // coming back: the conversation is where she left it
    await bot("Hello Camille M. I'm Apiona's assistant. I'll help you prepare your first session with Marc, so he knows where you are before you arrive.");
    ask(0);
  });
  $("#p-back").addEventListener("click", () => {
    if ($("#review").classList.contains("is-on")) return show("chat");
    show("welcome");
    $("#w-start").textContent = step >= 0 ? "Continue preparing" : "Prepare my session";
  });
  $("#r-send").addEventListener("click", () => show("sent"));
  $("#s-again").addEventListener("click", () => location.reload());

  // the greeting follows her time of day
  const h = new Date().getHours();
  $("#w-greet").textContent = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  let bodySvg = "";
  fetch("../../design/illustrations/body-female.svg").then((r) => r.text()).then((t) => (bodySvg = t.replace("<svg", '<svg aria-hidden="true"')));
})();
