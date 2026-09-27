# Pass 86, lane p86-3: pawls, catches and stops (217/218, 223, 224, 238, 239, 247, 266, 271, 284, 320; sweep of 116, 123, 209)

Reviewer: Claude Opus 5.5, lane p86-3 (four sub-forks, integrated by the lane). Date: 2026-09-27.

Scratch and captures are in `/dev/shm/p86/p86-3/` (outside Git).
- **Before captures:** `before/tile-ID.png` shows the plate, phases 0/0.25/0.5/0.75 and a rotated view.
- **After captures:** in `A/` (217/218, 223, 224), `B/after/` (238, 239), `C/` (247, 266) and `D/` (271, 284, 320).

Every changed ID was run through `screen-body-intersections`, `screen-disconnected-parts`, `check-loop-seams` and the camera-fit catalog test.

## 218 (and 217's shared transmission): catch G
- **Before.** G stood in its own layer in front of the lever. Its lug was a 0.56-long round pin reaching back into F's notch, and the G stud was a separate cylinder standing proud of the bar (`before/tile-218.png`).
- **After.** G is one flat plate, 0.2 deep, in F's own plane. It hangs behind the lever on the hinge pin through a bored boss (r 0.24, bore 0.155). The outline is Brown's:
  - a broad arched bar;
  - a round knob beyond the lug;
  - a straight lug, 0.18 wide;
  - the G stud, drawn as a lobe on the bar's outer edge.

  The lug's axis is its release direction, so lifting draws it straight out. The hook pin and trip roller are hidden. The shared notch profile (`src/data/wool-comber-notch.js`, regenerated with `scripts/generate-wool-comber-notch.mjs`) now has round roots that follow the lug's 0.09 tip, which seats with 0.002 clearance. G/F overlap is 0 at all 513 poses.
- **Captures:** `A/after-tile-218.png`, `A/a218t.png`, `A/tips218.png`.
- **Screens:**
  - Intersections: clear.
  - Disconnected parts: one near-miss, the existing 0.0147 lever/shaft-H bore clearance, which shows only while G is lifted.
  - Seams: clear.
- **Tests:** movement-217 (7), movement-218 (6) and wool-comber-contact (5) pass. movement-218 now asserts that G is a single mesh in F's plane with no pin, and that G never cuts F.
- **Residual:** F's notches have round roots where Brown draws square ones.

## 223: overhanging teeth
- **Cause.** Each driver sector's two changeover stub teeth were centred on its radial edges, so half of each hung past the edge. That made eight overhangs across the four driver sectors.
- **Change.** A new `clipToSector` cuts those stubs flush with the sector edge. Phase and working teeth are unchanged. `docs/validation/221-222-223-contact.json` was regenerated; only its hash changed (538 poses, 0 penetrating).
- **Captures:** `A/b223dt.png` (before), `A/cmp223.png`, `A/after-tile-223.png`.
- **Tests:** movement-223 (7) and variable-idler-solids (5) pass. Screens and seams are clear.
- **Residual:** a dark strip of the rear sector's web lap shows between abutting driver sectors. This predates the pass.

## 224: click e on pinion d
- **Change.** Click e, which Brown draws, is now one flat plate in d's plane.
  - **Pivot:** a pin on the fixed 60° channel's rail.
  - **Shape:** the arm arches over d, and the tip is d's own tooth space less 0.012 rad per flank.
  - **What it does:** it blocks the clockwise turn that belt tension imposes. A new segmented law replaces the sine:
    1. d winds three teeth forward while the click ratchets over them;
    2. d overshoots by 0.024 rad and slips back onto the click;
    3. d holds expanded;
    4. the click is lifted by hand, d turns back three teeth, and the click drops into its seat.
  - **Resting angle:** computed from d's finite outline and baked by `scripts/generate-expanding-pulley-click.mjs` into `src/simulation/generated-expanding-pulley-click.js`.
  - **Validation report:** `docs/validation/219-224-414-contact.json` was regenerated with the click pairs. 224 has 0 penetration; 219 and 414 are unchanged.
- **Captures:** `A/after-tile-224.png`, `A/a224t.png`, `A/tips224.png`.
- **Tests:** movement-224 (7, with a new click test) and variable-face-gear-solids (4) pass. Three float-rounding tolerances were loosened by ULP-scale amounts because the rates are now higher. Screens and seams are clear.
- **Residuals:**
  - The pivot is turned 8° and nudged 0.03 onto the rail, so the tip enters at 72° where Brown draws 64°.
  - The model loads in 227 ms (was 82).
  - The top rim runs behind the click, because it sits closer to d than Brown draws it. This predates the pass.

