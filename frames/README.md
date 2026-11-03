# UX frames

Wireframes from the UX team, and how they map to the first-visit flow. The UI we build follows these frames for structure and content; our job is the visual design.

The frames are in French. **The UI is in English**: see the glossary below.

Files (local only, not on GitHub):
- `first-visit-flow.jpg` — the flow board: the interaction we focus on
- `patient-summary-wireframes.pdf` — 4 wireframes
- `code/` — the same 4 wireframes as HTML, exported from Figma Make. Static pages, no scripts. The source for structure and content:
  - `index.html` → 1 · Consultation tab (summary)
  - `consultation.html` → 2 · Consultation in progress
  - `suivi.html` → 3 · Follow-up tab
  - `documents.html` → 4 · Documents tab

## How we use them

Each frame becomes one page in `ui/`, built one at a time: same structure and content, written in English, styled only through `design/tokens.css` and shared components. We don't use the Figma Make build setup; the pages are plain HTML like the rest of the project.

---

## The flow, and which frame covers each step

| # | Flow step | Frame |
|---|---|---|
| 1 | Patient enters data to prepare for the first visit | (patient side, not in these frames) |
| 2 | Practitioner is notified, can open the patient's profile | (not in these frames) |
| 3 | **Practitioner opens the summary and sees the data** | **1 · Patient · Consultation tab**, top half |
| 4 | **Practitioner searches and digs into documents or data** | **1 · Details and sources** (bottom half) and **4 · Documents tab** |
| 5 | **Patient enters the room, consultation starts** | **2 · Consultation in progress** |
| 6 | **Practitioner takes notes and dictates** | **2 · Consultation in progress** (dictation bar, report sections) |
| 7 | Practitioner generates, reviews, signs the report | Starts from 2 · "Finish and prepare the report" (report screens not in these frames) |
| 8 | Patient receives the visit summary and documents | (not in these frames) |
| — | Later sessions: the record over time | **3 · Follow-up tab** (session 5 of 9) |

Steps 3 to 6 are the UI/UX opportunity.

---

## The four frames

### 1 · Patient · Consultation tab (before the first session)
Header: name, age, sex, "new patient"; tags for session (Initial assessment · session 1 of 9), case type (Accident), billing status; primary action **Start consultation**. Tabs: Consultation · Follow-up · Documents.

- **In brief** — one sentence assembled from the prescription and record fields, not rephrased.
- Three panels: **What she wants** (her words) · **Know before the session** (5 numbered points with sources, highlighted by the practice's rules) · **To complete in session** (missing info: allergies, medication doses; admin status).
- **Where it hurts** (body silhouette with numbered points) · **What happened** (short timeline from the fall to today).
- **Details and sources**: documented diagnoses table (diagnosis, by whom, note, how it was added) · history, treatments and care team · patient and coverage · prescription (valid).

### 2 · Consultation in progress
Top bar: back to summary, patient and session, draft saved; attendance (Present / Absent, billable / Absent, excused); **Dictate**; **Finish and prepare the report**.

- Assessment type: Initial / Intermediate / Final, assessment date.
- Report sections as steps with progress: 1 Reason and history · 2 Assessment · 3 Goals · 4 Notes · 5 Conclusion · 6 Recommendations.
- Assessment by area (joints, muscles, function, balance) with a **reminder from the record** for that area, a test table, free notes, dictated sentences to approve.
- Goals and methods, each goal linked to what the patient asked for.
- Right panel: **Patient summary** (collapsible), **Ask during the session** (answers get marked "added in session").
- Bottom: **Dictation in progress** bar showing where the text is being filed.

### 3 · Follow-up tab (session 5 of 9)
Filters: All · Session notes · Assessments · Lab results · Preparation. Timeline, newest first: session notes with goals worked on, lab results (out-of-range value marked), the initial assessment (report sent to the GP), the patient's preparation. Side: sessions progress (4 of 9 done), goals and how many sessions each was worked on, what was sent to other carers.

### 4 · Documents tab
Filters: All · Shared by the patient · Created by the practice · Pending. Two tables (shared by the patient; created by the practice, with who it was shared with and its status). Preview panel: origin, shared by, date, where it's quoted in the summary, visibility; Open · Attach to a report · Download. Pending request with **Remind the patient**.

---

## UX principles the visual design must respect

1. **No interpretation by Apiona.** Text is taken from the record as written. The design must never make it look as if the system judged or diagnosed something.
2. **Every item shows its source** (entered by the patient, medical report attached, added in session…).
3. **Highlights come from the practice's own rules**, and say so ("Edit rules").
4. **Missing information is visible** (hatched or dashed), not hidden.
5. **Apiona provides the fields, not the content.**

---

## Glossary · French → English UI

| French | English |
|---|---|
| Agenda · Patients · Facturation | Schedule · Patients · Billing |
| nouvelle patiente | new patient |
| Bilan initial · séance 1 / 9 | Initial assessment · session 1 of 9 |
| Facturation OK | Billing OK |
| Commencer la consultation | Start consultation |
| Consultation · Suivi · Documents | Consultation · Follow-up · Documents |
| En bref | In brief |
| Ce qu'elle veut | What she wants |
| À connaître avant la séance | Know before the session |
| À compléter en séance | To complete in session |
| Où elle a mal | Where it hurts |
| Ce qui s'est passé | What happened |
| Détails et sources | Details and sources |
| Diagnostics documentés | Documented diagnoses |
| Saisi par la patiente · Rapport médical joint | Entered by the patient · Medical report attached |
| Antécédents, traitements et suivis | History, treatments and care team |
| Patiente et couverture | Patient and coverage |
| Ordonnance · Valide | Prescription · Valid |
| Mis en avant selon les règles de votre cabinet · Modifier les règles | Highlighted by your practice's rules · Edit rules |
| Présente · Absente facturable · Absente excusée | Present · Absent, billable · Absent, excused |
| Dicter · Terminer et préparer le rapport | Dictate · Finish and prepare the report |
| Motif et anamnèse · Bilan · Objectifs et moyens | Reason and history · Assessment · Goals and methods |
| Remarques libres · Conclusion · Recommandations | Notes · Conclusion · Recommendations |
| Rappel du dossier pour ce domaine | From the record for this area |
| À demander pendant la séance · Ajouter la réponse | Ask during the session · Add answer |
| Dictée en cours | Dictation in progress |
| Notes de séance · Bilans · Résultats de labo · Préparation | Session notes · Assessments · Lab results · Preparation |
| Partagé par la patiente · Créés par le cabinet · En attente | Shared by the patient · Created by the practice · Pending |
| Demander un document à la patiente · Relancer la patiente | Request a document · Remind the patient |
| Sous la norme · Dans la norme | Below range · In range |

---

## Decisions

- **Practitioner: physiotherapist**, as in the frames. The patient, Camille M., has SEDH (hypermobile Ehlers-Danlos syndrome) alongside the mid-foot sprain she's referred for.
