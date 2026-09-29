# Pass 101, lane p101-u5: 377 posture, 394 involute rack

Claims: authored-person-treadmills.js, treadmill-gait.js, authored-parsons-racks.js, generated-parsons-ends.js, display-profiles.json (377 entry only), source-presentation.js (src/data, 377 entry only).

Scratch and captures: `/dev/shm/p101/u5/` (studies in `g/`).

## 394 Parsons's endless rack: standard involute teeth throughout

**User.** "The rack needs the ideal trapezoidal teeth shape that fits with the involute gear instead of square teeth."

**Before.** Pass 99 gave the rows zero-pressure-angle box notches. The ends were box-form internal gears relieved by a 2608-point pinion sweep (`generated-parsons-ends.js`), which left narrowing, irregular end notches (`/dev/shm/p99/e/394/a-z.png`).

**Change** (`src/simulation/authored-parsons-racks.js`; the module, tooth counts 10/42/14, path, flanges, band outline, rod and collar are unchanged):
- **One standard involute system, 25° pressure angle.** The pinion is shifted +0.3m. Every member has addendum 0.8m and dedendum 0.95m.
  - The rack and ring tips stand 0.5m inside the pinion pitch line, and the pinion tips reach 1.1m outside it.
  - The rack addendum inside the pitch line is 0.5m, within the undercut limit rp·sin²α = 0.89m, so the 10-tooth pinion has no undercut.
- **Rows.** Each row is a basic rack: trapezoidal spaces with straight flanks at 25° from the tip line to a flat root. The spaces are 1.75m (0.56 pitch) deep.
  - Tooth tips are 0.26 pitch (0.80m), as on a standard basic rack; roots are 0.22 pitch wide.
  - The two junction spaces are whole trapezoids whose flanks continue inside the ring tip circle, so no tip corner is left standing.
- **Ends.** The ends are standard involute internal gears of the same module, angle, shift and depths. Each end's void is a 14-tooth external involute "cutter" whose tooth thickness at the pitch circle equals the rows' space width there, running from the ring tip circle (the rows' tip line) to the root circle (the rows' root line).
  - Studied over α = 20–30° with shift and addendum (`g/endstudy.py`, `g/endplay.py`, `g/grid.py`): at 20° and 22.5° the 10/14 internal mesh interferes unless the ring tips are cut back, whereas 25° with shift 0.3–0.45 is interference-free with full-depth tips.
  - The pinion-sweep relief is therefore gone. `generated-parsons-ends.js`, `scripts/generate-parsons-ends.py` and `scripts/export-parsons-geometry.mjs` are deleted.
- **Pinion.** It is the same involute generator (`involuteGearOutline`, unchanged and shared with `authored-scroll-gears.js`). Its tips are 0.57m thick; at 25° with shift 0.45 they would be 0.38m.

**Mesh check.** Shapely was run at 1200 poses round the whole path, including the four row/end junctions (`analyse.py`). Free play is the largest turn at the pitch circle, each way, before touching.

| | Overlap | Total free play |
|---|---|---|
| Rows | 0 | 0.0038–0.0040 |
| Ends and junctions | 0 | 0.0038–0.0049 |

- The largest one-sided play is 0.0030, which is 0.023m.
- Contact ratios are 1.11 on the rows and 1.23 on the ends.

**Captures** (`/dev/shm/p101/u5/`):
- `394-tile.png`: the plate, the default view, and yaw ±40 / pitch ±25.
- `394-zooms.png`, `394-zz.png` and `394-close.png`: close-ups of the row mesh, a junction and an end at phases 0–0.47.
- `394-before-after.png`.
- `new-2d.png` and `z1.png`: 2-D band and pinion plots.

**Checks.**
- `tests/movement-394.test.mjs`: 6/6 pass.
  - The tooth-form test now asserts a 25° angle, straight rack flanks at ±tan 25°, rack tips of p/2 − b − 2a·tan α, no undercut, contact ratios ≥ 1.1 and pinion tips ≥ 0.5m.
  - A new test bisects the free play at 160 poses round the path: it must lie between 0.003 and 0.0055 everywhere.
  - The provenance-digest test for the deleted generated file is removed.
- `movement-395`, `camera-catalog`, `opening-camera-motion`, `authored-loader` and `source-presentation` pass.
- Screens:
  - body intersections: worst 0;
  - disconnected parts: 0 detached, 0 slivers, 0 lips, and the same 5 near-miss pairs as before;
  - coincident faces: 0;
  - loop seams: 0.
