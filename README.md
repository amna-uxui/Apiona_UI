# Apiona Web portal

UI and visual design work for the Apiona web portal, which brings practitioners and patients with chronic illness together.

The current focus is the pre-consultation experience: helping a practitioner understand a patient's medical history before the first visit.

Focus scenario: a physiotherapist's first visit with Camille, referred for a mid-foot sprain, who has SEDH (hypermobile Ehlers-Danlos syndrome). The design question: how does the physiotherapist understand her whole medical history in a short time?

## Folders

- `ui/` — the portal screens, one per UX frame, in English
  - `patient-summary.html` — Consultation tab: the patient summary, built for a one-minute read

- `design/` — the design system
  - `tokens.css` — colours (cream, black, white, blue first; yellow, pink and green as markers) and type (Helvetica Neue)
  - `components.css` — shared pieces: collapsible sidebar, patient header, tabs, card board, tags, markers, tables
  - `icons.js` — the icon set (one line style); `app.js` — the sidebar collapse and expand
  - `illustrations/` — body silhouettes, female and male, from the stock vector file (check its licence before publishing)
  - `specimen.html` — a page showing the logo, palette, type and record colours together
  - `logo/` — Apiona logo and icon
    - `apiona-logo.svg`, `apiona-icon.svg` — black, or any colour via CSS
    - `colours/` — logo and icon in black, white, blue, yellow, pink and green
    - Rules: coloured logos on black; black logo on colour; flat coloured icon on cream from 48 px up, black below that

- `references/` — visual references and what we take from each (images stay local)
- `frames/` — the UX team's wireframes, mapped to the flow, with a French → English glossary (wireframe files stay local)

## Viewing the pages

Open an HTML file in a browser (double-click it in Finder). All patient data shown is invented.
