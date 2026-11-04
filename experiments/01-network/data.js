/*
  Camille's record, from frame 1 · Consultation tab (summary).
  Text is the record's own words. Nothing here is written by Apiona.

  Node fields
  - kind:   person | section | item
  - source: patient | report | document | session   (drives the shape)
  - mark:   know | voice | missing | today          (drives the colour, see legend)
  - x, y:   fixed place on the map, Camille at 0,0. The map never re-arranges itself:
            selecting a node moves the camera, not the nodes.
  - open:   visible in the first view without any click
*/

window.RECORD = {
  patient: {
    name: "Camille M.",
    meta: "28 · female",
    isNew: true,   // shown as a "New" tag on her photo
    tags: [
      { text: "Initial assessment · session 1 of 9", tone: "session" },
      { text: "Accident", tone: "accident" },
      { text: "Billing: OK", tone: "ok" },
    ],
    brief:
      "**Mid-foot sprain** after a fall on the stairs. Patient is referred by the emergency department of Clinique Bois-Cerf, X-ray with **no fracture**. **9 sessions** are prescribed.",   // **…** = key facts, shown stronger
  },

  rules: "balance and falls, neurology, respiratory, other pain, treatments",

  // documents behind the points to know: listed after them in the index, open the point they support
  knowDocs: [
    { title: "Medical report · hypermobile Ehlers-Danlos", sub: "GP · attached", opens: "heds" },
    { title: "Medical report · left parietal cavernoma", sub: "Neurosurgery · attached", opens: "cavernoma" },
  ],
  prepared: { when: "[date]", event: "Prepares and sends her file" },

  nodes: [
    { id: "camille", kind: "person", label: "Camille M.", sub: "28 · female", x: 0, y: 0, open: true },

    /* 1 · Know before the session — highlighted by the practice's rules */
    { id: "know", kind: "section", n: 1, mark: "know", parent: "camille", label: "Know before the session", sub: "hEDS · dizziness · cavernoma · asthma · other pain", x: -270, y: -150, open: true },
    {
      id: "heds", icon: "bone", kind: "item", parent: "know", mark: "know", source: "report", open: true,
      label: "Hypermobility (Ehlers-Danlos)", sub: "GP · report attached", x: -540, y: -290,
      type: "Diagnosis", title: "Hypermobile Ehlers-Danlos syndrome",
      quote: "Ligament laxity, joint instability, repeated sprains, proprioception problems",
      facts: [["Diagnosed by", "GP"], ["Added to the record", "Medical report attached"]],
      rule: "balance and falls",
      links: ["midfoot", "history", "docs"],
    },
    {
      id: "dizzy", icon: "dizzy", kind: "item", parent: "know", mark: "know", source: "patient", open: true,
      label: "Frequent dizziness", sub: "Neurology clinic · by the patient", x: -560, y: -170,
      type: "Diagnosis", title: "Chronic migraines",
      quote: "Frequent dizziness",
      facts: [["Diagnosed by", "Neurology outpatient clinic"], ["Added to the record", "Entered by the patient"]],
      rule: "neurology",
      links: ["treatments"],
    },
    {
      id: "cavernoma", icon: "brain", kind: "item", parent: "know", mark: "know", source: "report", open: true,
      label: "Cerebral cavernoma", sub: "Neurosurgery · report attached", x: -560, y: -40,
      type: "Diagnosis", title: "Left parietal cavernoma, 7 mm",
      quote: "History of bleeding episodes",
      facts: [["Diagnosed by", "Neurosurgery"], ["Added to the record", "Medical report attached"]],
      rule: "neurology",
      links: ["docs"],
    },
    {
      id: "asthma", icon: "wind", kind: "item", parent: "know", mark: "know", source: "patient", open: true,
      label: "Asthma", sub: "Pulmonologist · by the patient", x: -440, y: 50,
      type: "Diagnosis", title: "Asthma",
      quote: "Breathless on exertion",
      facts: [["Diagnosed by", "Pulmonologist"], ["Added to the record", "Entered by the patient"]],
      rule: "respiratory",
      links: ["treatments"],
    },
    {
      id: "otherpain", icon: "zap", kind: "item", parent: "know", mark: "know", source: "patient", open: true,
      label: "Other pain", sub: "Patient · hand centre", x: -300, y: -350,
      type: "Diagnosis", title: "Extensor tendinopathy of the fingers, right wrist",
      quote: "Right knee (compensation), right wrist (crutches), already followed at the hand centre",
      facts: [["Diagnosed by", "Hand centre"], ["Note", "“Limited use of the right hand”"], ["Added to the record", "Entered by the patient"]],
      rule: "other pain",
      links: ["knee", "wrist"],
    },
    {
      id: "treatments", icon: "pill", kind: "item", parent: "know", mark: "know", source: "patient", open: true,
      label: "Current treatments", sub: "Patient · doses not given", x: -60, y: -330,
      type: "Treatments", title: "Asthma treatment · duloxetine · botulinum toxin (migraines)",
      quote: null,
      facts: [["Source", "Entered by the patient"], ["Doses", "Not given, ask in session"]],
      rule: "treatments",
      links: ["doses", "asthma", "dizzy"],
    },

    /* 2 · What she wants — her voice */
    { id: "wants", kind: "section", n: 2, mark: "voice", parent: "camille", label: "What she wants", sub: "“Above all, less pain.”", x: 170, y: -210, open: true },
    {
      id: "lesspain", kind: "item", parent: "wants", mark: "voice", source: "patient", open: true,
      label: "“Above all, less pain.”", sub: "Her words · preparation", x: 150, y: -360,
      type: "Her words", title: "“Above all, less pain. I sleep badly and it hurts even sitting at my desk.”",
      quote: null,
      facts: [["Source", "Patient’s words · preparation of [date]"]],
      links: ["midfoot"],
    },
    {
      id: "howlong", icon: "history", kind: "item", parent: "wants", mark: "voice", source: "patient",
      label: "To know how long it will take", sub: "Expects from this visit", x: 360, y: -330,
      type: "Her expectation", title: "To know how long it will take",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: [],
    },
    {
      id: "exercises", icon: "home", kind: "item", parent: "wants", mark: "voice", source: "patient",
      label: "To leave with home exercises", sub: "Expects from this visit", x: 400, y: -220,
      type: "Her expectation", title: "To leave with home exercises",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: [],
    },

    /* 3 · Where it hurts */
    { id: "hurts", kind: "section", n: 3, parent: "camille", label: "Where it hurts", sub: "Mid-foot · right knee · right wrist", x: 300, y: 10, open: true },
    {
      id: "midfoot", spot: [76, 440], tone: "injury", kind: "item", parent: "hurts", source: "patient",
      label: "Mid-foot", sub: "Patient · preparation", x: 520, y: -70,
      type: "Where it hurts", title: "Mid-foot [side]",
      quote: "Swollen, limping, pain when walking, at night and sitting",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: ["heds", "fall", "lesspain"],
    },
    {
      id: "knee", spot: [77, 317], tone: "other", kind: "item", parent: "hurts", source: "patient",
      label: "Right knee", sub: "Patient · preparation", x: 560, y: 40,
      type: "Where it hurts", title: "Right knee",
      quote: "Since she started compensating",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: ["otherpain"],
    },
    {
      id: "wrist", spot: [33, 221], tone: "other", kind: "item", parent: "hurts", source: "patient",
      label: "Right wrist", sub: "Patient · preparation", x: 500, y: 140,
      type: "Where it hurts", title: "Right wrist",
      quote: "From the crutches",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: ["otherpain"],
    },

    /* 4 · What happened */
    { id: "happened", kind: "section", n: 4, parent: "camille", label: "What happened", sub: "Fall on Saturday · session 1 today", x: 200, y: 230, open: true },
    {
      id: "history", when: "Before", event: "Ankle sprains · left shoulder stabilised, 2021", kind: "item", parent: "happened", source: "patient",
      label: "Related history", sub: "Ankle sprains · shoulder, 2021", x: 40, y: 420,
      type: "Related history", title: "Several ankle sprains · arthroscopic stabilisation of the left shoulder (recurrent dislocations), 2021",
      facts: [["Source", "Patient · emergency prescription · X-ray report"]],
      links: ["heds"],
    },

    {
      id: "fall", when: "Saturday", event: "Misses a step on the stairs of her building", kind: "item", parent: "happened", source: "patient",
      label: "Saturday · the fall", sub: "Patient", x: 210, y: 440,
      type: "What happened", title: "Saturday · misses a step on the stairs of her building",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: ["midfoot", "emergency"],
    },
    {
      id: "emergency", when: "Sunday", event: "Bois-Cerf emergency · X-ray: no fracture · 9 sessions", kind: "item", parent: "happened", source: "document",
      label: "Sunday · emergency, X-ray", sub: "Prescription · X-ray report", x: 390, y: 450,
      type: "What happened", title: "Sunday · Bois-Cerf emergency",
      quote: "X-ray: no fracture · 9 sessions",
      facts: [["Source", "Emergency prescription · X-ray report"]],
      links: ["prescription", "docs"],
    },
    {
      id: "employer", when: "Monday", event: "The employer reports the accident", kind: "item", parent: "happened", source: "patient",
      label: "Monday · accident reported", sub: "Patient", x: 560, y: 400,
      type: "What happened", title: "Monday · the employer reports the accident",
      facts: [["Source", "Patient · preparation of [date]"]],
      links: ["coverage"],
    },
    {
      id: "today", when: "Today", event: "Session 1 of 9 · initial assessment", kind: "item", parent: "happened", mark: "today", source: "session",
      label: "Today · session 1 of 9", sub: "Initial assessment", x: 670, y: 310,
      type: "What happened", title: "Today · session 1 of 9",
      facts: [["Before today", "[date] · prepares and sends her file"], ["Prescription", "9 sessions"]],
      links: ["prescription"],
    },
    /* 5 · To complete in session — missing or waiting */
    { id: "complete", kind: "section", n: 5, mark: "missing", parent: "camille", label: "To complete in session", sub: "Allergies · doses · date · insurer", x: -170, y: 200, open: true },
    {
      id: "allergies", kind: "item", parent: "complete", mark: "missing", source: "patient", open: true,
      label: "Allergies", sub: "Not given", x: -400, y: 170,
      type: "Missing", title: "Allergies", missing: true,
      facts: [["Status", "Not given by the patient"]],
      action: "Ask in session",
      links: [],
    },
    {
      id: "doses", kind: "item", parent: "complete", mark: "missing", source: "patient", open: true,
      label: "Doses of medication", sub: "Not given", x: -440, y: 260,
      type: "Missing", title: "Doses of medication", missing: true,
      facts: [["Status", "Not given by the patient"], ["For", "Asthma treatment · duloxetine · botulinum toxin"]],
      action: "Ask in session",
      links: ["treatments"],
    },
    {
      id: "assessdate", kind: "item", parent: "complete", mark: "missing", source: "session", open: true,
      label: "Assessment date", sub: "To fill in", x: -270, y: 330,
      type: "To complete", title: "Assessment date", missing: true,
      facts: [["Status", "To fill in during the session"]],
      links: [],
    },
    {
      id: "insurer", kind: "item", parent: "complete", mark: "missing", source: "document", open: true,
      label: "Letter from the insurer", sub: "Waiting", x: -120, y: 300,
      type: "Administrative", title: "Letter from the insurer", missing: true,
      facts: [["Status", "Pending"], ["Case", "Accident case corrected by the patient"], ["Claim number", "Provided"]],
      links: ["coverage"],
    },

    /* Details and sources: not drawn in the first view. They appear, linked by dotted lines,
       when you select something that cites them, and they are always listed in the index. */
    {
      id: "docs", icon: "file-text", kind: "item", source: "document",
      label: "Documents · 5", sub: "Scanned by the patient", x: -700, y: -250,
      type: "Documents", title: "Documents attached · 5",
      list: ["Prescription", "Insurance card", "X-ray", "Privacy notice signed", "GP consent"],
      facts: [["Source", "Patient, preparation of [date] · documents scanned by her"]],
      links: ["heds", "cavernoma", "emergency"],
    },
    {
      id: "prescription", icon: "clipboard", kind: "item", source: "document",
      label: "Prescription · valid", sub: "Emergency, Bois-Cerf", x: 600, y: 440,
      type: "Prescription", title: "Emergency, Clinique Bois-Cerf · mid-foot sprain · 9 sessions (tariff item 7301)",
      facts: [["Status", "Valid"], ["Source", "Scanned by the patient, read automatically"]],
      links: ["emergency", "today"],
    },
    {
      id: "careteam", icon: "users", kind: "item", source: "patient",
      label: "Care team · 4", sub: "About ten carers in total", x: 700, y: 170,
      type: "Care team", title: "Care team",
      list: ["GP · coordination · Dr [Name] · will be informed (consent signed)", "Prescriber · Emergency, Bois-Cerf", "Physiotherapist · jaw · [Name]", "Occupational therapist · right wrist · [Name]"],
      facts: [["Source", "Record confirmed up to date by the patient on [date]"]],
      links: ["wrist"],
    },
    {
      id: "coverage", icon: "shield", kind: "item", source: "patient",
      label: "Patient and coverage", sub: "Accident · insurer", x: -120, y: 480,
      type: "Patient and coverage", title: "Patient and coverage",
      facts: [["Address", "[Street], Vevey"], ["Case", "Accident · corrected by the patient"], ["Claim no.", "Provided"], ["Employer", "[Employer]"], ["Occupation", "Architectural draughtswoman, 60 %, mostly seated, site visits"], ["Insurance", "[Insurer] · supplementary cover given"]],
      links: ["insurer", "employer"],
    },
  ],
};
