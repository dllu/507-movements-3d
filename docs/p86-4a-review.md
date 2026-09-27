# Pass 86, lane 4a: pawl sweep (2, 244, 49, 65, 68, 69, 70, 75, 76, 86, 88, 162, 186)

Reviewer: Claude Opus 5.5, lane p86-4a (75, 76 and 86 in sub-lanes, integrated here). Date: 2026-09-27.

Brief: `/dev/shm/p86/brief.md`. Captures are outside Git in `/dev/shm/p86/p86-4a/`:
- `plates.png`: all thirteen plates.
- `before/tile-ID.png`: the plate beside the default view at four phases, +60° and top.
- `after/tile-ID.png`: the same for changed IDs, plus −60° and back.
- `zID/`, `aID/`, `ID/`: zooms on each pawl, click, stop or catch contact at several phases, including the hold, and rotated views.

Captures were made with `zoom.mjs` (dev server, per-shot camera). Its first version set the camera near plane to 0.001. That caused depth-fighting stair-steps and stripes where surfaces are close: the 162 sleeve, the 65 hub and a first 88 capture. Those captures were remade after the fix. None of those artifacts is in the model.

## Passed without change (8)

| ID | Pawl-like part | Evidence |
|---|---|---|
| 2 | None: crossed belt and pulleys only. | `before/tile-2.png` |
| 244 | None working. The lever stops C and C′ are plain blocks the lever rests between. | `before/tile-244.png` |
| 68 | B's plain circumference locks C's concave hollows. | `zidx/68-*.png`: B's rim fills each hollow at the hold, with no gap and no tip-to-tip contact. |
| 69 | B's circumference locks A's teeth. | `zidx/69-*.png`: seated in the hollow at the hold; the single tooth drives cleanly. |
| 70 | C's rim exterior locks A's studs. | Two studs bear on the rim at the hold (gaps 0.0000 and 0.0003, measured at phase 0.5); the third stud sits inside the rim. Pictures: `zidx/70-*.png`. |
| 162 | The selector pin catches studs on the loose bevels. | The studs are plain blocks and the pin a plain bar, as Brown draws (`z162/tile.png`, remade with the fixed near plane). |
| 186 | The spring handle's tongue latches in notch a. | The tongue end sits under the notch's flat, with the design 0.002 gap, from t 9.9 to 12.5 s (`z186/tile.png`, `z186/tilew.png`). It is a flexed strap end in Brown's notch, not a pinned pawl. Small shading creases where the strap bends are the deformable strap mesh. |

## Changed

### 49 ratchet bevels: a solid gravity pawl whose wedge fills the root
**Before** (`z49/tile.png`):
- **Pawl:** a thin stick 0.06–0.03 wide with a round nose (r 0.024).
- **Engagement:** only 0.015 below the tooth tip, nearly tip-to-tip. It never reached the root.
- **Extra parts:** a brass stop pin under the heel, and a torsion coil in the gap behind the pawl, sprung onto a heel knob above the boss.

**Change** (`ratchet-bevel-motion.js`, `ratchet-bevel.js`):
- **Pawl shape:** one flat plate (0.09 deep) in the ratchet's plane:
  - a round boss (r 0.05) bored for the pin;
  - two smooth cubic sides, about 0.08 wide along its length;
  - a wedge tip. Its working flank runs along the radial tooth face, past the crest. Its underside runs along the preceding tooth's back, so the tip angle is the valley angle (75.2°). At the seat the tip sits in the root corner, 5e-6 clear.
- **Pivot:** the pin is moved behind the tip, with the pawl leaning 30° off the tangent (the arm now runs to r 0.544 at −12.5°). Pushing pulls the tip in. Lifting swings it mostly outward, so it can climb the backs. The old near-radial pawl could not lift without striking the face, which is why its nose had been kept at the tips.
- **Bias:** the pawl's weight turns the tip inward at every carrier angle of the ±41.5° stroke. The stop pin, the coil and the heel knob are removed.
- **Lift:** the pawl rests on the real teeth at the least lift that clears them. This is solved for the whole pawl outline against the four nearest teeth, with Lipschitz-safe stepping and bisection (about 3 ms per frame).
- **Backlash:** the default stroke overtravels 0.15 pitch. Each idle pawl drops fully into a root before the reversal. It then slides back to its seat in the lost motion (output dwells) before it drives. Previously the drop coincided with the reversal.