## 238: six-point star and anchor
- **Before.** A seven-point star with a brittle outline, and an anchor built from pads, webs, standoffs and swept-envelope cuts.
- **After.** Rebuilt from scratch (`sixPointAnchorEscapement` in `authored-escapements.js`, new `six-point-anchor-238.js`).
  - **Wheel:** six identical points (Brown's tips are about 60° apart), root/tip ratio 0.63, rounded tips.
  - **Anchor:** one flat plate in the star's plane and thickness, with Brown's outline.
    - B's top face lies along the locked point's flank, with its corner in the root.
    - C's hook edge lies along the opposite flank at the other end of a 14° swing. In the plate pose, C's point lands 3 px from Brown's.
  - **Motion:** the anchor's swing is prescribed. The wheel is urged forward and stops where it meets the anchor, with 0.7–3.3° recoil when a pallet enters a root.
    - This is baked by `scripts/bake-six-point-anchor-238.mjs` into `baked/six-point-anchor-238-wheel.js` (1200 samples, `--check` passes).
    - The wheel advances exactly one tooth per swing.
  - **Deleted (238-only):** the seven-tooth working-parts and contact modules, their baked tables, three scripts and two tests.
- **Captures:** `B/after/tile-238.png`, and `B/after/tile-238z.png` (B lock at 0/0.30/0.36/0.95, C at 0.42/0.50/0.70/0.80).
- **Tests:** movement-238 is rewritten and passes 5/5: flank-flush seating, overlap below 2e-5 over 480 phases, one tooth per swing.
- **Screens:**
  - Intersections: worst 0.0002, which is the working contact.
  - Disconnected parts: no floating parts. The wheel is held only through the anchor during its drop, because Brown draws no frame for D's arbor.
  - Seams: 0.
- **Residual:** the catalogue title and archetype in `src/data/movements.json` still say "Seven-Tooth". That file is outside this lane.

## 239: paired stops
- **After.** Each stop is one plate:
  - a round boss (0.26) bored for its pin;
  - an arm bounded by two smooth edges;
  - Brown's wedge nose, 0.36–0.40 wide at the tooth tips, with arms at least 0.3 wide.

  The working edges follow the plate: the left nose stops counter-clockwise turning and the right nose stops clockwise. Each lies exactly on its tooth flank from 0.08 above the root. Removed: the left hinge blob, the right stop's narrow "load land" protrusion, and the baked envelope outlines with their generator. Play is 4° (was 4.9°).
- **Captures:** `B/after/tile-239.png`, `B/after/tile-239-z9.png`, `B/after/tile-239-before-after.png`.
- **Tests:** movement-239 (3, rewritten) and opposed-spur-239-contact (5) pass.
- **Screens:**
  - Intersections: 0.
  - Disconnected parts: each stop group is a near-miss because the screen does not count its support-beam meshes; the support code is unchanged.
  - Seams: 0.

## Sweep of 116, 123 and 209 (no changes)
- **116.** Each pawl is a thin capsule link (0.052 wide). Its round nose bears on the middle of the ratchet face instead of nesting in the root (`B/tile116z.png`). This breaks the seating rule. It was not fixed because the geometry feeds the MuJoCo collision model and the baked recording, so a fix needs a native rebake and a provenance update.
- **123.** There is no pawl. The transfer piece is an even-thickness crescent, as Brown draws it.
- **209.** The forked catch is one smooth flat plate with a boss and no pins.

## 247: sloped catch and spring
- **Catch.** The thin stick nose is now Brown's sloped barb: one 0.10 extrusion with a tapered blade from the eye. It keeps the rounded seat under the weight, so release timing is unchanged. Below the seat, a convex face runs down and in to a tip 0.15 inside the bore.
- **Spring.** The old tube was glued to the arm, and a hand had to release the catch on reload. It is replaced by a curled flat leaf spring set in the rod, whose curl bears on the upper arm's edge. It presses the catch outward into engagement and holds the roller on the probe pad, which is the stop.
- **New motion:**
  - the probe cams the catch in against the spring;
  - after the drop, the catch rubs the spent weight's bore and snaps out over its rim;
  - on reload, the rising weight meets the slope, cams the catch aside, and the catch springs out under it.

  There is no detent or manual release.
- **Captures:** `C/247-before-zoom.png`, `C/247-after-tile.png`, `C/247-spring.png`.
- **Tests:** movement-247 is updated (spring return, continuity, cam on reload, and new barb/spring geometry checks). release-mechanism-working-parts passes unchanged.
- **Screens:**
  - Intersections: no solid pairs; only the existing sounding-line rope pairs.
  - Disconnected parts: the same two p85 entries.
  - Seams: 0.
- **Residuals:**
  - The self-setting reload happens far above the view.
  - The leaf is anchored top right rather than Brown's top left, because the arm's retracted tip sweeps the top left.

## 266: handle joint
- **Cause.** The grip touched the arm only edge-on, which made a sliver joint.
- **Change.** The arm now ends in a round eye (r 0.12, 0.16 long). The grip moved 0.06 inboard so that its inner end runs fully into the eye.
- **Validation report:** `docs/validation/260-266-275-thread-solids.json` was regenerated with `POSES=33` to keep the pose count; only the hash changed.
- **Captures:** `C/266-before-zoom.png`, `C/266-after-zoom.png`, `C/266-after-tile.png`.
- **Tests:** movement-266 and differential-thread-solids pass.
- **Screens:** clear; 0 detached parts.

## 271: pawls in the rack plane
- **Change.** Each pawl is one flat plate: a bored boss, a constant-width bar, a circular elbow and a short finger. The separate beam, hook and axial shoulder, and their depth offsets, are gone.
  - **Plane:** both pawls lie inside the rack slab (z 0.04–0.24). The lever moved forward to 0.245–0.445, with 0.005 running clearance.
  - **Tip:** its working face lies along the vertical tooth face and its underside along the 29.7° ramp, with a 0.015 nose seated in the root. Before, the tip stopped 0.04 below the crest.
  - **Seating:** each pickup first slides the dropped hook down the ramp into the root, then pulls. The resetting hook rides up the ramp.
- **Captures:** `D/t271.png`, `D/zt271.png`.
- **Tests:** movement-271 and ratchet-bar-finite-contact pass 15/15. They now assert one mesh per pawl, in the rack slab, with the nose in the root when pulling.
- **Screens:**
  - Intersections: clear.
  - Disconnected parts: 0 detached. Near-misses went from 5 to 9; the new ones are running clearances of the pins and plates in front of the fixed bearing ring and post.
  - Seams: 0.
- **Residual:** in oblique views the rack's front face hides the lower toe.

## 284: hook tip angle
- **Change.** Only `CLAW_RISE`, from 16° to 19.6°. The outline is untouched.
- **Result.** Over every pull, the claw edge now sits 0.17–1.55° under the tooth face (was 3.8–5.2°), and never steeper. The claw point stays 0.003 from the pocket corner. The gap cannot close, because the two rotate about different centres.
- **Captures:** `D/zb284.png` (before), `D/ta284.png`, `D/za284.png`.
- **Tests:** movement-284 passes 8/8. The "about 16°" assertion is replaced by an edge-angle check over every pull.
- **Screens:** unchanged from HEAD.

## 320: click phasing and seating
- **Cause.** The ratchet was phased so that a tooth tip stood under the click through the whole going phase. The click sat on a crest and never held p from a root (`D/zb320.png`).
- **Change** (`seatClickAndRatchet`, 320 only):
  - **Ratchet at p:** 10 teeth. The steep faces run along the click's swing, undercut 10°, and a root sits at Brown's click angle at every locked angle.
  - **Click:** one flat bored plate whose toe fits the valley.
  - **Rest angle:** the exact outline contact, baked into the 320-p entry of `baked/maintaining-clock-clicks.js` (513 knots). The 321 entries are byte-identical.
  - **Backlash:** each winding carries p 0.05 rad past the seat, and p settles back onto the click by phase 0.05. From 0.05 to 0.5 the click is seated in the root and its working face bears on the tooth face.
- **Captures:** `D/ta320.png`, `D/za320.png`, `D/zn320.png`.
- **Tests:** the 320 parts of movement-320, maintaining-clock-interfaces and maintaining-clock-bake pass. The two 321-only failures come from another lane's in-progress edits to `authored-going-barrels.js`.
- **Screens:**
  - Intersections: clear, but they need `--max-old-space-size=12000`, as at HEAD.
  - Seams: 0 (the 0.1355 period mismatch predates the pass).
- **Residuals:**
  - The settle is a rendered offset on p alone; the chain does not show the matching take-up.
  - Brown's click spring is not modelled.

## Integrated test run
- **Command:** the 25 targeted test files for this lane's IDs, run together: authored-loader, plate-escapements, free-escapement-solids, the maintaining-clock tests and every 209/217/218/223/224/238/239/247/266/271/284/320 file (`/dev/shm/p86/p86-3/tests-all.log`).
- **Result:** 153 of 155 pass.
- **Failures:** the two are both 321-only, "changed geometry needs rebaking" and "321/R non-converging follower jump". They come from another lane's uncommitted edits to `authored-going-barrels.js`, not from this lane.
