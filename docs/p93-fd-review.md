# Pass 93 lane p93-fd: fixes for audit 256–340

- **Reviewer:** Claude Opus 5.5, lane p93-fd. Sub-lanes B, C1, C2, D1 and D2 were forks; lane A (309–312) was the primary. Date: 2026-09-28.
- **Audit:** docs/p93-audit-256-340.md.
- **Captures:** /dev/shm/p93/fd/<lane>/.
- **Git:** none.

## 312 (high), 310 (medium), 311 (low): `authored-gravity-escapements.js` (lane p93-fd)

### 312: Bloxam
- **Direction (high): fixed.** The plate's arrow sits above the arbor and points right, so the wheel turns clockwise. The model used to turn counter-clockwise.
  - The kinematic core now takes a `wheelSpin = -1` sign, which is used for the tooth angles, the 10° small-wheel face lag, the tooth indexing (now a generic `toothIndexAt`), the 2° tooth-face slope, the detent sector (which reaches ahead of the lock in the new sense) and the engagement lead corner.
  - Before flipping the sign, I checked that `wheelSpin = +1` reproduced the old model exactly: the plate fingerprint `a6377cfad1b0f14e` and the full geometry-and-pose hash were unchanged.
  - With `wheelSpin = -1`, A is lifted from the bottom of the small wheel, under the arbor, where Brown's band runs. B is lifted from the top, where his hook returns.
  - As a result, each pallet face now sits next to its own fork pin: E is low on the left and F is high on the right. Before, each face sat across the arbor from its pin.
  - The lock stations (20° and 160°), the 40′ lifts, the 20°-per-beat steps and the equal gravity impulses are unchanged.
- **Suspension (high): fixed.** One fixed stud at C (`fixed-stud-C-carrying-both-arms-and-pendulum`) now carries both arm eyes and the pendulum. It used to live in the removed support frame, so it was invisible and the pendulum hung from nothing.
  - The pendulum rod and its eye are now one plate: a round boss r 0.2, bored for the stud, with the rod leaving it tangentially. No box end pokes into a ring any more.
- **Pendulum depth (medium): partly fixed; the rest is forced.**
  - Fork pins E and F sit 0.48 and 0.59 from the arbor, inside the large wheel's spokes (r 0.19–1.62). A pendulum behind the wheels would need pins crossing the spinning spokes, so it can't go behind.
  - Instead, the pendulum moved from z 0.88 to 0.55, just in front of the small wheel's arbor end. The rod takes the shared see-through style (`makeSeeThrough`), so the pinion and pallets read through it, as Brown's dashed line implies.
  - The fork pins now run from inside their arms to just past the rod. Their old rear stubs, flush with the arm faces, flickered.
- **Plates:** rebaked with `node scripts/generate-gravity-escapement-plates.mjs 312`. The new `inputHash` is `523adcfd532efda4`.
- **Tests:**
  - I updated `tests/movement-312.test.mjs` for the clockwise sense: spin, face lag, tooth indices, the lift sides (the top/bottom asymmetry now swaps, with 40.46′ on B and 38.00′ on A), monotonic decrease and closure at −360°. It passes 9/9.
  - gravity-escapement-working-solids (6) and sliver-joints-p86-7 pass.
- **Screens:**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips.
  - Intersections: 0.
  - Seams: 0.
  - Coincident faces: the two arm/pivot-eye pairs at contrast 0.006 were there before (the fork-pin pairs are gone).
- **Captures:** `/dev/shm/p93/fd/A/312/tile.png`, `A/312-sheet.png` and `A/312-sheet2.png` (hub, C and back zooms).
- **Not fixed (low):** I disagree with part of this finding. The arms are already flat plate extrusions (0.15 × 0.10), not tubes; only the role name says "tubular". The 9-blade pallet wheel is Bloxam's nine-tooth wheel. Brown's pin-wheel look and the U-bend of the A–E band stay open.
- **Proposed ledger:** assessment minor. visibleFlaws: "The pendulum hangs in front of the wheels (see-through), where Brown dashes it behind; pins E and F lie inside the spokes, so it cannot go behind." Replace limits with: "Straight spokes with T-heads approximate Brown's stops. Motion is prescribed. p93: turns clockwise with Brown's arrow; A lifted from the small wheel's bottom and B from its top; one fixed stud at C carries both arms and the pendulum's bored boss; the pendulum is see-through, 0.55 in front."

### 310: single three-legged gravity escapement
- **Top suspension clutter: fixed.**
  - The grey 4.7-long crossbar is replaced by Brown's hatched block. It is 1.38 wide, one rounded extrusion, carries both leg arbors in bored seats, and has his two screw heads.
  - The two blue "adjustment bars", with their pin screws, are replaced by Brown's horns: each leg's top runs out as a flat bar that rises slightly and tapers to a round end at raster x 67, in the leg's own plate.
  - The 1.79-long suspension pin is gone. A solid suspension block, Brown's upper rectangle, stands on the pivot block and reaches forward to just behind the pendulum eye, so the stud is 0.27 long.
- **Fly (low): fixed.** The crossarm and two vanes are replaced by one long plain blade seen edge-on, as on 311. It has Brown's 105 px reach (2.26), stands vertical at t = 0, and sits behind the wheel with its pins clear.
- **Plates:** rebaked for 310 (`inputHash 81510b6999cd98f5`). Tests: movement-310 passes 12/12, with the flyVanes count now 0.
- **Screens:**
  - Intersections: 0.
  - Lips: 0.
  - Seams: 0.
  - Coincident faces: 0.
  - Detached: the one existing 0.0425 near-miss (a lock tip against arm B while running) is unchanged from the audit.