**After:** `z49a/tile.png` (pawl through a cycle), `z49a/tile2.png` (tip seated at 0.2–0.27, riding the back at 0.3–0.32), `z49a/tile3.png` (rotated: arm, pin and flat pawl) and `after/tile-49.png`.

**Checks:**
- `ratchet-bevel.test.mjs`: 7/7. The new test covers:
  - one plate with no stop or spring;
  - flanks along the face and back, tip in the root;
  - width at least 0.075 along the pawl;
  - the weight seating it at both stroke ends and mid-stroke.

  The skin test is kept: 219,858 pawl-surface checks, minimum −1.6e-8, float rounding within 1e-7. Driving-face rays show at most 6.3e-6.
- `models.test` (movement 49): passes.
- **Intersection screen:** worst solid 0.0000 (the seated contact).
- **Disconnected screen:** 0 detached.
- **Loop seams:** score 3.55, down from 3.99 before the change. The loop-point kink matches the pawl drops within the cycle. The period mismatch of 0.365 was there before.

### 65 tappet stud stop: the toe is the stop's own corner
**Before** (`z65/tile.png`, `Lbelow.png`): the stop was a plate at z 0.145–0.265, in front of C. It reached C's notch only through a triangular toe block extruded back to z −0.07, which showed as a block behind the stop in rotated and underside views.

**Change** (`tappet-stud-stop.js`; new `scripts/generate-tappet-stud-stop-outline.mjs` and `src/data/tappet-stud-stop-outline.js`):
- **C:** C's plain disk is deepened forward to z 0.31, so it meets the stop in the stop's plane.
- **Stop:** Brown's stop outline and the toe are one flat plate, and its corner is the toe point that rides the rim and drops into the notch.
- **Trim:** where C sweeps through the plate during the index, the plate is trimmed with 0.006 running clearance. Only near the toe point is it trimmed exactly, where C's notch is the toe point's own locus. The trim is 0.03 deep, a shallow concave scoop right of the toe.
- **Baked outline:** the swept clip is slow, so the outline is generated offline, and the 065 test recomputes it and compares.
- **Tappet A:** moved onto C's new front face (z 0.31–0.42), so it no longer floats 0.045 off it. It stays clear of the end of the stop's fixed pin, which a first try at z 0.28 swept by 0.02.
- **Script:** `scripts/probe-tappet-stop-forces.mjs` now names `stopBody` for the cam contact.

**After:** `a65/tileL.png` and `a65/tile.png`.

**Checks:**
- `tappet-stud-stop.test.mjs`: 7/7. The new test covers:
  - baked outline equals recomputed;
  - no toe block;
  - the stop is exactly one plate;
  - C reaches the stop's plane;
  - the toe point is a vertex;
  - the trimmed edge clears C by more than 0.001 at 97 index poses.

  The contact-normal, lock and layer tests now use `stopBody`.
- `models.test` (movement 65): passes.
- **Intersection screen:** worst solid 0.0000.
- **Disconnected screen:** 0 detached.
- **Loop seams:** 0.
- **Force probe:** minimum cam moment 0.563; maximum lock gap 4.9e-7.

### 88 eccentric two stops: plain square blocks
**Before** (`z88/tile.png`, rot views): each stop was a square cap overhanging the cam plane (z 0.21–0.34), carried on a narrower foot that reached down to B's face. The result was an L-shaped stepped stud.

**Change** (`eccentric-two-stop.js`, production only; the research candidate and the baked playback are unchanged):
- **Stops:** each stop is one plain block the size of Brown's square (0.33 × 0.30), standing from B's face (z −0.015) through the cam's plane to z 0.25.
- **Working face:** it keeps the studied foot's inner face, so the square sits 0.155 outboard of Brown's.
- **Motion:** contact is unchanged, because the foot face is the only working face.
- **Inertia:** the wheel's inertia changes by about +0.4% against the integrated playback. This is recorded in `u.stopBlocks.qualification`.

**After:** `a88/tile.png` (default phases, rotated views and a stop close-up).

