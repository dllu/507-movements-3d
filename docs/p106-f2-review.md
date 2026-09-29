# Pass 106 fix lane f2 review

Reviewer: Claude Opus 5.5, lane p106-f2. Date: 2026-09-29. Working tree at `293be8d` plus this lane's edits; no git writes.
Findings: `docs/p106-audit-001-085.md`, `-086-170.md`, `-171-255.md`, `-256-340.md`, `-341-425.md`.
Captures: `/dev/shm/p106/f2/before/NNN/tile.png` and `/dev/shm/p106/f2/after/NNN/` (tiles show the plate, default view, phases 0.33 and 0.66, left, right, top, behind and below).

## File claims

The lead's file list was wrong for three IDs, because their production geometry is baked or built elsewhere:
- 143 is the baked keyed-worm bundle, loaded by `src/simulation/baked/sliding-worm.js`.
- 149 is the baked twin-cam bundle, loaded by `baked/twin-cam.js`.
- 154 is the baked bell-crank bundle, loaded by `baked/weighted-bell-crank.js`.
- 173's visible assembly is built in `mujoco-silk-tappet/assembly.js`.
- 246's arms are built in `pantograph-working-parts.js`.

I claimed all of those files as well. None of the new files is shared with any other movement. The recolours and presentation edits are applied at load, so no bake had to be regenerated.

## 078: right pawl seats and carries half a pitch (medium, fixed)

- **Plate check.** The finding is right. Before this pass, each steady cycle split as follows:
  - the rising stroke (right pawl) carried the wheel 4.63°, catching only at lever q = −0.17 rad;
  - the falling stroke (left pawl) carried it 9.22°;
  - the pitch is 13.85°.
- **Change.** `pull-pawl-geometry.js` has a new `rightExtension` option. It moves the right pawl's hook, and the concentric-eye tangents of its outline, along the pawl's own axis (pivot to hook). `src/data/pull-pawl-profile.js` now records `geometry: {rightExtension: -13}`, so the right pawl is 13 source px (0.034) shorter.
- **Scan.** 2 ms steps, 24 s runs, strokes given as rising/falling:
  - −6 px: 5.64°/8.21°
  - −8 px: 5.97°/7.87°
  - −10 px: 6.31°/7.53°
  - −11 px: 6.48°/7.36°
  - −12 px: 6.65°/7.20°
  - −13 px: 6.82°/7.03°
  - −14 px: 6.99°/6.86° (a different seat)
  - −20 px: solver iteration limit
- **Re-simulation.** Same finite-contact dynamics (`scripts/lib/pull-pawl-dynamics-study.mjs`) and physics as before: amplitude 0.38, 8 s period, Coulomb 6, same damping, θ0 −0.0175. Masses now come from the current production geometry, including the p98 concentric eyes that the old recording predated.
  - The run used dt 0.00025 for 16 s: 64,001 states, no solver failures, minimum gap −4.7e-16.
  - Compression and seam used the method of `build-pull-pawl-playback-study.mjs`. Builder: `/dev/shm/p106/f2/pp/build.mjs`; run: `pp/fine-13.json`. That gave 4,846 first-cycle and 5,209 steady knots, with seam corrections of at most 5.5e-8 and interpolation error at most 1e-7.
- **Result.**
  - Strokes are 6.82° and 7.03° (0.49 and 0.51 pitch).
  - The right pawl now takes up the wheel at q = −0.33, against a stroke start of −0.38. It was −0.17.
  - The first cycle advances 0.9939 tooth, and startup rollback is 7.1e-5 tooth.
  - The steady cycle is exactly one tooth, with no reverse motion. The wheel is stopped for 39.9% of the cycle (was 45.7%).
  - The zoom sequence `after/078/s.png` (frame and lever hidden) shows the toe dropped into the root ahead of a tooth's radial face at phases 0.83, 0.90, 0.10 and 0.30.
- **Tests.** `tests/pull-pawl.test.mjs`:
  - new first-cycle constant;
  - new assertion that each stroke carries 0.45–0.55 pitch;
  - stopped-fraction window moved to 0.37–0.43;
  - all 7 tests pass, including the hook-engagement and all-family clearance tests.
