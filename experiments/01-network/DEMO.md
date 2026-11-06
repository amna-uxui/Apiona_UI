# Recording the demo

Every clip plays itself. You only record.

## Before you record

1. Start the local server (or use the live site once this is pushed).
2. Open the clip's link in Chrome, in a window of **1440 × 900** (the header and index are tuned for it).
   Move your own mouse out of the window: in demo mode the page hides the pointer and uses its own soft grey dot.
3. macOS: **Cmd + Shift + 5** → *Record selected portion* → frame the browser's page area → *Record*.
4. Press **Space**. The clip plays. Stop the recording when the dot fades out.

Each link starts as a new patient (nothing saved from earlier takes), and the motion is a little slower than normal so it reads on video. To take a clip again, just reload the link.

Base address: `http://localhost:8765/experiments/01-network/`
(live: `https://amna-uxui.github.io/Apiona_UI/experiments/01-network/`)

## The clips: before, during, after

| # | Link | What it shows | About |
|---|------|---------------|-------|
| 1 | `?demo=1` | **The network re-arranges.** Where it hurts → What happened → What she wants → back to Camille. The core idea: open on this. | 15 s |
| 2 | `?demo=2` | **Know before the session.** Cerebral cavernoma, then Current treatments: each point opens its details and sources. | 10 s |
| 3 | `?demo=3` | **Reports as prints.** The hEDS report arrives as prints beside the network; one click brings them to the middle, a click outside puts them back. | 10 s |
| 4 | `?demo=4` | **Start consultation.** The summary and network step aside, the consultation slides in, a section unfolds. | 7 s |
| 5 | `?demo=5` | **Notes and dictation.** Two notes typed with their time in the session, then dictation: sentences arrive and wait to be approved; one is approved. | 25 s |
| 6 | `?demo=6` | **The body.** Hovering Balance and Muscles lights them up; Function, then Joints are chosen and fill in on the silhouette. | 12 s |
| 7 | `?demo=7` | **Confirm with her.** Three lines of the history are confirmed with the patient, one by one. | 7 s |
| 8 | `?demo=8` | **Finish and sign.** The report assembles as a paper page; signing draws the green seal: *Signed and sent to Dr Favre*. | 12 s |
| 9 | `?demo=9` | **After.** Follow-up, then Documents: two prints chosen, their details shown. | 12 s |
| 10 | `?demo=10` | **On a phone.** The summary card pops from its button, the consultation starts, notes slide up as a sheet and a note is typed. | 20 s |

`?demo=all` plays clips 1 to 9 in one take (about 2 minutes), if you prefer one long recording to cut.

Clips 5 to 8 open the consultation quietly before you press Space, so the recording starts right on the action.

## The phone clip (10)

In Chrome: **View → Developer → Developer Tools**, then the phone icon (*Toggle device toolbar*), choose **iPhone 12 Pro** or similar, and reload `?demo=10`. Record only the phone frame.
For the most convincing shot, film the live site on a real phone with the iPhone's own screen recording instead; it won't play itself, so follow the clip's steps by hand.

## The opening

The first view *grows out of Camille* when the page loads. To catch it, start recording first, then reload `?demo` (no number) and let it settle; then cut to clip 1.

## If you only have time for three

1 (the network), 3 (the prints) and 10 (the phone): the concept, the surprise, and the reach.

## Plain presentation mode

`?demo` alone gives the slower motion and a fresh patient, with nothing playing and your normal pointer, for clicking through live on stage.