- The 394 display profile is unchanged on re-measure. No validation report fingerprints the file.

**Proposed ledger row (394):**
- **assessment:** reasonable
- **visibleFlaws:** ""
- **limits:** replace the "p99: zero-pressure-angle box rows …" clause with: "p101: standard 25° involute gearing throughout. The rows are a basic rack (straight 25° flanks, tips 0.26 pitch, flat roots, 0.56 pitch deep). The ends are standard involute internal gears of the same module, shift (+0.3m) and depths, and need no relief at 25°. The pinion is not undercut (tips 0.57m). Contact ratios are 1.11 on the rows and 1.23 on the ends. There is no overlap at 1200 poses, and total free play is 0.0038–0.0049 at the pitch circle all round, junctions included. Brown's box teeth are not reproduced; the user asked for involute trapezoids."

## 377 The treadmill walker: an upright climb

**User.** "The gait does read as seated, so we'll need to improve the dude's posture." The brief asks for an upright torso, hips over the stance foot, knees mostly extended at stance, and hands on a rail at shoulder or chest height, with the rail lowered and trimmed.

**Why the old station could not be upright** (re-derived, `g/ev.mjs`, `g/grid.mjs`):
- With radial boards near axle height, the drum's side is a vertical ladder of shelves 0.67 apart, about half the leg.
- A 2-D grid over hip x 1.6–2.6 and y 0.6–1.8, touchdown −5° to 40°, stance and swing found no board-clear gait with the hips less than 0.7 outboard of the feet. The best mean planted thigh was about 70°; the committed gait had 87° with the hips 0.95 out.
- The raised knee always meets the shelf above, which confirms p84–p99.
- Tilting the boards alone does not help at axle height either, because the ladder is still vertical.

**The fix.** He climbs the drum's upper quarter, where its descending face is a staircase, on boards turned 35° off radial. They are still 14 cross-width boards, equally spaced and rigid, but each is turned about its own centre so its tread is level at 35° above the axle.
- A generalized gait study (`g/ev2.mjs`, `g/ev3.mjs`, `g/grid3-5.mjs`, `g/swing.mjs`, `g/hy.mjs`) swept station angle, board tilt, foot position, hip position, stance and swing.
- It tested leg capsules and the actual shoe box against finite boards, and the torso against the drum.
- Pareto result (hips over the mid-stance foot versus height):

| Station | Hips above axle | Hips outboard of mid-stance foot | Mean planted thigh |
|---|---|---|---|
| 20° | 1.69 | 0.51 | 62° |
| 30° | 1.99 | 0.31 | 52° |
| 35° | 2.10 | 0.17 | 46° |
| 40° | 2.23 | 0.15 | 44° |

The 35° station is chosen.

**Change** (`treadmill-gait.js`, `authored-person-treadmills.js`):
- **Gait helper.** It takes an optional `boardTilt`, with `footRadial` now measured along the tilted board; the sole angle follows the board. It also takes `swingEase`, the exponent of the Hermite velocity terms; 2 is the old cubic.
  - The defaults reproduce the old helper exactly, and 377 is its only user.
- **Boards and lugs.** The boards are turned −35° off radial. The end-ring lugs move with their boards, 0.15 along the board's axis and across it.
- **Gait parameters:**
  - hip (1.46, 2.105) from the axle (was (2.51, 0.75));
  - touchdown 48.37°, stance 0.52;
  - foot 0.07 out along its board;
  - swing out 0.8, up 2.0, ease 8;
  - wheel start −3.47°, so that phase 0 is Brown's pose: one leg ending its stance and the other just set on the board above.
- **Result:**
  - mean planted thigh 46° from vertical (was 87°);
  - hips 0.16 outboard of the mid-stance foot and 0.04 from it at lift-off (was 0.95);
  - stance knee about 25° at lift-off, and the raised thigh about level at touchdown;
  - treads within 13.4° of level under the sole; planted ankle at most 35°;
  - the torso is upright (lean 0).
- **Rail and arms:**
  - The rail is at shoulder height, 0.45 in front of the chest (was above the cap).
  - The Blender sleeves are re-posed as two rigid bones blended over ±0.08 at the elbow, keeping both bone lengths. The elbows are held out and down, and the fists are turned 45° about the rail so each wrist faces its elbow.