**Checks:**
- `eccentric-two-stop.test.mjs`: 5/5. Candidate parity is kept except for the stops. New asserts: no caps; Brown's square size; the block spans the cam plane; the working face equals the studied foot face.
- **Intersection screen:** worst solid 0.0000 (stop against cam).
- **Disconnected screen:** 1 intermittent near-miss (the cam group through the stop, 2 of 6 phases). It was triaged in p79 as "stop/cam contact intermittent".
- **Loop seams:** 0.

### 75 reciprocating pawl: smooth wedge-tipped pawl and click (sub-lane)
**Before** (`z75/tileB.png`, `z75/tileH.png`):
- **Pawl B:** a crescent tapering to a needle-thin sliver, ending in a tiny round nose disk.
- **Click:** hand-drawn wobble (a bump midway), with the same dot nose.

**Change:**
- **Outlines:** `scripts/lib/reciprocating-pawl-candidate.mjs` has a new `smoothPawlOutline` and `seatWallNormals`, behind the `smoothPawls` option, which the exporter now passes. Each pawl is one plate: a bored boss, two cubic edges leaving it tangentially, straight flanks, and a wedge tip rounded by the contact nose. The dot nose disk is gone.
- **Widths and flank angles:**
  - B is 0.1 wide, with flanks 4° inside the valley walls.
  - The click is 0.1 wide. Its back flank is 8° clear of the convex tooth back, which it needs to ratchet.
- **Motion:** the geometry, masses and integrated contact trajectory in `src/data/reciprocating-pawl-profile.js` were regenerated to a fixed point: dt 0.0005, 24001 rows, 8001-pose tables, no failures.

**Backlash (not reduced):**
- **Overtravel:** now 0.096. With the new masses, 0.090 loses the count and 0.093 is the least that holds, so 0.096 was taken for margin.
- **Slip-back:** the wheel slips back about half a pitch, 0.096 rad, after each drive (0.090 before).
- **Cause:** Brown's click pivot makes its nose swing nearly tangent to the rim, so the crest must pass about 0.09 rad beyond the seat before the click can drop.
- **Ruled out:** a radial face still fails at 0.06 overtravel, and a 4× slower run fails too, so the limit is geometric.

**After:** `75/after/tile-def.png`, `tileB.png`, `tileH.png`, and `75/pv.png` and `pvz.png` (outline against Brown).

**Checks:**
- `reciprocating-pawl.test.mjs`: 8/8. The new smooth/thick/seated test fails on the old geometry. The overtravel bound is tightened from < 0.16 to < 0.11.
- **Loop seams:** 0.
- **Camera tests:** 2/2.
- **Intersection screen:** worst solid 0.
- **Disconnected screen:** 0 detached.

### 86 pump catch: slab and heel lug removed from display (sub-lane)
**Before** (`z86/tile.png`, `86/before-tile.png`): catch B carried a hidden slab behind its head (`catchHeadBack`, z −0.1..0) and a `catchHeelLug` bearing on a `wheelHeelStop` sector behind the catch.

**Change** (`pump-catch.js`):
- **Display:** the three parts are pruned in production, so the catch is one plain extrusion (z 0–0.13) of Brown's outline. The omitted details are recorded in `u.displayOmitsIntegratedCatchDetails`.
- **Pipeline:** the qualified research pipeline and `pump-catch-profile.js` are unchanged.
- **Hook:** C's point sits in the hook's throat from 0.05 to 1.25 s, trips at the stop and re-seats at about 3.5 s. There is no tip-to-tip contact.

**Captures:** `86/after-tile.png`.

**Checks:**
- `pump-catch.test.mjs`: 6/6. The part count drops from 28 to 25. New asserts: a single-plate catch and no head or heel parts.
- **Loop seams:** 0.
- **Camera tests:** 2/2.
- **Intersection screen:** at 33 samples, worst solid 2.4e-7, at the trip-stop working contact.
- **Disconnected screen:** 0 detached.

**Remaining:** the playback was integrated with the heavier head and the heel stop. The return-phase hold of −0.12 rad is therefore supplied by the baked trajectory with no visible contact. A new contact study is needed. No drawn in-plane part can serve as the stop, because the cam's hub and crescent occupy the catch plane.