- **Captures:** `A/310/tile.png`, `A/310-sheet.png`.
- **Proposed ledger:** reasonable, visibleFlaws empty. Append to limits: "p93: Brown's pivot block with two screws and his suspension block replace the long crossbar, bearing bars and 1.79 pin; each leg carries its horn; the fly is one long edge-on blade."

### 311 (low): suspension clutter and rod top
- **Crossbar and pin: fixed.** The 2.5-long crossbar and the 1.74 pin are replaced by Brown's hatched suspension block: 1.29 wide, centred on the suspension, and reaching forward to just behind the eye. The stud is now 0.27 long.
- **Rod top: fixed.** The rod and eye are one bored plate (boss r 0.25), so no box end pokes through the ring.
- **Plates:** rebaked (`inputHash` updated). Tests: movement-311 and working-solids pass.
- **Screens:**
  - Disconnected parts: 0 detached.
  - Intersections: 0.
  - Coincident faces: 0.
  - Seams: 0.
- **Captures:** `A/311/tile.png`, `A/311-sheet.png`.
- **Proposed ledger:** unchanged (reasonable). Append to limits: "p93: Brown's hatched suspension block replaces the crossbar and long pin; the rod ends in a bored boss."

### 309: unchanged
- 309 keeps its full hash (`fp 3837c46befa2f9dd`). Its long-stud low stays documented, because a cock would be an undrawn part.

### Deferred
- The 312 `source-presentation.js` note ("The pendulum is only a dashed line …") should now read "the pendulum hangs from stud C in front of the wheels, see-through". That file is owned by p93-fe.

# p93-fd-B: escapements 298, 303, 306, 307, 308

Claimed (p93/claims, owner p93-fd-B): authored-geared-balance-verge.js, authored-deadbeat-escapements.js, authored-three-legged-escapements.js, authored-detached-escapements.js. No shared helper was edited. No saved report or bake fingerprints these files, so there was nothing to regenerate. Captures are in /dev/shm/p93/fd/B/ (NNN/tile.png plus the aimed quads listed below).

Catalog-wide tests: camera-catalog, opening-camera-motion and authored-loader pass (5/5).

Screens (298, 303, 306, 307 and 308):
- Coincident faces: 0 flagged pairs in every ID.
- Body intersections: worst solid overlap is 0.0000 in every ID.
- Loop seams: 0.
- Disconnected parts, against the audit baseline:
  - 298: unchanged at 32 near-miss pairs.
  - 303: near-miss pairs went from 1 to 0, and the one detached component is unchanged.
  - 306: unchanged.
  - 307: unchanged. The 3 short-of-pin entries are the pins against the fixed arbor. The pins are not meant to reach it; each is buried in its own leg.
  - 308: short-of-pin went from 2 to 1. The floating cock/pendulum split is pre-existing: the suspension lies outside the plate. The new near-miss between the Q arm and head (0.07) is a gap in depth; the Q hub mesh joins the two plates.

## 298 (medium): crown teeth
- **Verified.** The plate draws square crenellations with rounded tops. The model had thin pointed 20° trapezoids 0.14 deep radially.
- **Fix:**
  - Each crown tooth is now one extrusion of a round-topped section. The flanks are near parallel, with an 8° draft, and a full tangent arc closes the tip.
  - The half width is 0.072 at the pitch line.
  - The tooth runs 0.24 radially, where it was 0.14.
  - Backlash comes from the draft and the tip arc; the involute pinion is unchanged.
- **Width limit.** A wider tooth jams against the involute pinion: a half width of 0.085 penetrated by 0.0078, and 0.075 by 0.0002. So the tooth covers about 0.34 of the pitch at the pitch line and 0.45 at the root, against Brown's roughly 0.5.
- **Low finding:** the spokes are now broad flat bars (0.34 × 0.12). The hub is a rim-coloured collar of r 0.5 on the staff, where there was a black nub.
- **Removed:** the unused `parametricSolid`.
- **Tests:** movement-298 passes 8/8. There is a new crenellation test, and the clearance test was also re-run at 480 phases with 0 penetration.
- **Captures:** `B/298-quad.png` (after z1–z3, and the before z1), `B/298/tile.png`.
- **Ledger:**
  - assessment: minor
  - visibleFlaws: "crown teeth about 0.34 pitch wide at the pitch line (Brown ~0.5), limited by clearance with the involute pinion"
  - limits (append): "p93: crown teeth are round-topped crenellation extrusions (8° draft, tangent tip arc, 0.24 radial); balance has flat spokes and a hub collar."

## 303 (medium): pendulum strap eye
- **Verified.** The strap's square top butted against the end of the arbor.
- **Fix.** The strap is now one extrusion: a 0.12 × 0.14 bar ending in a round eye (r 0.24) concentric with the pallet arbor. The arbor enters the eye and ends 0.01 inside its back face. The existing p89 test still holds.
- **Low finding:** the "slot" on the hub rim was the corner of the 3-sided `triangular-anchor-apex-cap` prism poking through the baked hub boss. That cap is removed.
- **Left open (low):** pallet E's faceted tip notch. It is part of the baked swept-envelope outline (`baked/graham-303-anchor.js`), and rebuilding it means regenerating that envelope.
- **Tests:** movement-303 passes 10/10, including a new eye test.
- **Captures:** `B/303-quad.png` (after z1–z3, and the before z2).
- **Ledger:**
  - assessment: minor
  - visibleFlaws: "pallet E tip keeps a small faceted notch from the baked envelope"
  - limits (append): "p93: pendulum strap ends in a round eye concentric with the pallet arbor; apex cap removed."

