# Pass 86, lane 2: pawls and followers for 77, 79, 80, 85, 87, 100, 106 and 107

Reviewer: Claude Opus 5.5, lane p86-2 (85/87 and 100/106/107 done by forks of the lane). Date: 2026-09-27.

Captures are outside Git in `/dev/shm/p86/p86-2/`:
- `before/ID-tile.png`: the plate, four phases and a rotated view before the changes.
- `after/`, `f85/` and `f100/`: after the changes.

Screens and seams are in `/dev/shm/p86/p86-2/screen/`: `int-after.json`, `dis-after.json` and `seams.log`.

## 77: hooks made of true circular arcs

**Before.** Each hook head was a circle cut by a V-backed cavity whose mouth flared by smoothstep. The lower head's radius shrank from 0.09 to 0.075 over its bottom half. The heads were hooked but irregular (`before/77z-tile.png`).

**Change** (`alternating-peg-pawl.js`). Both heads are now one plain C of circular arcs:
- **Socket:** radius 0.058 (0.009 wider than the peg), offset toward the mouth. The seated peg keeps its centre and bears on the socket's back at -40°, where the probed pull direction lies (-30° upper, -55° lower).
- **Rim:** concentric with the socket, radius 0.09, so the wall is a constant 0.032 thick.
- **Lips:** round-ended. The upper lip hooks over the peg to 125°. The lower jaw stops at -55°.
  - The old lower lip, thinned to 0.075 radius so it could pass the next peg below, is gone.
  - The next peg passes 0.0017 clear.
  - Nothing is drawn under the peg, so the pawl hangs on it by gravity.
- **Rod:** the rod's round end lies inside the hook's back wall.