## Also changed: 12 eye bolt (coordinator request, from the p86-5 sliver screen)
**Before:** the eye ring touched the beam's underside only along a tangent. The p86-5 screen flagged it as sliver row 7, "real".

**Change** (`authored-belts.js`):
- `addHookStaple` takes a new `eyeBolt` option. When it is set, a shank (r 0.024) rises from inside the ring's crown, a full wire radius below its top, and runs 0.08 up into the 0.12-thick beam.
- Only 12 passes the option. The ring, the hook, the hauling hand and 13's staple are unchanged. The shank is exposed as `blocks.eyeBoltShank`.

**After:** `a12/tile.png` (plate, default view, front, rotated and side zooms).

**Checks:**
- `belts-1-23-clearance.test.mjs`: 9/9. The 012/013 test now also requires the shank to be buried in both the ring and the beam, on the ring's axis.
- **Loop seams:** 0.
- **Intersection screen:** worst solid 0.
- **Disconnected screen:** 0 detached. The ring/beam pair is now `embedded`, not flagged. The one remaining flagged sliver is the hook in the eye (intended, row 21), and the one open end is the hook tip; both were there before.

### 76 jointed tappet: click and dog B moved into the wheel's plane (sub-lane)
**Before** (`z76/tileB.png`, `tileH.png`, `Brot.png`, `Hrot.png`):
- **Pins:** both the click and dog B sat in front of the wheel (z 0.19–0.25) and reached the teeth only through thin nose pins extruded back to the wheel plane.
- **Extras:** rest and stop pins and sectors.

**Change:**
- **Click** (`jointed-tappet.js`): one plate at z ±0.05. It is a smooth hook from a round boss to a wedge tip about 70° wide, with one flank along the tooth face and the other 4° off the back. The wheel overruns to about 1.14 teeth and slips back until the click seats on both walls of the root.
- **Dog B:** one plate at z ±0.04, Brown's lobe with his corner cut to a wedge. The lower-left lobe is trimmed clear of the passing tooth tips.
- **B's stop:** a heel sector hidden between the bar's cheeks bears flush on the end of a slot in the three-layer tappet bar (front cheek, rear cheek, web).
- **Removed** (the part count goes from 29 to 24):
  - both nose pins;
  - the dog stop sector and pin;
  - the tappet rest sector and mount;
  - C's shank.
- **Tappet rest:** it rests on one plain pin on the existing fixed bracket, with the bar's lower edge on it. Brown draws no stop, and the text says the tappet returns by its own weight.
- **Physics:** new `scripts/lib/jointed-tappet-076-dynamics.mjs` (B's one-sided heel stop and the bar's outline on the rest pin). `bake-jointed-tappet-motion.mjs` imports it.
- **Rebake:** `src/data/jointed-tappet-profile.js` has 9795/8902 knots (was 9466/8470). The largest interpolated penetration is 5e-8, and the endpoints are exact.

**After:** `76/after/tile-76.png`, `tileB.png` and `tileH.png`.

**Checks:**
- `jointed-tappet.test.mjs`: 12/12. New tests:
  - each pawl is a single plate within the wheel thickness, with no nose, stop or rest pieces;
  - the click overruns and seats on both root walls at each hold;
  - B stays on the tooth face during the lift;
  - a 2D pawl-against-ratchet check at 620 poses finds 0 overlap.
- **Loop seams:** 0.
- **Camera fit:** passes.
- **Intersection screen:** worst 0 (B touching the wheel).
- **Disconnected screen:** 0 detached.

**Remaining:**
- B's point works on the lower middle of the tooth face and cannot reach the root. B's arc about C turns the tooth face about 33° relative to B during the lift, so no flank can lie along the face for the whole stroke. The point stays about 0.035 above the root.
- B's hidden heel shows briefly below the bar while B folds on the return.
- The undrawn fixed bracket now also carries the rest pin.

## Not fixed
- **75:** half-pitch slip-back, forced by Brown's click pivot.
- **76:** B cannot seat in the root, and its heel shows briefly.
- **86:** motion not re-integrated for the plain catch; the return hold has no visible contact.
- **Other lanes' test failures** seen while running `loop-seams.test.mjs` and `source-presentation.test.mjs`: 390 and 238, which are not this lane's files.