## 306 (low): cheek ends
- **Fix.** Both pendulum-rod strips are now single stadium extrusions with round ends, carried 0.1 further past the plate than before. They were square boxes.
- **Tests:** movement-306 and pin-escapement-working-solids pass.
- **Capture:** `B/306/tile.png`.
- **Ledger:** limits (append): "p93: rod strips have round ends."

## 307 (medium): impulse pins
- **Plate check.** Brown's three crescents at the leg roots are these pins seen end on, so pins pointing backward are right (Beckett's design). The flaw was their shape.
- **Fix.** Each pin is now a circular segment: the chord runs from the working edge (r 0.36, the outermost and most clockwise point, kept exactly) and the shallow arc is 80°. The whole segment lies within the leg outline.
  - It runs from the impulse plane right through the leg and stands 0.012 proud of the leg's front face, so the front face shows Brown's crescents.
  - The wedge corners that overhung the leg and read as debris from behind are gone.
- **Low finding:** the hub bore and leg hole clearance went from 0.005 to 0.0015, which closes the light crescent at the arbor.
- **Tests:** movement-307 passes, including a new crescent test. three-leg-dead-rest, pin-escapement-working-solids and movement-306 pass, 30 in total.
- **Captures:** `B/307-quad.png` (front, back with the plate hidden, front oblique), `B/307/tile.png`.
- **Ledger:**
  - assessment: reasonable, if the reviewer agrees
  - visibleFlaws: none
  - limits (append): "p93: impulse pins are circular-segment (crescent) pins through the leg roots, showing as Brown's crescents on the face."

## 308 (medium): bell crank Q; low: P arm tops
- **Verified.** Q was thin gold rods with a round black lock pin reaching back into the wheel plane, which is an undrawn protrusion.
- **Fix.** Q is now Brown's broad bell crank on one stud, built from two plates joined by one bored hub:
  - The arm plate (lever plane, 0.10–0.17) tapers from 0.108 at the eye to 0.063 at boss Q. It must pass in front of the wheel, because its line crosses the wheel 26 px from the centre.
  - The head plate lies in the wheel's own plane (−0.03 to 0.03). It is a broad bar running left from the pivot and turning down into a tapered hook, whose rounded end locks the tooth tip.
  - The rear lock pin is gone.
- **Kinematics.** The Q-lift clearance now tests the whole hook, as a union of discs, and the clearance angle requires the whole hook to be clear of the tip circle. The arm clearance against click C covers the tapered arm from half its length.
- **Residual.** The hook locks at the tooth tip (about 116°, as the old pin did), not at the deeper position Brown sketches (about 44°, r ≈ 32 px). A hook that deep cannot leave the tip circle within Q's 16° lift. This is documented in `reconstructionNote`.
- **Low finding:** each P band's top now ends in a round cap concentric with the band's centre line. The bottoms keep their slanted cut: a cap there bulged, because the band is strongly inclined.
- **Tests:** movement-308 passes 5/5. The pin gap is now the hook-polygon gap: minimum 0.0020 hook, 0.0007 nib, 0.0020 click. A role and plane test was added: the head lies in the wheel plane and there is no lock pin.
- **Captures:** `B/308-quad.png` (front, oblique, back, and phase 0.2 lifted), `B/308/tile.png`.
- **Ledger:**
  - assessment: minor
  - visibleFlaws: "Q's hook locks at the tooth tip rather than Brown's deeper sketched position"
  - limits (replace the lock-pin wording): "p93: Q is a broad two-plate bell crank on one hub (arm in front of the wheel, hooked head in the wheel plane); no rear lock pin. P tops rounded."

## Deferred
- 303 pallet E tip facet: needs the envelope regenerated (`scripts/generate-graham-303-anchor.mjs`). Low.
- 298 crown tooth width: to reach half a pitch, the pinion would need rebuilding as a non-involute pin or lantern pinion.

## Sub-lane p93-fd-C1: 261, 270, 272

**Files claimed** (in /dev/shm/p93/claims): `authored-combination-drives.js`, `authored-bearings.js` (not edited in the end), `bearing-working-parts.js`, `authored-beveled-cams.js`.

**Captures:** `/dev/shm/p93/fd/C1/<id>/tile.png` shows the plate beside nine views. The zooms are:
- `261-zG.png`
- `270-z.png`: right front, right back, left cover, left oblique.
- `272-z.png`

**Screens** (`/dev/shm/p93/fd/C1/{disc,cf,bi,bi272}.json`, plus `seams.log`):
- Disconnected parts: 0 detached, 0 slivers and 0 lips in 261, 270 and 272. 261 has 4 near-misses and 270 has 27; all are working clearances.
- Coincident faces: 0 flagged pairs in 270 and 272. 261 has one pair: the disk-B hub against the crank arm, at 5e-5 relative area. That is below the filter and predates this change; the new bracket is not involved.
- Body intersections: worst solid overlap 0.0000 in all three.
- Loop seams: 0.