**How it was sized.** The shape was chosen with a swept probe (`w77/probe.mjs`: every peg in each pawl's frame, 4000 poses over startup and the steady cycle), which showed where pegs can pass (`w77/env.mjs`).

**After.** `after/77z-tile.png` (hooks through the cycle), `after/77-tile.png` (plate, default, rotated, rotated zoom).

**Tests.**
- All 7 existing tests pass, including driving contact at the seat and family clearance at 20 times.
- New: both heads are the same C, their outline vertices lie on the socket and rim circles, and the rim is at least 0.03 thick.
- Screens:
  - Intersections: worst 0.0000.
  - Disconnected parts: 0 detached. The only pawl near-misses are the pivot bore clearances and a moving peg cap.

**Residual.** The baked wheel and pawl motion comes from the earlier head geometry. The new head keeps the seated peg centre and the driving contact and clears every sampled pose. Its mass differs slightly from the one used in the recorded dynamics.

## 79: two identical, simple pawls; kinematic playback

**Before.** The two pawls were traced from the engraving: different lengths (0.287 vs 0.233), irregular outlines, and a y-stretch by the source tilt. Identical pawls cannot reproduce the recorded finite-contact dynamics, because the two tip positions relative to the teeth differed by a third of a pitch.

**Change**
- **Pawl** (`opposed-arm-geometry.js`). Both pawls are one blade on their drawn pivots (unchanged):
  - Outline: two circular arcs, sagitta 0.008, meeting at a point 0.22 from the hinge.
  - Width: springs from the journal's full width (0.058), overlapping it by 0.01.
  - Thickness: 0.022.
- **Playback.** The physics trajectory was replaced by a generated kinematic one: `scripts/generate-opposed-arm-kinematics.mjs` writes `src/data/opposed-arm-profile.js`.
  - The slider is prescribed.
  - Each pawl falls under gravity onto the crown teeth and rests at the deepest tilt that its rendered outline allows. The check includes outline edges that cross a face.
  - A pawl moving clockwise slides down the ramp into the root and pushes the vertical face, setting the wheel going at its arm's speed.
  - Between pushes the wheel coasts against friction of 0.035 rad/s².
  - The result: three teeth per cycle, standing still for 2% of it ("nearly continuous", as the caption says).
  - The cycle repeats by the second cycle (7e-11 rad). The table is compressed to 1e-6 rad.
- **Text** (`opposed-arm.js`). The qualification and constraints text now describe this.

**After.**
- `after/79-tile.png`: plate, four phases, rotated, and both pawls zoomed.
- `after/79t-tile.png` and `after/79r-tile.png`: side views of tip and teeth.
- The two pawls now read as identical leaf blades beside their pivot circles, as Brown draws them.

**Tests.**
- The startup, advance, seam, seeking and driving-contact tests are updated to the new trajectory: three teeth, standing under 3%, pushing at 4.3 s (upper) and 6.4 s (lower).
- New: the pawls have identical buffers, both flanks are circular arcs, and at 40 poses tipping either pawl 0.002 rad further drives it into the wheel (it rests on the teeth).
- Family clearance: 14 times.
- A 600-pose penetration sweep (both pawls against the wheel) is clean.

**Residuals**
- **Model.** The dynamics are now kinematic, with coasting and a constant fall rate, not the earlier integrated physics with torsional preload.
- **Tip contact.** The pawl is a flat blade tilted about 26°. Its extruded tip edge meets the vertical face at its upper corner, leaving a wedge about 0.01 deep at the root. It shows only in zoomed side views.

## 80: pawls brought back against the rack

**Before.** The two crossed pawls stood 0.10 and 0.26 in front of the rack (layers 0.16–0.21 and 0.32–0.37). Each hook toe needed a web block reaching back 0.19 or 0.35 to the teeth, which showed as chunky extensions in rotated views (`before/80-views.png`).

**Change** (`crossed-rack-geometry.js`). The layers are now 0.07–0.11 (left) and 0.12–0.16 (right), just clear of the rack's front face at 0.06 and of each other.
- The webs, pins and caps shorten with them.
- The in-plane geometry and the recorded motion are unchanged.
- The regenerated return table (`generate-crossed-rack-return.mjs`) is byte-identical.

**After.** `after/80-views.png` (default, ±60°, top and side, zooms).

**Tests.** All 8 pass. The layer test now also asserts the compact stack. Intersection screen: worst 0.0000.

**Residual.** The pawls cross, so they still need two layers, and each hook still steps back to the teeth through a short web.

## 85: rotationally symmetric rotor (fork)

**Change** (`wiper-stamp-geometry.js`, `wiper-stamp.js`). The two hand-traced wipers are replaced by one ideal swept blade repeated 180° apart:
- Centreline: a circular arc of radius 146 px.
- Width: tapers from a 28 px half-width at the root to a round tip of 8 px.

**Rebake.** New `scripts/bake-wiper-stamp-motion.mjs` rebakes `src/data/wiper-stamp-profile.js`: gravity, inelastic lift on B and an inelastic bed; `--check` detects a stale profile.
- Both lifts are now identical (52.7 px). The old lifts were about 66 and 50 px.
- The worst playback correction is 0.0003 px.
- At the plate pose the upper wiper lifts B at once. Previously B dropped to the bed first.

**After.** `f85/after-rotor.png`, `f85/85-tile.png`, `f85/85z-tile.png`.

**Tests.** 5 pass. The historical-candidate parity test is replaced by symmetry, correction and equal-lift tests.

## 87: constant, adequate rim on the slotted quadrant (fork, then widened)

**Change** (`weighted-clutch/distributed-geometry.js`). The quadrant is built from circular arcs:
- A rim band concentric with the unchanged slot, with ends rounded about the slot's end circles.
- Web flanks of radius 0.5, tangent to the boss and the rim ends.

The fork set the rim to 0.09. At that width the rim still read thin against the 0.24 slot, so the lane widened it to 0.14 (`QUADRANT_RIM`).

**After.** `after/87-tile.png` (plate crop, zooms at three phases, rotated, full views). Earlier fork captures are `f85/after87.png` and `f85/q87n.png`.

**Tests.** 6 pass, including the new rim test and native jaw clearance.

**Screens.** Intersections: worst 0.0000. Disconnected parts: the only quadrant near-misses are the unchanged bore clearances.

## 100: tail rod blends into the pivot hub (fork)

**Change** (`mujoco-quick-return/geometry.js`).
- **Cause.** The round tail rod (radius 0.185) was fatter than the lever plate and the thin boss, so it overhung where it met the pivot.
- **Fix.** The pivot boss is now a hub centred on the rod's axis, 0.02 proud of the rod on each side, with the pivot shaft lengthened to match. The rod's end sits inside the hub, clear of the bore.

**After.** `f100/a-ztile.png` (before: `f100/b-ztile.png`), `f100/a100-tile.png`.

**Tests.** All four quick-return tests pass, plus a new no-overhang test. The baked-loop tests pass: the compiled physics fingerprint is unchanged, so no rebake was needed.

## 106 and 107: solid follower stems (fork)

**Change** (`mujoco-barrel-cam/geometry.js`, reused by `mujoco-serpentine-cam/geometry.js`).
- **Collar.** The flat head plate that met the ball or pin only as a sliver is replaced by a rounded collar round the rod. It is symmetric about the pin's axis and the rod's mid-plane.
- **Stem.** A new round `stem` part runs through a concave fillet into the working part:
  - 106: into the ball's centre, radius 0.05.
  - 107: into the pin, radius 0.0375, Brown's drawn width.
- **Offset.** The collar and cross pin move over the pin: 4.4 px right of Brown's for 106, less for 107.

**After.** `f100/a106-ztile.png` and `f100/a107-ztile.png`. Before: `f100/b106-ztile.png` and `f100/b107-ztile.png`.

**Tests.** Four tests each pass. The part count is now 12, and a new stem, collar and symmetry test passes. The penetration audits flag only the pin against the groove walls. The baked-loop tests pass.

## Checks
- **Targeted tests:** `alternating-peg` (8), `opposed-arm` (8), `crossed-rack` (8), `wiper-stamp` (5), `weighted-clutch` (6), `mujoco-quick-return`, `mujoco-barrel-cam`, `mujoco-serpentine-cam` and `baked-motion`.
- **Camera fit:** a filtered copy of the catalog camera-fit test for all eight IDs (`camera-mine.test.mjs`).
- **Loader tests:** `authored-loader` and `source-presentation`.
- **Loop seams:** `check-loop-seams --ids=77,79,80,85,87`. MuJoCo IDs are covered by their baked-loop tests.
- **Legacy models not changed:** the `authored-cranks.js` and `authored-cams.js` models for 100, 106 and 107 feed only the synchronous `registry.js` offline models, not production. The intersection screen builds those, so it does not cover the production fixes for these three.
