# Pass 99 lane a: 027, 037, 046, 116, 191, 194, 195, 198, 208

Scope: the remaining 'minor' ledger rows routed through `src/simulation/authored-gears-core.js` (claimed by p99-a), plus the user's 027 item (rollers mounted on eyes, chamfer shading, outer wheel appearance). Work was split across sub-agents by movement. Each edited only its own factory functions, using atomic string replacement.

Claimed helpers:
- `conical-stud-geometry.js`, `conical-stud-profile.js`
- `fusee-geometry.js`, `fusee-motion.js`, `fusee-chain.js`
- `radial-pin-mangle-contact.js`, `reversing-mangle-guides.js`, `radial-pin-mangle-pinion.js`, `mangle-universal-drive.js` (claimed but unchanged)
- `mujoco-rack-rectifier/*`, `mujoco-116.json.gz`
- `mangle-rack-working-parts.js`, `mangle-rack-working-profiles.js`
- `feed-worm-assembly-parts.js`, `face-worm-195*.js`, `worm-crest-195.js`, `face-slot-worm-195.js`

Captures are in `/dev/shm/p99/a/<id>/` (outside Git).

**Other movements are unchanged.** Geometry and world-matrix hashes were taken at t = 0, 0.37 and 1.9 (`/dev/shm/p99/a/hash.mjs`) over every movement authored-gears-core routes. Before/after (final run), only 27, 37, 46, 194, 195 and 198 differ. 116's production visual lives in `mujoco-rack-rectifier/`.

**Validation reports regenerated.** Pose counts are kept, and only source hashes changed unless noted:
- `191-196-201-contact.json`: 513 poses; results identical.
- `200-226-bevel-solids.json`: 33 poses.
- `202-264-worm-solids.json`: `POSES=33`.
- `feed-worm-195-solids.json` and `feed-worm-195-working-faces.json`: 17 poses, new geometry.
- `feed-worm-207-working-faces.json`: source list only.

`205-208-209-contact.json` fingerprints only the unchanged 205/208/209 functions, so it is still current. The 116 bake was redone with `bake-mujoco-movement.mjs 116`.

## 027 multiple gearing: roller eyes, smooth chamfers, Brown's sector frames

User findings (binding): the rollers were disconnected from the triangle (109.png); the chamfers shaded bumpy (110.png, 111.png); the outer wheel differed slightly from the engraving.

Production route: `authored-gears-core.js` `multipleGearing()` only (no baked or MuJoCo module; `makeRadialSlotWheel` and `makeTriangularRollerCarrier` have no other callers).

- **Roller eyes.** The carrier plate is now one outline: three eyes, true circles of radius 0.15 (= roller radius) concentric with the roller pins at orbit radius 0.78, joined by concave flank arcs (radius 0.92) tangent to both eyes, centred on the valley bisectors, with the valley at radius 0.30 clear of the 0.19 boss. Before, the Catmull-Rom arm tips stopped at 0.69, short of the pins at 0.78, so each pin stood in free space between the plate and its roller.
  - Each pin now runs from 0.01 behind its roller's back, through the roller and the eye, to a hex nut on the eye's front face (seated 0.002 into it, so no shared face). Brown draws a nut at each roller.
  - The roller's hub face stands 0.004 behind the eye's back face (running clearance). The driver moved from z 0.47 to 0.44 so the rollers keep their old depth in the grooves (drum 0.066–0.346 in the wheel frame; before 0.06–0.34). The plate still clears the frame tops by 0.11.
- **Chamfer shading.** The old plate was a 150-point Catmull-Rom `ExtrudeGeometry` with a 2-segment bevel. The load-time facet smoother joined some bevel rows and not others along the unevenly spaced spline, which gave the streaks. The new `chamferedOutlinePlateGeometry` builds an indexed plate with five bands (back cap, back 45° chamfer, wall, front chamfer, front cap). Each band has its own vertex rings with exact analytic outline normals, so creases stay sharp and the arcs shade smoothly. Because the plate is indexed with authored normals, the load-time smoother leaves it alone. 2876 faces, 0 misoriented. The boss went from 28 to 64 sides.
- **Wheel.** On the plate, the wheel face carries six raised sector frames. The radial grooves between the frames run out through the circumference, and each frame holds a sector pocket with straight sides parallel to the grooves and an outer arc. Changes to match:
  - Pockets are sectors: straight sides parallel to the neighbouring grooves (constant web 0.14), an outer arc at radius 1.71 concentric with the rim (band 0.13), and 0.03 tangent fillets. The old pockets were straight-edged triangles.
  - Grooves run straight out through the rim, as drawn. Rollers reach 1.71 at most, so nothing changes functionally.
  - The black ink floor planes are gone. The pocket and groove floors are now the disc face itself, in a darker tone of the wheel blue, so the frames read raised as on the plate.
  - Not adopted: Brown's small central knob. The rollers pass through the wheel centre (shaft offset = orbit radius), so a front stub would be struck.
- **Captures** (`/dev/shm/p99/a/27/`):
  - `cmp1.png`: plate, HEAD, after.
  - `before-grid.png` / `after-grid.png`: default, yaw ±40, pitch ±25, side, two close-ups.
  - `after-close.png`: views approximating 109–111, the back, and phases 0.5 and 0.75.
  - `edge.png`: eye edge-on, with the roller seated behind the eye and the nut in front.
  - `phases.png`: phases 0, 0.25, 0.5 and 0.75.
