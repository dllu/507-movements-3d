# Pass-51 wave-3 lane w3h: production MuJoCo movements

Scope: 90, 91, 95, 96, 103, 108, 109, 110, 116, 118, 119, 123, 147, 150.

## Production-route intersection screen

`scripts/show-body-intersections.mjs` screens the synchronous registry model,
which for these IDs is not what the browser shows. The new
`scripts/screen-production-intersections.mjs` builds the production route the
way `model-loader.js` does: live MuJoCo factories with the node MuJoCo runtime
(in place of the Vite WASM URL loader), baked bundles read from disk, special
factories, then source presentation. It then applies the unchanged
relative-motion method of `screen-body-intersections.mjs`: rigid-body clustering
from relative transforms, closed meshes as targets, solid/coaxial/fluid/deforming
classes. Live physics is sampled in increasing time order; `--start` and
`--duration` (seconds) select a playback window, so long-run drift can be
screened. Usage:

    node scripts/screen-production-intersections.mjs --ids=90,91 --spacing=0.01 --samples=129 [--start=94.5 --duration=0.6] [--jobs=6] [--out=...]

Depths are in model units. For all IDs in scope one unit is 100 engraving
pixels. The screen samples one mechanism period from t = 0 (129 samples,
0.01 spacing) unless noted. It is sampled triage, not continuous
certification. All screened meshes were closed (no open shells).

| ID | Route | Worst solid pair (depth, time) | Status |
| --- | --- | --- | --- |
| 90 | live | yoke/sheave 0.00001 | sampled-clear (running contact only) |
| 91 | live | liner0/cam 0.00031 @3.56 s | sampled-clear (intended liner contact, 0.03 px) |
| 95 | live | disk/roller 0.00002 | sampled-clear |
| 96 | live | cam/roller 0.00006 | sampled-clear; spring is deforming (now not presented) |
| 103 | live | external/internal thread 0.00015 | thread contact, 0.015 px |
| 108 | live | lands/shoe 0.00008 (one period); **0.0037 @94.760 s** (window 94.5–95.1 s, 601 samples); 0.0005 over 100–120 s | native soft contact; production screen reproduces the documented 0.36663-px peak |
| 109 | live | none | sampled-clear (workpiece is deforming, not a target) |
| 110 | live | right thread/nut 0.00002 (one period); 0.0005 @26.9 s over 0–64 s (513 samples) | soft thread contact, 0.05 px |
| 116 | live | ratchet/pawl 0.00002 | intended contact |
| 118 | live | pinion/upper rack 0.00004 | intended tooth contact |
| 119 | live | pinion/rack 0.00011 | intended tooth contact |
| 123 | baked | spur/spur 0.00042; sector/rack 0.0002 | intended tooth contact, 0.04 px |
| 147 | baked | shaft/roller 0.00001 | sampled-clear |
| 150 | kinematic factory | none | sampled-clear |

After the changes below, 90, 91, 96, 103, 109 and 150 were rescreened on the
production route with the same worst values (the presentation removals drop
bodies, not pairs).

## Changes

- **90** Smooth ideal-oval yoke: an ellipse split by a straight run for both
  outlines. The inner run is the machined working face through the sweep, and
  the elliptic ends contain the swept circle. It replaces the lumpy hand-traced
  ink, which is kept as `profiles.tracedHole`. Flat front camera; presentation
  removes the undrawn guides, shaft bearing and base (physics keeps ideal
  guides). Hatched shaft-end section face. The 4 eccentric-yoke tests pass.
- **91** Flat front camera; presentation removes the undrawn guide frame, crossbars,
  posts and shaft bearing. Hatched shaft end.
- **96** Flat face camera; presentation removes the undrawn return spring, spring seat,
  bar guides and rear frame (physics keeps the inferred spring).
- **103** The bed is broken off at the right with a jagged break line and the bar
  under the guide is a recessed panel, replacing the closed box with an end
  support and open window. The guide runs to the break.
- **109** The rails are only as deep as the offset shaft bores need (0.17 margin
  instead of 0.26), and the camera field narrows from 14 to 9 degrees, so the
  flat elevation no longer shows deep rail undersides. (An oblique plan bar
  through both bores was tried and rejected: in perspective it slanted.)
- **118** The fit frames the fixed rack, bed and pinion with a margin of 0.8.
  The upper rack, sliding twice the pitman stroke, runs partly out of frame at
  its extremes. maxNdc is 1.13 at the extreme.
- **119** The fit width is clamped to ±3.1, following Brown's broken-off beams. The
  rack's ends run partly out of frame at the extremes of its sweep. maxNdc is 1.26.
- **123** The baked loader clamps the fit height to −3.25…3.1. The rack runs partly
  out of frame at the ends of its sweep. maxNdc is 1.21.
- **150** Both shaft ends carry a thin paper face with ink 45° section lines
  (`src/simulation/section-hatch.js`), replacing the dark end. The passive study's
  mass integration skips presentation-only meshes, so its inertias are
  unchanged. Fingerprinted 150 validation reports were regenerated.

## Not changed (honest residuals)

- **108** The groove still reads as stacked chevrons. With five crossings per
  traverse on a circular barrel, the cylindrical projection cannot give Brown's
  steep straight X crossings. That needs a different lead (and native groove
  bake), not presentation.
- **110** The 0.08-px nut/roller soft penetration is intended native thread
  contact. Rendering an inset would hide rather than fix it.
- **116** Squarer rack-generated teeth were tried with matching rack flanks
  at 10° and 15° pressure angles. Both failed the native two-cycle test. At
  15°, output speed deviated from uniform by up to 0.045 rad/s against its
  0.04 bound. The 20° profile is kept.
- **147** The ramps are the native contact track. Reshaping them requires a
  new bake and transient revalidation, which this lane did not do.
- **95** No change: the wall block and complete disk remain.