- **Not rerun.** The old heavy triangle-bound certification and energy/convergence studies (`scripts/check-pull-pawl-*`, artifacts not in Git) were not rerun. The playback is checked only by the sampled test clearance.
- **Motion bounds.** Reused. Sampling shows lever B's handle overruns `motionBounds.max.x` by 0.044. This was already true since p101's lever redraw and is not caused by this change.
- **Low, not fixed.** The pawls are still an in-front bar plus a hook web in the wheel plane. Putting the left pawl wholly in the wheel plane would cut through the teeth it passes over, so this needs a redesign, not a quick fix.

## 081: tooth count, start offset and mandrel (medium partly disputed; lows fixed)

- **Plate check (medium).** I disagree with "5 + 5".
  - Zooming the plate (`/dev/shm/p106/f2/p081b.png` and the lead's `r001/zD/p081crop.png`), I count 7 rack protrusions at about 50 px pitch in the crop, from the top step down to the last tooth below the wheel.
  - The adopted source measurement found the same: five clear strokes plus two partly occluded central ones.
  - On the segment, five gear tips are visible and a sixth is hidden in the mesh.
  - So the model's 7 rack teeth and 6 segment teeth stay.
  - The tooth form is also unchanged. The rack is a 10° flat-topped trapezoid and the segment is involute, conjugate with it (the user's "compatible racks, involute pinions" rule).
  - Residual: the gear tips are narrower than Brown's square teeth. Reshaping them needs a new finite-contact spring-rack study, which is out of this pass's budget.
- **Low 1 (first cycle), fixed.**
  - `spring-rack.js` now starts playback at the settled loop: a display offset of `loopStart × 4/2` = 4 s, so physical 2 s.
  - At t = 0 the gear is at Brown's angle and the rack is at 0.752, the periodic height.
  - The first lift reaches the full 2.12 (was 1.38).
  - New test: every cycle, including the first, matches later cycles to 1e-10.
- **Low 2 (visible mandrel), fixed.** Done in `spring-rack-geometry.js` and mirrored in `scripts/lib/spring-rack-candidate.mjs`, so the parity test holds.
  - The fixed grey mandrel and the rod's bore are gone. The blue rack-rod is one plain closed bar running up through collar B (now solid), spring C and the upper plate. The upper plate is bored like the lower guide.
  - At the lowest rest position the rod top stands px(10) proud of the upper plate. It rises about 3 through that plate over the stroke.
  - The camera envelope is extended to the rod's highest reach, to y 8.34.
- **Tests.** `tests/spring-rack.test.mjs` asserts:
  - the rod passes through the upper plate at rest;
  - there is no mandrel;
  - the loop start;
  - all 7 tests pass.
- **Residual.** At the default pose the rod stub stands about 1.6 above the upper plate, where Brown's stub is short. This is forced: Brown's pose is 0.83 above the rest stop, so a shorter rod would leave the upper guide at rest.

## 143: carriage steel grey (medium, fixed)

- **Change.** `baked/sliding-worm.js` gives the bored carriage and both worm bearings a cloned material in steel grey (#7e8584). The frame is darker (#59605f), and the wheel stays blue, so the wheel and its gold wrist pin read against the carriage (`after/143/tile.png`).
- **Reports.** The bake is unchanged.
  - `docs/validation/143-assembly.json` was regenerated with POSES=65 (65 poses, 34,962,162 checks, 0 failing).
  - `143-render-contact.json` was regenerated (65 poses, 0 intersections).
  - `143.provenance.json` validation hashes were updated.
  - `tests/sliding-worm-model.test.mjs` passes.

## 149: rollers steel (medium, fixed)

- **Change.** `baked/twin-cam.js` gives both rollers and their axle caps a cloned steel grey (#7e8584) material, so the contact no longer reads as one brass blob (`after/149/tile.png`).
- **Report.** `149-baked-assembly.json` regenerated: 61 poses, 0 failing pairs.

## 154: cord through the lever's own eye (medium, fixed)

- **Change.** Presentation only, in `baked/weighted-bell-crank.js`; the MuJoCo bake is unchanged.
  - The lever is re-cut as one plate: both arms, plus a round eye (r 0.13, bore 0.055) at the output arm's tip, concentric with the old pin.
  - The bare stub pin's triangles are removed.
  - The pulley and weight bodies' meshes move back 0.26 into the lever's plane (z 0.46), and the pulley's fixed stub is shortened by the same amount.
  - The cord is drawn in z 0.46, from the eye centre over the pulley to the weight.
- **Captures.** `after/154/m.png`: default view, eye zoom, oblique, top, right and side views.
- **Tests.** `weighted-bell-crank-baked` and `sliver-joints-p86-7` pass.
- **Residual.** The laid rope ends inside the eye's bore rather than tying a visible loop.

## 173: yoke, rod, bearing and bracket lowered (medium, fixed) and star close to the frame (low, fixed)

- **Change.** In `mujoco-silk-tappet/assembly.js`:
  - The yoke is at z 0.955–1.135 and the rod axis at 1.045 (was 1.6).
  - The wrist ends 0.02 past the yoke.
  - The guide bearing is Brown's upright block (y ±0.58, as drawn) but only 0.30 deep (z 0.87–1.17), so it clears the star's orbit (teeth ≤ 0.853).
  - The curved bracket and neck lie at z 0.87–0.95, behind the rod as Brown draws, and the foot at 0.87–1.14.
  - The upper bearing block now runs out to 0.02 short of the star hub, so there is no bare shaft.
- **Captures.** `after/173/tile.png`.
- **Reports and tests.**
  - `173-assembly-clearance.json` regenerated: 129 poses, 0 intersections. A first attempt that put the bracket in the rod's plane intersected the rod, and was rejected.
  - `173-source-fit.json` regenerated.
  - `movement-173-assembly` and `-contact` pass.
- **Stale report.** `173-browser.json` is a manual e2e record whose hashes have been stale since before this pass; it was not regenerated.
- **Residual.** The striker box stays a separate fixed block, as Brown draws it. The screen still reports it "floating", as it did before this pass.

## 203: shafts and slot pin trimmed (medium, fixed)

- **Change.** In `authored-linkages.js`:
  - The input shaft runs from −0.17 to 0.293, 0.03 past the curved arm's back face and its boss.
  - The output shaft runs from −0.52 to −0.26.
  - The slot pin runs from −0.52 to 0.17 (was −0.70 to 0.24).
- **Captures.** `after/203/tile.png`.
- **Tests and reports.**
  - `tests/movement-203.test.mjs` now asserts the trims.
  - The z envelope is 0.9–1.2, where the old test required more than 1.2.
  - `144-assembly.json` and `145-assembly.json` were regenerated (hash only; 65 poses each, 0 failing). The script writes to /dev/shm unless REPORT is set.

## 246: round eyes at the right corner (medium, fixed)

- **Change.** In `pantograph-working-parts.js`, each long arm's bar ends at its last station, so the right corner is the arm's own r 0.15 eye (the washer radius, concentric with the pin). There is no square bar end. The parallel bars are unchanged.
- **Captures.** `after/246/m.png`.
- **Tests.** New test in `movement-246.test.mjs`.

## 262/263: standard E with a round boss head (medium, fixed)

- **Change.** In `authored-eccentric-cone-drives.js`:
  - The across-axis web of the one shared standard ends in a round boss (r 0.42, 0.24 thick) concentric with screw D, with a 0.306 bore.
  - The straight neck runs into the boss through r 0.1 circular fillets.
  - Brass nut E (r 0.31, 0.28 long) is seated in the bore and stands 0.02 proud of each face.
  - The along-axis web rises into the boss's underside.
- **Captures.** `after/263/m.png`, 262 and 263 views.
- **Tests.** New test in `movement-263.test.mjs`. `cone-friction-solids` passes.

## 299: framing, floor, staff (medium, fixed)

- **Change.**
  - The fit box is enlarged ×2 about its centre, so the whole band is framed at about 0.55 of the old zoom (`/dev/shm/p106/f2/cmp299.png`).
  - The cup's floor disc is removed.
  - The crown is carried by its rim and two crossed slim bars. The old four "spokes" were two duplicated pairs, i.e. coincident geometry.
  - The staff now ends just past the far pallet (local 2.32). It ran on 1.5 past the far rim to the undisplayed foliot.
- **Captures.** `after/299/tile.png`.
- **Tests.** `tests/movement-299.test.mjs` now expects 2 spokes.
- **Coincident faces.** The screen's 13 flags (tooth/band) predate this pass (r256 baseline 13).

## 346: rear rod and crank kept (disputed)

- The caption requires them: "connected by two side connecting-rods with two parallel cranks on shaft under the table".
- Brown's side view hides the second pair behind the first.
- No change.

## 352: handspike brass and inboard (medium, fixed)

- **Change.** In `authored-redirected-windlasses.js`, the handspike is brass and 0.1 further inboard (still 0.08 clear of the rope-pack flange).
- **Captures.** `after/352/tile.png`.

## 401: one pin in a round eye (medium, fixed)

- **Change.** In `authored-dead-center-cranks.js`:
  - The treadle is one plate with a round eye (r 0.18, bore 0.094) at the fulcrum.
  - The black boss (0.38 deep) and fixed bearing (0.52 deep) are gone.
  - The fulcrum is one short steel pin, 0.21 long and 0.03 proud of each face.
- **Captures.** `after/401/m.png`.
- **Tests.** `dead-socket-cradle-solids.test.mjs` asserts the pin and the removed parts.

## 413: stout turned handle on a boss (medium, fixed)

- **Plate check.** The grip was already at 0.80 R (1.04 of 1.29). It read as "at the rim" because the default view sees the face edge-on. The complaint that it was a small knob on a thin stalk is right.
- **Change.** In `authored-adjustable-friction-gears.js`:
  - The grip uses the shared `turnedHandleGeometry` with a stout profile: neck 0.12 across, bulb 0.19, standing 0.46 proud.
  - It rises from a new round face boss (r 0.15, 0.05), concentric with the handle.
  - The through-shank is still flush with the flank's back face.
- **Captures.** `after/413/m.png`.
- **Tests.** `p98-handle-seating` and `movement-413` pass.

## 238: boss tint (low, fixed)

- **Change.** Star D's boss and anchor A's boss take the part colour ×0.68, as on 212/235/239/241.
- **Coincident faces.** The first attempt made the bosses' bores coincide with the plates' bores in a different colour (2 new coincident-face flags). The boss bores are now 0.004 wider, and the screen reports 0.
- **Captures.** `after/238/m.png`.

## Screens

- **Disconnected parts** (`/dev/shm/p106/f2/disc.json`). No new detachments. The flags below all match the audit baselines:
  - 081: axle/flange near-miss;
  - 173: striker box;
  - 238: arbor near-miss.
- **Coincident faces** (`coin.json`, `coin238.json`). All flags are pre-existing:
  - 238: 0;
  - 299: 13;
  - 346: 2;
  - 401: 1 (spring/faceplate sliver);
  - all others: 0.
- **Loop seams.** Clean for all IDs.
- **Body intersections** (`/dev/shm/p106/f2/body.json`).
  - 0 for 78, 81, 154, 203, 246, 262, 263, 299 and 401; 238 is 0.0002 (tooth contact).
  - The screen builds 143, 149 and 173 from their legacy synchronous factories, not the baked production models, so its readings there are not about this pass's geometry.
  - 413 shows 0.1295 (upper shaft x rubber flank), which is not a part this pass touched.
  - 352 ran out of heap in the screen at 4 GB, a tooling limit; its change is only a colour and a 0.1 shift.
- **Tests.** `tests/models.test.mjs` passes (163 tests), as do 37 targeted suites (218 tests).

## Not fixed (lows in owned files, not quick)

- 102/103/104/111 threads (shared thread generator, nut mating).
- 302 pinion proportions.
- 078 L-bracket pawls (see above).