- **Screens.**
  - Body intersections: worst 5e-9 (roller tangent to its groove wall, the intended rolling contact).
  - Disconnected parts: 0 detached. 7 near-misses, all bore/running clearances: pin in roller bore 0.032, eye to drum face 0.014, driver boss to frame tops 0.055.
  - Coincident faces: 0 flagged.
  - Loop seams: 0.
- **Tests.**
  - `tests/gears-24-46-source-match.test.mjs`: 8/8. New 027 test: eye vertices lie on a 0.15 circle about each pin; roller hub seated within 0.006 behind the eye; pins pass through eye and roller; the chamfer normals are exactly 45°; no groove or floor meshes.
  - `tests/opening-gear-contact.test.mjs`: 3/3. The plate lookup now uses its role. Rollers still touch the actual groove walls at every engaged sample and clear the frame tops.
  - `tests/models.test.mjs` movement 27 block passes.
- **Residuals.** None visible. The rollers remain plain (Brown's are knurled) and carry the shared quadrant cue.

## 037 conical stud gear: Brown's 28 flutes and cone proportions; studs 0.024 proud

- **Plate re-measured** (`public/engravings/mm_037.png`, C = 187 px between the shafts). The toothed cone tapers strongly: about 1.55 at the top and 0.45 at the foot on a 1.8 centre distance, 2.07 tall. The stud cone is a frustum about 0.23 across the top. Brown draws about 28 flutes and seven studs. Along the cone face the studs sit a constant ~36 px apart, and the output angle between them grows from 16° to 21° going up the spiral. That is the constant-pitch law the model uses.
- **Why 17 flutes was chosen before.** Studs must sit one tooth pitch apart along the spiral, so the tooth count is N = Σ R_t/R_s over the studs. At Brown's stud heights (lower half, R_t/R_s ≈ 0.37–1.1), his seven-studs-per-130° spacing gives N ≈ 12. Brown's 28 flutes would need about 45 studs. The plate is not self-consistent, and pass 90 compromised at N = 17.
- **Change** (`conical-stud-geometry.js`, used only by 37; data bake `src/data/conical-stud-profile.js`; `conicalStudGear()` in `authored-gears-core.js`):
  - The cones take Brown's proportions: slope 0.53, half-height 1.035.
  - The spiral gets a new `axialCenter` parameter. With 28 teeth and 17 studs, the spiral sits at h = 0.15 ± 0.40, just above mid-height, where the toothed cone is the larger. The solved mean toothed radius is 1.022 (Brown's is 1.02). The output spacing grows from 13° to 34° up the spiral (Brown's grows 16°→21°), and about 8 heads show on the front face.
  - The flutes are grooves cut into the pitch cone (addendum factor 0, was 0.15). The stud body therefore sits only 0.004 inside its pitch cone (the relief was 0.012 outside the stub tips).
  - The heads are r 0.05 (was 0.07; the tooth space limits them, and r 0.06 got lumpy working-cut rims). They stand 0.02 beyond the pitch cone, with crown sag 0.012.
  - Stud cut rebaked with `node scripts/bake-conical-stud-profile.mjs`.
- **Silhouette.** A head now stands at most 0.024 proud of the body (was ~0.053), about 3 px in the default view (was ~6 px), and its crowned rim only 0.012. A small bump when a head crosses the limb is forced: the full-face flute lands pass the stud body at every height and every angle, so the body must lie inside R_s − addendum − clearance, and a driving stud must reach into the flute past R_s. Any proud stud on a surface of revolution crosses the limb once per turn. The addendum is now zero, so the proud height is only engagement plus running relief.
- **Numbers** (512-pose dense sweep): stud/tooth clearance ≥ 0.00044 and tooth/body clearance ≥ 0.0040, with no overlap. The maximum nearest-stud working gap is 0.087 (was 0.163). `probe-conical-stud-contact.mjs` gives a Euclidean stud-to-flank gap of 0.00017–0.022 across its sampled phases.
- **Captures** (`/dev/shm/p99/a/37/`):
  - `before-sheet.png` / `after-sheet.png`: plate, default, phases 0.25/0.5, yaw ±40, pitch ±25;
  - `cmp37.png`: plate, before, after;
  - `zsheet.png`: stud close-ups at phases 0–0.3, the limb at phase 0.1, and the top view.
- **Tests.**
  - `tests/conical-stud-clearance.test.mjs` passes 2/2. The body-clearance bound is now 0.003, for the zero-addendum flutes.
  - models "movement 37" passes. It now asserts `axialCenter`, 28 teeth, Brown's toothed-cone radii, a speed ratio above 2.5 (was 6.5, for the old full-height spiral) and a stud top above 0.2.
- **Screens.** Body intersections 0; disconnected parts 0 (no near-miss; HEAD had one); coincident faces 0 flagged; seams 0.
- **Residuals.** The stud row sits about 0.35 of the cone height higher than Brown's (the price of 28 flutes at one stud per pitch). The spiral-end hand-off and the motion stay prescribed.

## 046 fusee: one helical ledge on a cone (user redesign)

User direction (p99, binding): the stepped tiers are wrong (112.png, 113.png). There must be steps in the radial direction but none round the circumference. From above the ledge is an Archimedean spiral, and it is projected onto the cone as one smooth conical helix.

This supersedes the pass-98 tiers and this pass's own interim hold-and-descend fix. Claimed files: `fusee-motion.js`, `fusee-geometry.js`, `fusee-chain.js` (the last is unchanged). They are used only by `fuseeDrive()` (checked with grep). In `authored-gears-core.js` four lines of `fuseeDrive()` changed: the `helicalLedge` flag, the anchor comment, `sourceWrapLeft` and `fuseeForm`.

- **Body (`fusee-geometry.js`).**
  - The body is one closed helical staircase.
  - Risers stand at r(θ) = 0.56 + 0.2·θ/2π − 0.0195 (an Archimedean spiral in plan).
  - The tread falls linearly, 0.26 per turn, and is swept by horizontal radial lines, so the chain lies level across it.
  - Every radial section is a staircase (tread plus vertical riser). Round the axis, tread and riser sweep on continuously, with no step face anywhere.
  - The ledge runs out cleanly at both ends. Over the turn above the chain's free end, the riser height grows from nothing out of the flat top. Over the turn below its anchored end, it falls back to nothing into the base flange (r 1.28).
  - All surfaces share one angle grid (720 per turn). The riser shading is analytic and smooth along the spiral, and the tread normals follow the lead.
  - The two closing wedges are split, so there are no T-junctions. The mesh is watertight and faces outward.
- **Chain (`fusee-motion.js`).**
  - On the fusee the chain's centre line is the conical helix itself: Archimedean in plan, height falling linearly with angle.
  - The chain runs on the tread against the riser all the way. The pin ends sit 0.002 over the tread, and the riser behind stands at least 0.184 above the chain's top.
  - There are no descents, holds or lifts.
- **Run to the barrel.**
  - The span leaves tangent to the helix at its lead angle, rising towards the barrel: 4.2° at the smallest radius, 2.2° at the largest.
  - A level span is not possible here without lifting the chain off the tread. The span leaves over the part of the turn above the contact, whose tread is higher, and the helix-tangent line is the lowest straight line that clears that tread.
  - The barrel coil records the span height and eases onto it with matching height and slope. Each barrel turn lies at least 0.119 below the last; the reserve turn is at 0.47.
- **Source pose.** 5.5 rad (about one wrap) is left on the fusee.
- **Label.** `fuseeForm` is now `'helical-ledge-on-cone-archimedean-in-plan'`, and the fusee's userData carries `helicalLedge: true`.

### Numbers

- Span lead angle: at most 4.22° (tan equals the helix lead, to 1e-9).
- The span clears the ledge under both plate edges by at least 0.0020.
- Clearances:
  - Pin/bore minimum 0.0016 (HEAD 0.00055).
  - Leaf separation 0.0037.
  - Chain to fusee triangles 0.00106; chain to barrel 0.0012.
- Barrel turns drop at least 0.119 per turn.
- `stateAtProgress` takes about 0.4 ms.

### Captures

Captures are in `/dev/shm/p99/a/46/`.

- `cmp46-helix.png`: plate, the HEAD default, and after at phases 0, 0.25 and 0.5, side, top, yaw ±40, pitch ±25, and close-ups.
- `after2-ob.png`: oblique views from above at four phases (the user's 112.png view), plus back and underside views.
- `after2/`: the full set, including the eye-level phases `after2/eye*.png`.

The colour sectors are the shared quadrant rotation cue, not steps.

### Tests and screens

- **`tests/fusee.test.mjs`: 10/10 pass.** Three tests are new or rewritten:
  - Every vertical face faces radially (at least 0.99), so no face runs across the circumference. The tread height is continuous round the circumference, and each radial section drops one lead per turn. The chain line is the conical helix.
  - Every fusee pin lies on the spiral riser, 0.002 over the helical tread, and is backed by the riser.
  - The span continues at the helix lead (4.3° or less) and clears the ledge, and the barrel turns stay separate.

  The closed-solid, pin/bore, leaf, triangle-clearance and self-clearance tests pass unchanged.
- **`models.test.mjs`, 46 block: passes.** It checks `helicalLedge`, `fuseeForm`, the 5.5 rad source wrap, and that the contact lies on the helix.
- **`gears-24-46-source-match`: 8/8 pass.**
- **Screens:**
  - Body intersections: worst 0.
  - Disconnected parts: 0 detached; 4 near-misses, as before.
  - Coincident faces: 0.
  - Loop seams: 0.

### Residuals

- The run to the barrel rises at the helix lead angle (2.2–4.2°), not level as Brown draws it. That is geometrically forced by a continuous helical ledge.
- Chain and spring response remain kinematic.

## 116: Brown-width crescent pawls (MuJoCo, rebaked)

- **Plate.** Brown's pawl leaf is about 0.09 wide from line centre to line centre, a little wider than its eye, all along its length. Its claw face spans the whole ratchet locking face. The pass-93/96 leaf was about 0.04 wide (inscribed).
- **Geometry (`mujoco-rack-rectifier/geometry.js`).** Same construction: bored boss, convex outer arc, concave inner arc, and the claw nose at the hook angle. New defaults:
  - working face 1.15 face lengths (was 0.6);
  - boss radius 0.044 (was 0.036);
  - outer arc tangent to the boss at 125° (was 100°).

  The inscribed width is now 0.088–0.092 from boss to claw. The claw, nose and inner arc are unchanged.
- **Why wider pawls broke the speed law.** The leaf has 1.86× the volume and about 2× the hinge inertia. With the 0.001 spring, the idle pawl was flung to 0.8 rad at each reversal. It was still lifted when its pinion began to drive, so the output overran (speed deviation ±0.14; the band is ±0.08).
- **Physics fix (`physics.js`).** Pawl spring 0.0025 with rest −0.04 (was 0.001 / −0.07). Backlash 0.005 (was 0.008; pass 86 found 0.005–0.012 seats). The alternatives swept are recorded in /dev/shm/p99/a/116/sweep*.txt.
- **Native results (2 cycles).**
  - Speed −1.101 to −0.980 rad/s. Deviation from π/3 is −0.054 to +0.067; pass 96 was −0.028 to +0.065.
  - Mean −1.04724.
  - Seated lift 0.0012 rad; seated offset 0.045°; every stroke drops and seats.
  - Penetration 0.167 px (was 0.151).
  - Mesh error 0.063 px.
  - Reverse step 3.5e-6 rad, a catch recoil; the test bound was relaxed from 3e-6 to 4e-6.
- **Bake.** `node scripts/bake-mujoco-movement.mjs 116`: 375-sample 6 s loop, raw seam 0.0102 px, round trip 0.0085 px. `mujoco-baked-loops` 116 (provenance, compiled physics, seamless playback) passes 3/3.
- **Captures** (/dev/shm/p99/a/116/):
  - `cmp116.png`: plate crop | before | after;
  - `phases116.png`: 7 phases plus the rear pawl;
  - `views116.png`: default, yaw ±40, pitch 25, side and an oblique pawl close-up;
  - before-*.png and after-*.png.
- **Tests.** `tests/mujoco-rack-rectifier.test.mjs` passes 7/7. It adds a leaf-width guard (≥0.075 over the whole leaf, boss ≥0.044, claw face ≥1.05 face lengths) and the reverse-step bound 4e-6.
- **Screens.**
  - Body intersections are the same as HEAD. They screen the gears-core study: worst 0.0485 at the rack/pinion working contact.
  - Disconnected parts are the same as HEAD: 0 detached, 8 near-misses.
  - Coincident faces: 2 new flagged pairs, total area 2.8e-8 relative. These are rack/pinion tooth side faces at a working-contact penetration, at one sampled phase. They are not the pawls.
  - Loop seams: 0.
- **Not rerun.** `audit-rack-rectifier-clearances.mjs` stops at "leftStub outside camera bounds". It fails identically on HEAD (pass-60 stem run-ons), so it is stale and out of scope.
- **Docs.** A pass-99 section was appended to `docs/mujoco-116-rack-rectifier.md`.
- **Proposed ledger row.**
  - assessment: reasonable.
  - visibleFlaws: "".
  - limits, replace the p93/p96 pawl sentences with: "p99: the pawl crescents are Brown's width (about 0.09, boss r 0.044, claw face spanning the locking face). The heavier leaves use pawl springs of 0.0025 (rest −0.04) and a 0.005 backlash (rebaked). The output runs −1.101 to −0.980 rad/s (π/3 ± 0.067), fastest just after the claw catches and slowest while the backlash closes."
  - Intersections note: native maximum penetration 0.00167 (0.167 px).

## 191 progressive-speed scroll gears — no change; residual proven forced

Scratch and captures: `/dev/shm/p99/a/191-208/`. Nothing in `src/` was changed for 191, and `authored-gears-core.js`, `irregular-gear-family.js` and the baked profiles are untouched. The hash is unchanged.

**Plate check.** `cmp-seam.png` puts the model's seam at phase 0 (4× zoom) beside a 4× crop of `mm_191.png`. Brown also draws two tall step teeth side by side at the seam. Each step tooth is the high side's end tooth, and its outer face is the radial step wall. The model has the same arrangement. The visible difference is the first low-side tooth beyond each step: Brown draws it whole, but in the model it is cut diagonally across its top (`relief.png`, where black shows the removed material).

**Why a timing change cannot remove the relief.**
- Test setup: the unrelieved hobbed pair (square step teeth, no seam or wall relief) was rebuilt from the generator (`unrelieved.py`). Across the 0.24 rad of driver turn either side of the seam, the driven angle was then offset from the rolling law by −0.1…+0.1 rad in 0.002 steps (`corridor.py`, `corr.pkl`).
- Result: from pose 7912/8192 to the seam, and from the seam to past pose 316/8192, no offset in that range is free of overlap.
  - Peak overlap is 0.0079 under the rolling law.
  - The best offset only reduces it to 0.0077.
  - The clash just moves to the next tooth.
- Cause: with a step, each gear's approaching high side and the mate's approaching low side run at the old ratio (1.29) until the seam, but mesh at the new ratio (0.77) after it. A ratio jump of 0.52 over roughly 0.2 rad of approach, at radius ≈1.5, is ≈0.15 of tangential misfit. That is larger than a tooth top (≈0.10). The mirror clash happens in the recess after the seam.
- Consequence: without the step there is no progressive-speed reset, so some tooth material near each step must go.

**Why a tooth-phase change cannot remove it either.** Both racks were shifted together, which keeps the pair conjugate, by δ = 0, 0.2, 0.35, 0.5, 0.65 and 0.8 pitch. The full generator was run each time (`gen_shift.py`, `out*.json`, `shift.png`, `shift2.png`). Removed area per gear (driven / driver):

| δ (pitch) | Removed area, driven / driver |
|---|---|
| 0 (current) | 0.0134 / 0.0136 |
| 0.2 | 0.0205 / 0.0180 |
| 0.35 | 0.0252 / 0.0196 |
| 0.5 | 0.0055 / 0.0052 |
| 0.65 | 0.0200 / 0.0253 |
| 0.8 | 0.0181 / 0.0207 |

Only δ = 0.5 is smaller, and it still relieves the second low-side tooth's flank. It also puts a tooth space at the top of each step wall, so Brown's tall step tooth disappears and the step reads as a bare rim shoulder. The current phase is the one that matches the plate.

**Tooth form.** The teeth are hobbed by a 14.5° straight rack, the involute stand-in the rulebook asks for ("involute pinions"; rack and pinion compatible). Squarer racks do not work at this size:
- A 5° rack undercuts heavily: the rack addendum is 0.111, against r·sin²α = 0.011 at the smallest pitch radius 1.40.
- A 10° rack still undercuts (0.042).
- Either would give necked teeth, not square ones.

**Checks.**
- `check-loop-seams --ids=191`: the only flag is the intended velocity kink at the reset (0.39); there is no pop or jump.
- Contact report 191-196-201: 513 poses, no overlap, minimum gap 0.0024 (unchanged).

**Captures.**
- `b191-d0.png`, `b191-d5.png`, `b191-y40.png`
- `b191-z0.png`, `b191-z02.png`, `b191-z98.png`, `m191.png`
- `cmp-seam.png`, `relief.png`, `ov1.png`, `shift.png`, `shift2.png`

**Proposed ledger row.**
- assessment: minor
- visibleFlaws: "The first low-side tooth beyond each step has its top cut diagonally for the once-per-turn reset, so the step tooth stands more isolated than Brown's."
- limits (append): "p99: the relief is forced. Holding the driven angle anywhere within ±0.1 rad of the rolling law still leaves ≥0.0077 overlap in the unrelieved hobbed pair near the seam; the 0.52 ratio jump misfits the approaching teeth by ≈0.15. Of the six tooth phases tried, only a half-pitch shift needs less relief (0.0055 against 0.0134), and it removes Brown's step tooth. The 14.5° involute teeth are the rule's stand-in; lower angles undercut into necked teeth."

### p99 follow-up: two alternatives the lane lead asked for (both fail)

A correction first. The 0.0077–0.0079 quoted above is overlap **area**, not depth. The unrelieved clash is a lens whose inscribed depth reaches 0.037 (`depth.py`), so it is about 0.07 thick. It is always the same pair (`ov2.png`):
- Before the reset, the mate's tall step-tooth top sweeps across the first low-side tooth beyond the step.
- After the reset, the same happens in mirror image.

1. **Uniform backlash instead of local relief** (`erode.py`). Both gears are offset inward by t: flanks and tips together, with mitred corners. At each seam pose the best driven-angle offset within ±0.03 rad is then chosen. Worst remaining overlap area:

   | t | Worst overlap area |
   |---|---|
   | 0.005 | 0.0050 |
   | 0.01 | 0.0031 |
   | 0.02 | 0.00043 |
   | 0.03 | 0 |

   Clearing needs t ≈ 0.03 on every flank of both gears, a working backlash of about 0.06. Tooth thickness falls from about 0.14 to about 0.08 against a pitch of 0.28, so every tooth is visibly thin, and the tips drop 0.03. That is a bigger, global visible change than the local cut. Rejected.

2. **Square teeth with backlash, prescribed rolling law** (`square.py`). Parallel-sided spaces were cut on the same pitch spirals, with the same tooth phase and step walls. Checked over 2,049 poses (every 4th of 8,193):

   | Tooth / space | Result |
   |---|---|
   | 0.14 / 0.14 (Brown's equal split) | Overlaps at every pose (worst 0.0148); square tips jam in normal running |
   | 0.12 / 0.16 | Overlaps at every pose (worst 0.0098) |
   | 0.10 / 0.18 | Clear away from the seam (sampled maximum gap 0.015). The same step-tooth clash remains at the seam (0.0079 at pose 8012, 148 poses within about 4% of the seam) |

   Square teeth would need both the seam relief and a much thinner tooth than space. Rejected.

**Conclusion.** The clash comes from the step itself: the ratio jumps from 1.29 to 0.77 while the tall step teeth pass. It is independent of tooth form and timing. The current local relief is the smallest visible change. Nothing in `src/` was changed, and the ledger row proposed above stands, with this limits sentence appended: "Uniform flank backlash would need 0.03 per flank (teeth 0.08 against pitch 0.28), and square teeth still clash at the seam (0.0079) and need 0.10/0.18 tooth/space."

## 194: Brown's 22 pins, an envelope-cut pinion, and the drive moved off the pinion face

Scratch files and captures are in `/dev/shm/p99/a/194/`: `before/` (HEAD), `after/`, `cmp194.png` (plate | before | after, default view), `cmp194rot.png` (yaw +40, pitch +25 and side views, before on top, after below), `c.png` (pinion close-ups at phases 0–0.5, through the right reversal), and `v3.png` (default view at the outer run and the inner run).

- **Plate measurements.** I measured the plate by blob analysis.
  - There are 22 oblong pins on r = 142 px, 14.49° apart, with a 55.8° gap at the top between the end pins (at 62.4° and 118.2°).
  - Each pin is about 0.255 × 0.10 model units.
  - The pinion has 10 square teeth about half a pitch thick, with its tips at 0.47 and root at 0.356. Its centre is 198 px (1.603) below the wheel axis.
- **Pins and pitch.** There are 22 pins at Brown's pitch. The pinion's pitch radius comes from that pitch: 0.4627 for 10 teeth. That puts its outer-run centre at 1.613 (Brown: 1.603), and the plate anchor comes out 1.2 px from Brown's axle (HEAD: 6.6 px).
  - The pins are flat stadium studs (straight radial sides, semicircular ends, 0.234 × 0.104) that stand on the face. They replace the lying capsules and their seats.
  - Each cycle is now 52 pinion teeth (5.2 turns) and still closes in tooth phase.
- **Why a fixed involute failed.** At each reversal the pinion pivots about the end pin, so that pin turns half a revolution inside one tooth space.
  - An oblong end pin needs a 0.234-wide socket for that. The pinion teeth would then be 0.05 thick, which is spindly. This is the root of the earlier 0.031/0.036 working gaps.
  - The fix: the two end pins are round studs (r 0.08) that fill the tooth space. They are the reversal pivots, and the teeth keep Brown's proportions (0.13 thick at the pitch circle).
- **Pinion shape.** The pinion is cut offline (`scripts/generate-radial-pin-mangle-pinion.mjs`, regenerated as `src/simulation/baked/radial-pin-mangle-pinion.js`).
  - It is the envelope of every pin through the model's own rolling law: 16384 poses, 7200 rays, 0.0005 clearance, tip 0.5, root 0.345, ten-fold symmetry.
  - It is one flat smooth extrusion.
  - **Hidden HEAD defect:** `finishReversingMangleGuides` had overwritten 194's baked pinion with an involute that ran through the pins. The pin-profile test only audited the unused polygon. The involute rebuild now skips 194.
- **Working contact** (independent segment audit of the rendered outline, 8193 phases):
  - Nothing penetrates; the minimum clearance is 0.00034.
  - Some pin is always within 0.0058 of the pinion: outer run ≤ 0.0013, inner run ≤ 0.0058 at brief tooth hand-offs, both reversals 0.00045 (the round stud is held). 0.0058 is about 0.9 px at the default view.
  - Motion is still prescribed ideal rolling, so both runs are exact and equal in speed.
  - Contact alternates between flanks, so a loaded wheel would ripple slightly. This is not simulated.
- **Universal joint.**
  - The pinion shaft now runs straight out 2.8 in front of the pinion, in steel grey.
  - The default camera is (0.8, 3.4, 16), slightly more from above than HEAD's (1.6, 0.9, 16). That view puts the joints below the pinion: the pinion's teeth and dark hub circle are clear, as on the plate, and only the thin shaft crosses the face.
  - Other lanes' 192/193 are untouched: their hashes match HEAD.
  - The input shaft still ends free when the view is rotated. The frame is removed by `source-presentation.js`, which is owned by p99-d, and adding any bearing means adding an undrawn support.
- **Screens.**
  - Body intersections: 8 bodies, worst 0.
  - Disconnected parts: 0 detached; near-miss pairs 105 (HEAD 125).
  - Coincident faces: 0.
  - Loop seams: 0.
- **Tests.**
  - `tests/movement-194.test.mjs` 5/5: 22 pins, new source anchors, 5.2 turns per cycle, bounds.
  - `tests/radial-pin-mangle-contact.test.mjs` 4/4, rewritten: pin shapes and pitch, ten-fold outline, tooth thickness, and a 2049-phase audit (min > 0.0002, working gap < 0.0065, reversals < 0.001).
  - `tests/reversing-mangle-finite-guides.test.mjs` 16/16 (192–194).
  - `tests/helpers/radial-pin-profile.mjs` now reads each pin's own angle, half-length and radius.

## 195: Brown's rectangular face slots, driven by a slot-cut worm

- **Plate.** Brown draws 24 plain rectangular slots, open at the rim (no rim line across them), about 0.3 of the pitch wide and 0.17 R long, with a short worm (three crests visible, leaning "/") whose axis crosses in front of the upper wheel's rim; the lower wheel hides the worm's lower half. The p92/p93 wheels were the exact envelope of a worm whose axis lay in the face plane, so every tooth space was a slanted, curved scallop and a root groove ran round the face.
- **Why straight slots were "impossible".** With the worm axis in the face plane each crest point stays below the face for half a turn, during which the slot travels half a pitch, so vertical-walled slots had to span most of the pitch (the old 77% figure).
- **Change (new `src/simulation/face-slot-worm-195.js`).**
  - The worm axis now stands 0.311 clear of each face (upper face behind it, lower face in front), at radius 1.12 from each wheel axis (Brown's 115 px hub-to-worm distance). The worm has Brown's proportions: tip radius 0.33, root 0.16, 3.5 turns (1.026 long, his 213–318 px window), a square thread 0.078 wide, left-handed so its visible front leans as drawn. Only the outer 0.02 of the thread dips below a face; root and flanks never reach the lands.
  - Each wheel is one closed solid: a flat face with 24 rectangular slots 0.10 wide (0.31 pitch at the rim), from r 0.995 out through the rim, 0.06 deep, with vertical parallel walls and flat floors. It has a true cylindrical rim and a bore. The pocket walls read as dark notches in the default view, like Brown's.
  - The worm's crest is **cut by the slots themselves**: `scripts/generate-worm-crest-195.mjs` sweeps every crest point through one worm turn, which advances each wheel exactly one slot, against both wheels' solids grown by 0.0025 clearance (plus 0.001 chord allowance). It uses the rendered model's matrices. The crest keeps the smallest radius any phase allows. This is a legitimate wheel-generated worm: no interference by construction.
  - Both wheels cut the same crest (the pair is symmetric about the worm axis; the difference between them is 2.9e-5).
  - The crest is trimmed at 10,609 of 28,950 grid points. It shows as a slight bevel along the crest edges near the worm's ends.
  - `--check` reproduces the bake byte for byte.
  - The feed now runs +x (the thread hand was flipped to match the plate; the plate has no arrow). Both nip surfaces still move together.
- **Removed.** `src/data/face-worm-195.js`, `src/data/face-worm-195-mesh.js`, `scripts/generate-face-worm-195.mjs` and `scripts/bake-face-worm-195-mesh.mjs`, along with the envelope-sector builders in `feed-worm-assembly-parts.js`. The 207 branch is unchanged (its geometry hashes identically to HEAD).
- **Cost.** 195 now draws 73k visible triangles (was 168k).
- **Numbers.**
  - Solids review, actual meshes, 17 poses (the report): 0 penetrations, minimum gap 0.00232 on both wheels. A 65-pose scratch run gives a minimum of 0.00182.
  - Exact wall-plane backlash over 257 phases (worm vertices against the slot walls): 0 penetrating vertices. The gap is 0.0035–0.0073 on one wall side and 0.0040–0.0080 on the other.
  - Working-face review (wall faces sampled on a 0.004 grid, opposed normals and moment filter): 17 poses, 0 missing, best working gap 0.0038–0.011.
  - The gap varies because contact is continuous only at the phases where a slot wall's generating line falls inside the shallow crest region. Between those phases the thread floats up to about 0.004 more than the clearance.
- **Captures** (`/dev/shm/p99/a/195-198/`):
  - before: `b195-def.png`, `b195-y40.png`, `b195-close.png`;
  - after: `sheet195.png` (default, yaw ±40, pitch ±25, side) and `sheet195b.png` (close-ups at phases 0, 0.33, 0.66, an oblique crest view, the slot ring, and the plate);
  - worm alone: `t195-worm-below.png`, `t195-top.png`, `u195-worm.png`.
- **Screens.** Body intersections: worst 0. Coincident faces: 0. Disconnected parts: 0 detached, 0 near-miss, 0 slivers or lips. Loop seams: 0.
- **Tests.**
  - `tests/movement-195.test.mjs` (5/5), updated for the thread hand, the offset faces, 3.5 turns and the source anchors.
  - `tests/feed-worm-assembly.test.mjs` (11/11). New tests check that each wheel is a closed slotted solid with its expected volume and straight parallel slot walls, and that the worm is a closed solid carrying the trimmed crest bake (symmetric, trimmed only above face level). The report tests use the regenerated reports.
  - Rotation-indicator, source-presentation, solid-worm, feed-worm-wheel and movement 207 pass.
- **Reports regenerated (pose counts kept).**
  - `docs/validation/feed-worm-195-solids.json` (17 poses).
  - `docs/validation/feed-worm-195-working-faces.json` (17 poses).
  - `docs/validation/feed-worm-207-working-faces.json`: sources list only, results identical.
  - Two review-script fixes support these. Both scripts accept a non-instanced wheel. The working-face review probes 195's large flat walls on a grid, and it skips the closest-triangle scan for probes that cannot beat the current best, which leaves 207's results unchanged.
  - `202-264-worm-solids.json` fingerprints `authored-gears-core.js`; it is left for the lane's final regeneration.
- **Proposed ledger row.**
  - assessment: reasonable
  - visibleFlaws: (empty)
  - limits (replace the pass-92/93 sentences on scalloped spaces and the envelope bake):
    > p99: Brown's rectangular rim-open face slots (24, 0.10 wide, 0.06 deep, vertical walls). The worm axis stands 0.311 clear of each face and only the outer 0.02 of its square left-hand thread enters the slots. Its crest is cut offline by both wheels' slots (scripts/generate-worm-crest-195.mjs), so the pair is exact and interference-free: sampled minimum gap 0.0018–0.0023. The running gap varies 0.0035–0.008 over each worm turn (the slot walls touch the shallow crest only at some phases). Motion is prescribed; friction and load sharing are not solved.

## 198: eight-tooth pinion

- **Plate.** Brown's pinion has 8 square-topped teeth on a large hub. His rack pitch (about 22 px) and loop height (pitch lines about 45 px from the centre line, so a pinion pitch radius of about 22.7 px) imply about 6.5 teeth, and his drawn pinion is smaller than that pitch circle. The drawing cannot give both 8 teeth and his rack pitch.
- **Change.**
  - Keep the rack loop and every linkage and frame dimension (the pinion pitch radius 6 × 0.42 / 2π is unchanged). Cut 8 stub involute teeth (0.8 module) on that pitch circle, so the circular pitch becomes 0.315.
  - The closed rack becomes 48 teeth: 16 per straight run and 8 round each end (Brown draws about 12–13 per run).
  - `scripts/generate-mangle-rack-working-profiles.mjs` now takes the tooth count from the model and regenerated the rack against the 8-tooth pinion. 197's baked profile is byte-identical, and `--check` passes.
  - Role and mechanism strings now say eight-tooth and forty-eight-tooth.
- **Numbers.** Finite working-profile audit (257 poses, all four branches), `mangle-rack-working-contact`:
  - minimum separation 0.00033 on the straight runs and 0.00020 at the end turns (HEAD: 0.000085 and 0.000054);
  - maximum driving-face gap 0.00043 (HEAD: 0.00050);
  - no positive-area overlap.
  The historical-witness test now checks every rack tooth near the pinion at the old witness time.
- **Captures** (`/dev/shm/p99/a/195-198/`):
  - before: `b198-def.png`, `b198-ym40.png`, `b198-close.png`;
  - after: `a198-close.png`, `sheet198.png` (default, yaw ±40, pitch ±25, side) and `sheet198b.png` (close-ups at phases 0, 0.12, 0.3, 0.45, 0.6, 0.85, through both end turns).
- **Screens.** Body intersections: worst 0. Coincident faces: 0. Loop seams: 0. Disconnected parts: 0 detached, 0 slivers or lips. There are 24 near-miss pairs; 20 are the same as HEAD (guide-roller bores and frame plate). The 4 new ones pair a rack tooth with a front cross-tie end mount 0.12 apart. Both are rigid on the carrier, so this is not a joint.
- **Tests.**
  - `tests/movement-198.test.mjs` (6/6): now 8 and 48 teeth, a 40-pitch centre loop, 16 per run.
  - `tests/mangle-rack-working-contact.test.mjs` (10/10): the witness test now checks every nearby tooth.
  - `tests/movement-197.test.mjs` passes. 197, 196, 199 and 207 hash identically to HEAD.
- **Proposed ledger row.**
  - assessment: reasonable
  - visibleFlaws: (empty)
  - limits (append):
    > p99: eight stub involute pinion teeth as Brown draws them, on the unchanged pitch circle; the rack is regenerated offline with 48 teeth (16 per run where Brown draws about 12–13, since his rack pitch and his 8-tooth pinion are inconsistent). Working-profile minimum separation 0.00020 and driving-face gap at most 0.00043.

## 208 three-ratio pin wheel and sliding slotted pinion — no change; closed slots proven impossible

Scratch and captures: `/dev/shm/p99/a/191-208/`. No file was changed for 208.

**Plate check.** `cmp208.png` shows the model default, the plate, and a close-up. Brown's edge-on pinion strip shows black slot rectangles with a white margin at both ends. On a slot cut through the full thickness they would reach both face lines. Read that way, the slots are closed pockets. The auditor's reading is fair.

**Why closed ends cannot work.** The model stops the wheel before each axial shift (3.5 s dwell, then 1.2 s shift, with the wheel stationary). A slot closed at both ends traps any pin inside it, so the pinion can slide only when no pin of the engaged ring is under its rim. Measured on the actual baked slot outline (`generated-pin-slot-208.js`):
- Tip radius: 1.0095.
- Height from the pinion axis to the pin tops: h = 0.72.
- The rim therefore reaches below the pin tops over |y| < 0.708 (0.790 including the 0.082 pin radius).
- The pin pitch is 0.393, so at every wheel angle at least 4 pins of the selected ring lie under the rim. A closed pocket would hold them, and the fork could not move the pinion.
- A phase with no pin under the rim needs the reach to be at most p/2 − r_pin = 0.114. The pins would then enter the slots only 0.0065 deep, against 0.29 now. That is not a drive.
- Engagement and shifting also conflict on their own. A pin in the slot drifts axially by R − √(R² − y²) across the reach: up to 0.29 on the middle ring and 0.21 on the outer ring (the inner ring's pins reach the rim edge). Closed pockets would have to span that drift, but the neighbouring ring is only 0.3125 away. Even ignoring the shift, the walls would have to lie inside the neighbouring ring's pin sweep.

**Conclusion.** "By shifting the slotted pinion along its shaft" (the caption) requires slots open at the ends. Brown's closed rectangles cannot coexist with the captioned shift. The open slots are kept.

**Checks.** `check-loop-seams --ids=208`: clean.

**Captures.** `b208-d0.png`, `b208-r.png`, `b208-z.png`, `cmp208.png`.

**Proposed ledger row.**
- assessment: minor (or reasonable if a proven caption-required deviation is accepted)
- visibleFlaws: unchanged, "Brown's slots are closed at both ends; ours run open across the strip."
- limits (replace the first sentence): "Closed slot ends are impossible (p99 proof): the pinion's rim reaches below the pin tops over |y| < 0.79, so at every wheel angle at least 4 selected-ring pins sit in its slots (pitch 0.393). Closed pockets would trap them against the captioned axial shift. A clear phase would need pin engagement ≤0.0065 deep (0.29 now)."