- **Rail trim:**
  - The rail now ends 0.3 past the far hand (was 0.2 past the far end ring).
  - The plank stands 0.25 in front of the bearing standard (was 0.90), so the near overhang is 0.73 shorter.
  - The hidden rail post is removed, so the plank alone carries the rail, as the presentation note says.
- **View.** The presentation camera (`src/data/source-presentation.js`) is raised about 15°, from [1, 0.02, 0.62] to [1, 0.32, 0.62]. He then stands among the treads with steps above his feet, as in the plate. The `fixed-hand-rail-support` removal pattern is dropped, since no post exists now. The 377 display profile is re-measured.

**Residual (the price of the posture).**
- His hips stand 2.1 above the axle, where Brown draws them 0.75. His feet work between 22° and 48° above the axle, where Brown's are near axle level. His cap is about a man's torso above the drum top, where Brown's is level with it.
- The boards are no longer radial. Brown's plate cannot show their angle, and they read as level stair treads at the station, much as he draws them.
- The spur wheel is seen a little more obliquely from the raised camera.
- A lead rejected a similar "walker on the drum top" redesign in m19 (stash `377-drum-redesign-rejected`), for the station height and a knee that parted. The knee is now one continuous limb, and the user has now asked for the upright posture. Returning to Brown's station brings back the seated reading, and every study since p84 confirms that.

**Captures** (`/dev/shm/p101/u5/`):
- Before: `377-before-tile.png` (plate, default, side, rotated) and `377-before-sides.png`.
- After:
  - `377-cmp-default.png`: plate, before, after, all in the default view;
  - `377-n-tile.png`;
  - `377-axstrip.png`: side, plank hidden, 8 phases over one gait cycle;
  - `377-final-tile.png`: 4 default phases, yaw/pitch ±40/±25, the arms close-up and the front;
  - `377-views.png`: back view like the plate, and the arms.
- 2-D study plot: `g/v35.png`.

**Checks.**
- `movement-377`: 10/10 pass. A new test asserts:
  - mean planted thigh < 50°;
  - hips within 0.06 of the leaving foot;
  - lift-off knee < 27°;
  - treads within 14° of level;
  - hands at shoulder height in front, elbows down.

  The plank/rail test now asserts the plank close in front of the standard, the rail ending within the drum's width, and no posts.
- `treadmill-gait-solids`: 4/4 pass, with minimum sole gap 0.0005 and 1458 planted checks.
- `treadwheel-working-solids`: 7/7 pass.
- `source-presentation`, `camera-catalog`, `opening-camera-motion` and `authored-loader` pass, and so does `tests/models.test.mjs` (163/163).
- Diagnostic over 1401 poses: no shoe-box/board penetration, and the largest hip–ankle distance is 1.4383 of 1.44.
- Screens:
  - body intersections: worst 0;
  - disconnected parts: 0 detached, 0 lips. The one sliver is the existing jacket/head joint, unchanged. The near-miss pairs go from 23 to 29: the 8 added are the rotor's end braces 0.09 from the moved end-ring lugs, both rigid on the rotor, and the head/rail pairs are gone;
  - coincident faces: 0;
  - loop seams: 0.
- Display profile 377 re-measured: bounds max (4.05, 3.36, 1.93), sustained visible 12.6 rad/s (hip pivot).
- Note: `src/data/display-profiles.json` already held another lane's uncommitted 236 change before I claimed it. Only the 377 entry is mine.

**Proposed ledger row (377):**
- **assessment:** minor. The posture flaw is gone, but the station now sits well above Brown's.
- **visibleFlaws:** "He climbs upright on the drum's upper quarter (hips 2.1 above the axle), where Brown's man stands with his feet near axle height and his cap level with the drum top."
- **limits:** append: "p101: upright stair climb. The 14 boards are turned 35° off radial so their treads are level at 35° above the axle, where the drum's face is a staircase. Mean planted thigh 46° from vertical (was 87°); hips 0.16 out from the mid-stance foot and over the leaving foot; knee about 25° at lift-off; treads within 13° of level. The rail is at shoulder height in front, trimmed to 0.3 past the far hand and carried by the plank alone, 0.25 in front of the standard. The sleeves are re-posed by a two-bone blend. The presentation camera is raised 15°. At Brown's axle-height station no board-clear gait keeps the hips within 0.7 of the feet (p84–p101 studies)."
