# Apiona Web portal

UI and visual design work for the Apiona web portal, which brings practitioners and patients with chronic illness together.

The current focus is the pre-consultation experience: helping a practitioner understand a patient's medical history before the first visit.

Focus scenario: a physiotherapist's first visit with Camille, referred for a mid-foot sprain, who has SEDH (hypermobile Ehlers-Danlos syndrome). The design question: how does the physiotherapist understand her whole medical history in a short time?

## The direction: a connected record instead of a dashboard

We moved away from a text-heavy dashboard. The patient's record is shown as a small network that gives an overview in a few seconds and then lets the practitioner explore. Critical information is never hidden behind a click, and the network never shows more than a handful of nodes at once.

## Folders

- `experiments/` — interactive prototypes, numbered; each one tests one idea
  - `01-network/` — the patient summary as a network (first page only)
    - Left menu: plain text on white, full height, folds to icons from a handle on its edge. Schedule, Patients (Camille: Summary, Consultation, Follow-up, Documents), Billing. Only the Summary is built so far
    - Overview: Camille and her 5 sections; each section's subtitle already says what is inside
    - Click a section or an item: the network re-arranges around it on springs, with its path back to Camille and dotted lines to related records
    - Nodes lean toward the cursor (magnetic pull); a refresh always returns to the overview
    - The index on the side lists the same record, each section in its own form: icons, a body with pain points, a vertical timeline, a checklist
    - `data.js` holds the record (text from the record, never rephrased); `app.js` the layout and motion; `style.css` the look
    - Add `?still` to the address to turn the motion off (for reviewing layouts)

- `design/` — shared design assets
  - `tokens.css` — the palette and type of the earlier screens
  - `components.css`, `app.js`, `specimen.html` — pieces of the earlier dashboard, kept for reference
  - `icons.js` — the icon set (one line style), used by the prototype's index
  - `illustrations/` — body silhouettes, female and male, from the stock vector file (check its licence before publishing)
  - `media/` — foot X-rays (dorsoplantar and oblique) by Mikael Häggström, M.D., CC0 1.0, from [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:X-ray_of_normal_right_foot_by_oblique_projection.jpg); resized to 900 px tall. Shown as a pile of prints when the X-ray is opened in the prototype
  - `logo/` — Apiona logo and icon
    - `colours/apiona-logo-teal.svg`, `colours/apiona-icon-teal.svg` — the current logo and its icon, used in the prototype's menu
    - `apiona-logo.svg`, `apiona-icon.svg` and the other colours — earlier versions

- `ui/assets/` — the patient and practitioner photos used by the prototype (both people agreed to them being public)
- `references/` — visual references and what we take from each (images stay local)
- `frames/` — the UX team's wireframes, mapped to the flow, with a French → English glossary (wireframe files stay local)

## Colours in the prototype

Each colour carries one meaning. White is the ground; black is the record.

- Yellow — know before the session (highlighted by the practice's own rules)
- Green — her words and wishes; also "Billing: OK"
- Pink — missing or waiting, always with a dashed line
- Blue — you: the selection, today, a new patient
- Coral — the accident (case tag, and the injury on the body)

The font is ABC Areal, loaded from the copy installed on this Mac (it is licensed: the files are never shipped).

## Viewing the prototype

The prototype loads files, so it needs a small local server rather than a double-click:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765/experiments/01-network/ (desktop width). All patient data shown is invented.

Online (GitHub Pages, from `main`): https://amna-uxui.github.io/Apiona_UI/ — the root page opens the prototype. Online, the font falls back to Helvetica Neue (ABC Areal is only installed on this Mac).
