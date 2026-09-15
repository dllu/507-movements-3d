# Movement 152: two-stud trammel ellipsograph

The production loader now uses `trammel-ellipsograph.js`, retaining the source-
measured trammel equations and adding finite guide shoes and bar bushings.
The [source page](https://507movements.com/mm_152.html) marks its Animated tab
unavailable; its canvas fallback text does not establish an available animation.

The source's horizontal stud (207,277.5), vertical stud (263,330), and pencil
(83,159.5) determine the stud spacing and pencil station at 0.014 world units
per pixel. The pencil is projected onto the common bar axis to remove the
small drafting inconsistency. A near-plan default view now preserves these
relationships instead of foreshortening the mechanism. The two stud and pencil
centers agree with the measured plan landmarks within 1.5 pixels. This is a
landmark check, not a claim of pixel-perfect perspective superposition.

The original analytic mechanism traced the right ellipse, but its studs were
loose in oversized bar bores and its ground/camera presentation obscured the
source. Annular bushings now fill the bar bores. Reconstructed rectangular
shoes, with 0.124-radius stud bores, run beneath the bar in the horizontal and
vertical grooves. Their 0.68 length keeps each shoe guided across the crossed
opening; widths 0.332 and 0.412 leave 0.004 clearance at each guide wall. The
stud radius is 0.12. The ideal pin and guide constraints omit clearance motion,
friction, loads and backlash. Shoes and bushings are inferred hidden hardware.

The turn now takes six seconds instead of twelve. The motion remains analytic,
so no live MuJoCo or baked physics data is needed. Ground rendering is hidden,
fog is disabled, the trace is dark and shadowless, and the floating white contact
ball is removed. The trace remains a visual annotation, excluded from solid
contact auditing. Restart returns to the exact source pose.

Verification:

- Two focused tests check actual world-space source landmarks, both rendered
  stud/shoe center alignments, ellipse closure at 1,025 poses, and restart.
- The existing detailed movement-152 test passes its dense kinematic and
  finite-difference checks. Machine-roundoff tolerances for derivatives were
  adjusted for the doubled angular speed; the measured maximum finite velocity
  residual is 3.02e-10 and acceleration residual is 2.01e-5 world units/s².
- `node scripts/review-trammel-assembly.mjs` checks 34 parts, 317 distinct-body
  pairs and 206,180 surface queries across 65 full-turn poses. No unintended
  intersections. Vertices, edge midpoints and triangle centers are queried
  bidirectionally; same-body interfaces and the trace annotation are excluded.
  This finite sampling is not a continuous collision proof. The report with
  source hashes is `docs/validation/152-assembly.json`.
- Production Vite build and packaged Chrome desktop/mobile playback, exact
  restart, orbit/reset, and no-WASM checks pass. Source and oblique renders were
  visually inspected. Private artifacts are under `/dev/shm/152-*`.