### 261: wall pivot G (medium), fixed
- **Plate check.** Brown draws G as a small eye on a flange bracket at the wall. The model had a 0.91-long black stand-off pin on a thin grey box.
- **Fix.** The box "bearing arm" is replaced by one extruded wall bracket: a flange seated in the wall, a lug, and a round eye (r 0.27, against the pin's r 0.18) concentric with G. It runs from inside the wall up to 0.02 behind arm A.
  - The wall upright now runs forward to z 0.5, just behind A's plane. So the bracket is 0.32 deep instead of a peg crossing 0.9 of open space.
  - G is now a 0.42 pin running from inside the eye through A, standing 0.05 proud.
  - The two zero-size joint spheres on the disk bearing arm are removed. The top arm that carried the other two spheres is gone.
- **Tests.** movement-261 passes 10/10. The new test checks the bracket eye, its seating in the wall, the short pin, and that no degenerate meshes remain.
- **Proposed ledger row.**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, append: "p93: G is carried by a short flange-and-eye wall bracket; the wall upright is deepened to just behind arm A's plane (inferred depth)."

### 270: rear plate and cover holes fixed; lower pulleys kept (I disagree with the auditor)
- **Rear retaining plate, fixed.** The plate lies wholly behind the turning web (plate z −0.365 to −0.285, web rear face at −0.23). It now runs from r 0.512, just clear of the fixed journal, to r 1.50, past the 1.40 bore. Front and back views no longer show the cream annulus or roller crescents (`270-z.png`, top row).
- **Cover holes (low), fixed.** The six holes in the left cover are now blind. A backing disc closes them, and a dark retainer-pin end sits in each hole, which is Brown's centre dot (`270-z.png`, bottom row).
- **Lower pulleys, not removed.** I disagree with the auditor here:
  - An earlier user review required 270 to turn continuously anticlockwise, as Brown's arrow shows (p91).
  - A rope ending in weights cannot follow continuous rotation. It would have to reverse, which breaks the arrow rule, or run away without end.
  - So the endless rope with its lower return sheaves stays. It sits about 9 units below the plate's crop and outside the default camera fit.
  - If the user prefers weights with an oscillating pulley, that is a separate decision.
- **250 unchanged.** Its geometry, transform and visibility hash, sampled at four times, is `6869837e…1f39` both before and after (`hash-before.txt`, `hash-after.txt`).
- **Tests.**
  - movement-270 passes 9/9, including a new test that the plate lies behind the web, spans the bore, and has a blind cover with 6 pin ends.
  - bearing-working-solids passes 4/4.
- **Proposed ledger row.**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, append: "p93: the rear retaining plate closes the bearing behind the rollers, and the left cover's holes are blind with pin ends. The endless rope's lower return sheaves are kept, below Brown's crop, because the pulley must turn continuously anticlockwise with the arrow."

### 272: flat output bar, square guides, thicker shaft, one collar (medium and low), fixed
- **Plate measurements** (disk about 280 px tall):
  - the bar is about 26 px across;
  - the shaft is 22 px;
  - the collar is 65 px across and 18 px long, behind the disk only.
- **Fix.**
  - **Bar.** The round rod and its separate dome are now one flat bar, 0.40 wide in the drawn plane and 0.30 deep. Its lower face is the same 0.6 sphere clipped to the bar's section, so the solved contact is unchanged. The contact wanders up to 0.127 across the depth (measured), which the 0.15 half-depth covers.
  - **Guides.** The round collars are replaced by two square block guides: rectangular frames with 0.2 blocks above and below the bar, a 0.025 running clearance, and the same stations.
  - **Shaft and collar.** The shaft radius goes from 0.13 to 0.16. The rear collar goes from r 0.34 × 0.36 long to r 0.46 × 0.30. The front collar is removed.
- **Screens.** No solid overlap and no detached parts.
- **Tests.** movement-272 passes 8/8. Its asserts now cover the flat bar with the crowned end, the square guides and the single collar; the mesh count is 9.
- **Proposed ledger row.**
  - assessment: reasonable
  - visibleFlaws: ""
  - limits, replace: "The shaft axis and guides are ideal fixed constraints; the output is Brown's flat bar in two square guide blocks, and its crowned end (0.6 sphere) bears on the chamfer. The bar's 0.30 depth is inferred from the contact's travel across it."

### Deferred
- None for file ownership.
- **Validation reports.** None fingerprint these files; I grepped docs/validation and baked.
- **Display profiles.** I measured them into `/dev/shm/p93/fd/C1/display-profiles.json`, a scratch copy; the shared file is not written.
  - 270: unchanged.
  - 261: only a float-noise change in `motionBounds.min.z`.
  - 272: `motionBounds` goes from x −4.141 to −4.198 and y 4.136 to 4.197, from the wider bar corners; the speeds are unchanged.
  - If the camera-catalog test flags them, run `node scripts/measure-display-profiles.mjs 261 272` centrally. The camera-catalog check restricted to 261, 270 and 272 passes. The full run failed on some other movement; the first failure is not in my IDs. That run was also under parallel load.

# p93-fd-C2: 277, 283, 284

Claimed (in /dev/shm/p93/claims): authored-colt-ratchets.js, authored-rack-pumps.js, authored-saw-feeds.js. No shared helper was edited: `rack-pinion-parts.js` is untouched (283 passes a local pressure angle through the helper's existing parameter, and 284 no longer imports it). Captures are in /dev/shm/p93/fd/C2/.

## 283 (medium): rack/pinion teeth and counts, plus the low bedplate-feet finding
- **Verified against the plate:** Brown draws about 16 square-looking pinion teeth and 12–13 teeth per rack. The model had 18 teeth and 16 per rack, with 25° V-ish rack teeth.
- **Fix:**
  - The pinion now has 16 teeth.
  - The pressure angle is 20° on both parts, passed through the existing `pressureAngle` option. There is no undercut: the 0.10 addendum is under r·sin²α = 0.112.
  - The rack teeth now have a broad top land (about 0.115 on a 0.375 pitch) and read as crenellations.
  - Each rack has 13 teeth. The odd count keeps a tooth on y=0 at the reference pose.
  - Travel is 8 pitches per half-turn, and the mesh margin is 2.5 pitches or more.
  - The bedplate feet moved from x ±3.3 to ±3.78, under the slab ends as Brown draws them.
- **Captures:** `283-z3.png` (mesh at phases 0 and 0.2, oblique) and `283/tile.png`.
- **Tests:** movement-283 passes 10/10. The count and stroke asserts are updated (16, 13, 8 pitches), and the margin is now asserted as more than 2.4 pitches.
- **Screens:**
  - Intersections: worst 0.0000.
  - Disconnected parts: 0 detached. Near-misses fell from 45 to 37. The 2 lips (the bearing bridge and the handle) are unchanged from before.
  - Coincident faces: 0.
  - Seams: 0.
- **Ledger:** assessment reasonable; visibleFlaws "". Append to limits: "p93: 16-tooth 20° involute pinion and 13-tooth flat-land racks (Brown ≈16 and 12–13); bedplate feet under the slab ends."

## 284 (medium): square rack teeth and conjugate pinion, plus the low click and fulcrum-lug findings
- **Verified against the plate:** the rack has ⊓⊔ teeth. Teeth and gaps are about equal, a third of a pitch deep, with flat lands and roots. The click is a round eye (about 12 px) with a finger bowed out to the left.
- **Rack and pinion fix:**
  - The rack teeth are now a local near-square profile: flanks 12° off square, 0.08 addendum, 0.09 dedendum, flat land and root, 0.006 backlash.
  - The 8-tooth pinion is generated in `generatedPinionOutline` as the rolling envelope of that rack (321 roll positions, x = −rθ). It is exactly conjugate, undercut included.
  - `rack-pinion-parts.js` is no longer imported by this file.
- **Click fix:** the click is one plate with a 12 px eye and a finger bowed by two arcs. Its seated tip is unchanged, and the contact solver still seats it.
- **Pin and boss:**
  - The click pin stands in a new round boss on the post face (`click-pin-boss-on-left-post`, r 10 px, concentric with the pin).
  - The pin itself is now short, where before it ran bare back to the post.
- **Fulcrum lug:** fulcrum bracket a is one tapered lug, a hull of an r16 circle on the post face and an r11 boss about a. This replaces the box-plus-circle; the sliver flag (neck 0.50) is gone.
- **Captures:** `284-z3.png` (front mesh, click and boss oblique, back-oblique mesh) and `284/tile.png`.
- **Tests:** movement-284 passes 8/8 unchanged, covering click and catch gaps ≥ 0, feed and loop closure.
- **Screens:**
  - Intersections: worst 0.0003 rack tooth × pinion. This is the envelope's discrete-sweep scallop at the working contact.
  - Disconnected parts: 0 detached, 0 slivers (was 1). Near-misses fell from 34 to 16.
  - Coincident faces: 0.
  - Seams: 0.
- **Ledger:** assessment minor (the existing 4 px slider-drop flaw remains). visibleFlaws unchanged. Append to limits: "p93: rack teeth are Brown's near-square crenellations (12° flanks) and the 8-tooth pinion is generated as the rack's rolling envelope; the click is an eyed, bowed plate on a short pin in a round post boss; fulcrum a is one tapered lug."

## 277 (medium): mainspring anchor, plus the low block-c, axle and notch findings
- **Mainspring root:** the root was not modelled; it ended in air. The leaf now ends in a small round-ended fixed clamp stud (`fixed-mainspring-root-clamp-stud`, r 0.18, clasping the last 0.10 of the leaf, where the cantilever is flat). Brown's break is beyond it.
- **Block c:** the outer edge is one ideal circular arc, fitted to the ink within 1.4 px (centre (127.65, 199.67), r 71.44 px). It has 65 samples with creased smooth normals, where before it was a 10-point polyline.
- **Tumbler arbor:** the radius went from 0.23 to 0.285, Brown's hatched circle (26 px). The lock-plate bore is 0.29.
- **Notches:** two sharp cocking notches are cut into the tumbler's lower-left outline, below and above dog a's eye, at Brown's positions.
- **Captures:** `277-b.png` (before), `277-a.png` (after: arbor and notch, block c, clamp front and back) and `277/tile.png`.
- **Tests:** movement-277 passes 9/9.
- **Screens:**
  - Intersections: 0.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips.
  - Coincident faces: 0.
  - Seams: 0.
- **Residual:** the model's hammer pivot is at plate (301, 394). Brown's hatched arbor centre is at about (302, 375), 19 px higher. Moving it would re-derive the dog and ratchet kinematics, so it is recorded rather than changed.
- **Ledger:** assessment minor (the dog-tip flaw remains). visibleFlaws: keep the dog-a text and add "The tumbler arbor sits 19 px below Brown's hatched circle (kinematic pivot kept)." In limits, replace "The mainspring root beyond Brown's break is not modelled." with "p93: the mainspring root is a small fixed clamp stud past Brown's break; block c's edge is an ideal arc; the arbor is Brown's 26 px radius; the two cocking notches are cut."

## Other checks
- The camera-catalog test passes.
- No saved report or bake fingerprints these files; the only other reference, in docs/movement-status.json, is not a fingerprint. Nothing needed regenerating.

## Deferred
None.

# p93-fd-D1: 321, 324 (+325), 326 (327 unchanged)

Reviewer: Claude Opus 5.5, sub-lane p93-fd-D1. Claimed: authored-going-barrels.js, authored-compound-parallel-rulers.js, authored-steam-engine-guides.js. No saved validation report or bake fingerprints these files.
Captures: `/dev/shm/p93/fd/D1/NNN/tile.png` (plate + 9 views) and the zooms named below.

## 321 (medium): maintaining spring S–S′
- **Verified.** On the plate, S–S′ is one curved wire in the wheels' plane that crosses over B. The model's wire sat at z 1.16, in front of everything. It hung on a 0.96 yellow post and a 1.5 blue post with a box arm (the "L-bracket"), and it cast no shadow.
- **Fix.**
  - **Layering.** B's small ratchet and click R now sit directly in front of the larger ratchet, with 0.02 clearance (world z 0.115–0.275; they were at 0.71–0.87). R's journal is shortened to match. B's plain face is a thin raised disc (0.275–0.325).
  - **Wire.** It lies in a plane at z 0.375, just in front of B's face (0.015 clear), so it crosses over B as Brown draws it. Its shape, constant material length and hairpin depth are unchanged.
  - **S.** A short stud (r 0.09) on the larger ratchet's face.
  - **S′.** A short pin hanging from a flat, round-ended arm on G. G's post (0.68 long, was 1.5) rises through the existing arc slot in the ratchet ring. An arm is still needed: a stud outside the ratchet's rim would strike click T.
  - **Removed.** The yellow S post, and the box arm (the arm is now a capsule extrusion whose ends are concentric with the post and with S′).
  - **Shadow.** The wire casts a shadow.
  - **Low finding, arbor.** The arbor no longer projects 0.8 in front of B. It ends inside a 0.34 winding square that stands 0.05 proud of B's face.
  - Arm-end radius 0.10 against pin radius 0.09, which removes a coincident-cylinder flicker the screen found.
- **Captures:** `D1/321/tile.png`, `D1/321z-quad.png` (front, oblique, winding, side).
- **Tests:** movement-321 passes 11/11 (models.test 163/163 and camera-catalog pass for the lane). It gains a new test for the plane, the short studs, the shadow and the winding square. maintaining-clock-bake and maintaining-clock-interfaces pass.
- **Screens:**
  - Intersections: worst solid 0.0000.
  - Coincident faces: 0 pairs after the arm fix.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. There are 16 near-misses, all running clearances between the new layers.
  - Seams: 0.
- **Ledger:**
  - Assessment: minor.
  - visibleFlaws: "The hairpin's bottom is a tight bend where Brown draws a rounder loop. S′ is carried on a short arm from a post through a slot in the larger ratchet, which Brown doesn't draw."
  - Limits (append): "Pass 93: B's small ratchet and click R sit just in front of the larger ratchet. The spring lies at z 0.375, just over B's face, on short studs, and casts a shadow. S′ is on a short capsule arm from G's post, which passes through the ratchet's arc slot; an S′ stud outside the ratchet rim would strike T. The arbor ends in a winding square flush with B."

## 324 (medium) + 325 (low): parallel-ruler joints
- **Verified.** The arms were at y 0.35 and 0.49 on 0.74-tall pins, with the washers at 0.60 floating clear of the eyes. The pin shafts were r 0.066–0.074 in 0.09 bores, and the slider pins were loose in the slots (r 0.066 in r 0.15).
- **Fix** (a shared pin builder in the claimed file):
  - Shaft r 0.087 in the 0.09 bores.
  - The washer rests on the top arm's eye, with the head on the washer.
  - **324.** The lower arm lies on the rulers (0.005 clearance). The upper arm lies on the lower arm at the crossing (0.005). At its ends, the upper arm's eyes sit on spacer collars (r 0.13).
  - **Slider pins.** Each wears a shoe that fills the slot (r 0.144 in r 0.15).
  - **Centre pivot.** A lower head under the lower arm.
  - **325.** Both arms lie on the rulers at y 0.16.
  - The slot capsule ends use 48 samples, which clears the 4.5° faceting flag.
- **Captures:** `D1/324/tile.png`, `D1/325/tile.png`, `D1/324-325z.png` (edge and joint zooms).
- **Tests:** movement-324 and movement-325 pass 16/16. drawing-ruler-solids passes.
- **Screens:**
  - Intersections: 0.
  - Coincident faces: 0.
  - Disconnected parts:
    - 324: 7 detached / 21 near-miss before, now 0 / 8.
    - 325: 7 / 20 before, now 0 / 4.
    - The remaining near-misses are head-to-eye (0.029) and shaft-in-slot pairs, all running clearances.
  - Faceting: 0.
  - Seams: 0.
- **Ledger:**
  - 324: reasonable, visibleFlaws empty. Limits (append): "Pass 93: arms laid on the rulers and on each other, spacer collars under the raised eyes, slot shoes, pins fitted to the bores, and washers seated."
  - 325: reasonable if no other open item, visibleFlaws empty. Limits (append): "Pass 93: both arms lie on the rulers; pins fitted and washers seated."

## 326 (medium): open standard, and the piston rod behind
- **Verified.**
  - The hollow standard was open at the top, so raised views looked down onto the crosshead.
  - A yellow rod hung behind the back plate from a rear bridge and ended in air.
  - Brown's plate shows lines continuing below A inside the slot.
- **Fix.**
  - **Crank.** It dips 0.39 below the standard's top edge, and a cap at the top edge would need a slot as wide as the cap. A crank in front of the skin would put the shaft through the rod plane (tried, and the screen measured a 0.146 shaft/rod intersection). So a recessed cap sits inside the walls just below the crank's sweep (top y −1.06, 0.065 below the crank boss). Its outline is the walls' own inner outline.
  - **Cap coverage.** It spans from the back plate to 0.04 behind the rod plane, leaving a 0.265 transverse slot for the connecting rod. A test checks that the crank clears the cap at 64 phases.
  - **Piston rod.** A round rod (r 0.07) now runs down from the crosshead bridge inside the hollow, where it shows through the window below A as Brown's lines do. It enters a bore in the foot. The foot is deepened (bottom y −6.93, was −6.08) so the rod's end stays hidden through the stroke. Brown crops the foot at the plate edge. The rear bridge is removed.
  - **Walls.** They have no floor band; the foot is the floor.
  - **Low finding, flare facets.** The shoulder is now a cubic tangent to the straight taper. The old quadratic met the taper with a 15.3° kink. The new cubic keeps the old end tangent and is at most 0.004 narrower anywhere, so the rod still clears the walls. It is sampled at 48 points.
- **327:** unchanged. The geometry hash across 4 phases is identical to HEAD: `91b1feedbf075783` before and after.
- **Captures:** `D1/326/tile.png`, `D1/326z-quad.png` (top, oblique, back, window).
- **Tests:**
  - movement-326 and movement-327 pass 17/17. The hollow-standard test is rewritten: recessed cap, slot, crank clearance, and a rod inside the standard with a hidden end.
  - engine-guide-solids passes 5/5; its 326 piston-rod test is rewritten for the inside rod.
  - engines-326-345-clearance passes.
- **Screens:**
  - Intersections: worst solid 0.0000.
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 0 slivers, 0 lips. There are 42 near-misses, all slide/guide and bore clearances; the audit baseline was 41.
  - Faceting: only the pillow block's deliberate 15° chamfer remains.
  - Seams: 0.
- **Ledger:**
  - Assessment: minor.
  - visibleFlaws: "Raised views show a shallow recess above the cap (the crank dips below the standard's top edge), and the foot is deeper than Brown's cropped base."
  - Limits (append): "Pass 93: a recessed cap closes the hollow standard below the crank's sweep, leaving a narrow slot for the connecting rod. The round piston rod runs inside the standard into a bore in the deepened foot. The rear bridge is removed. The shoulder flare is a tangent cubic."

## Deferred / not done
- 321: Brown's hairpin loop is rounder than the model's tight bend. The bend law is tested, and a gentler angular easing broke the wire's smooth-flex test, so it was left as is.
- 326: the pillow block's 15° chamfer is flagged by the faceting screen but is deliberate.

## Sub-lane p93-fd-D2: 331, 332, 336, 339

**Claimed files** (under /dev/shm/p93/claims):
- `authored-slotted-crosshead-engines.js`
- `authored-marine-parallel-motions.js` (shared by 332, 333 and 336)
- `authored-direct-action-parallel-motions.js` (shared by 339, 340 and 341)
- `piston-guide-329-331-parts.js` (shared by 329 and 331)

**Sibling proof.** Each movement's geometry was hashed from the working tree, and again from a copy of the tree with only these four files reverted to HEAD. The hash covers every mesh's role, world matrix, vertex attributes, visibility, castShadow and userData keys, at two phases. The script is `/dev/shm/p93/fd/D2/hash.mjs`.
- Unchanged: 329 `37eddf365bcfa481`, 333 `265b519c10a878db`, 340 `b7e1dc33eed3e474` and 341 `903a9202c9e36d7d`.
- Changed: 331, 332, 336 and 339.

**Captures.** Before and after tiles are in `/dev/shm/p93/fd/D2/{before,after}/NNN/tile.png`. The zooms are:
- `/dev/shm/p93/fd/D2/332-zoom.png`
- `/dev/shm/p93/fd/D2/336-zoom.png`
- `/dev/shm/p93/fd/D2/339-zoom.png`

**Screens** (IDs 329, 331–333, 336, 339–341):
- Disconnected parts: 0 detached, 0 slivers, 0 lips. Near-misses:
  - 331: 27 (was 39).
  - 332: 4, all bore or running clearances.
  - 336: 1.
  - 339: 18, unchanged.
- Coincident faces: only 331's existing pair (area 1.7e-5) and 329's, both below the filter.
- Body intersections: worst solid 0 everywhere.
- Faceting: 0 on 331, 332, 336 and 339. Before, 336 scored 27.5 and 339 scored 20.8. The 333 and 341 flags are pre-existing and in untouched code.
- Loop seams: 0.

**No saved reports or bakes** fingerprint these files.

**Camera tests:** camera-catalog and opening-camera-motion pass 2/2. The targeted movement tests for 329, 331, 332, 333, 336, 339, 340 and 341, plus piston-guide-329-331-solids, pass 72/72.

### 331 (medium): fixed
- **Plate check.** The shaft is the right circle in slot A: the flywheel centre lies at plate x≈200 and the dashed hub circle is round it. The wrist pin is the left circle. The auditor is right.
- **Default pose.** `stateAtTime` now adds a half turn (`plateStartCrankAngle = π`, with `sourceAnimation.plateStartPhaseOffset = 0.5`), so t=0 puts the pin left of the shaft, as in the plate. The canonical times follow: left 0, bottom ¼, right ½, top ¾. The official keyframes are still checked, at their offset phases.
- **Shadows.**
  - Only two meshes actually lacked shadows in the browser: the barrel and the bottom cover. The other nine the audit listed read the raw model.
  - The barrel's role contained "steam", which matches shadow-policy's FLUID regex. It was renamed `closed-cylinder-barrel-enclosing-piston-stroke`.
  - Both meshes were flagged `cameraFitGuide`, which also exempts shadows. They now use `excludeFromCameraFit`, which `finishPistonGuides` honours. 329 is unaffected, as the hash shows. The browser probe now finds no shadowless opaque mesh.
- **Low, spokes.** The flywheel now has four spokes, horizontal and vertical. The ±60° spokes that read as a second set of braces are gone. Caveat: Brown shows only the horizontal pair, and the upper vertical spoke now shows between the crossbeam and the crosshead, where his plate has none.
- **Low, pillars.** Pillars D and the crossbase legs now run down to the cylinder's bottom cover, so nothing stops in mid-air. The default framing grows slightly: the fit's minimum y goes from −4.70 to −4.82.
- **Tests.** movement-331 has been updated for the 4 spokes, the plate-phase keyframes and the unwrapped-turn delta. movement-332's cross-check of 331's spoke count went from 6 to 4. movement-331 and piston-guide-329-331-solids pass 13/13.
- **Proposed ledger row.** Assessment: minor. visibleFlaws: "The upper vertical flywheel spoke shows between the crossbeam and crosshead; Brown draws only the horizontal pair." Limits, append: "t=0 is the plate pose, half a turn after the official animation's start. The pillars and legs run on to the inferred cylinder's bottom cover."

### 332 (medium): fixed
- **Gooseneck F.** The bracket had to span z −0.365 to 0.78 because the radius bar sat in front of everything, at z 0.91.
  - The radius bar F–C now runs just behind the links, with its plane at z 0.195, 0.005 behind the left link.
  - The gooseneck is now 0.20 deep, from z −0.09 to 0.11, in F's plane. It stands on a short foot, 0.19 deep and 0.28·s tall, that laps back onto the lid flange.
  - Pin F is now short: 0.03 to 0.315.
  - The gooseneck arc now has 48 segments; the new thin outline had tripped the faceting screen.
- **Low, rib.** The centre web is now 0.14 wide with a rounded (elliptic) top, 0.035 proud. It runs from boss A into the end boss.
- **Tests.** In movement-332, C's z is now read from the anchor instead of the hard-coded 0.91. It passes 8/8.
- **Not done (low).** The invented piston rod and the E arm behind the link plane are still there.
- **Proposed ledger row.** Assessment: minor. visibleFlaws: "The orange arm from E back to the inferred piston rod reads as undrawn in the side views." Limits, replace the gooseneck text with: "F's gooseneck is a 0.2-deep plate in F's plane on a short foot lapping the lid; the radius bar runs behind the links."

### 336 (medium): fixed
- The lever outline at O is now the convex hull of the strap ends and a 0.72·s waist, joined to Brown's round boss. The boss is 1.05·s, about 2.8× the shaft radius, concentric with O, and stands clear of both flanks. The old 5-corner polygon widening is gone, and faceting went from 27.5 to 0.
- The shaft now stands 0.12 proud of the lever face (was 0.07).
- Tests: movement-336 passes.
- Proposed ledger row: assessment reasonable, unless other open items remain in the row; visibleFlaws empty. Limits: none.

### 339 (medium): fixed
- The casting's two flanks and the arm's concave underside are now centripetal Catmull-Rom splines through the same measured stations, with 48–64 samples each. Only the bearing seat and the arm's box corners stay sharp. Faceting went from 20.8 to 0.
- 340 and 341 are byte-identical.
- Tests: movement-339 passes 8/8.
- Proposed ledger row: assessment reasonable (if nothing else is open); visibleFlaws empty.

### 333 (low, castShadow): not a defect
The browser probe after `applyShadowPolicy` shows every opaque mesh, including the frame blocks under the lugs, casting a shadow. The audit read the raw model. No change was made.

### Deferred
- 332: the E arm and the invented piston rod (low; this needs the vessel axis moved into the link plane).
- 331: optionally drop the vertical spoke pair, making the flywheel two-armed as drawn.
- A side note for other lanes: shadow-policy's FLUID regex also matches any role containing "steam", "jet" and similar words. Solid parts named that way silently lose their shadows.

