# Pass 107, lane a: 081, 227, 270, 458 and 302

Reviewer: Claude Opus 5.5, lane p107-a, 2026-09-29. Working tree at `0d259c4`, served by vite on :46131. No git writes were made.

Scratch captures are in `/dev/shm/p107/a/`:
- `b<ID>-*.png` are before; `a<ID>-*.png` are after.
- `m<ID>.png` and `n<ID>.png` are montages with the plate (`public/engravings/mm_<ID>.png`).

The coordinator relayed two user directions during the pass. They override the brief for 081 and 227:
1. Where Brown draws square racks and pinions, use proper ideal involute pinions with trapezoidal rack teeth.
2. 227's chain is formed with pins, not single bent pieces.

## 270: one model for Brown's two views (fixed)

- **Plate.** Brown draws one rope pulley on a six-roller bearing twice:
  - on the left, assembled, with a cover showing six pin holes and a fluted journal end;
  - on the right, opened, showing the six rollers round the journal.

  The model built both figures side by side: two pulleys, two ropes and two return sheaves.
- **Change** (`bearing-working-parts.js`, `mergeAssembledView` replaces `addAssembledView`).
  - There is now one pulley and one rope. The assembled figure's parts are added to the working cutaway, in the shared see-through style:
    - The pulley face is one creased lathe section on the pulley rotor. It runs from the web out to the rim and is lipped in over the rollers to Brown's cover circle (63 px).
    - The retainer cover is on the roller carrier and turns at cage speed. Its six holes (6 px) sit over the retainer pins at the roller centres. The pins now end 0.012 below the cover face, so their ends are Brown's centre dots.
    - The fluted journal end is on the fixed journal.
  - The roller hubs are 0.52 long, down from 0.55, so the cover clears them by 0.01.
  - The hub bores are now 0.0625, so they are not coincident with the roller bores. Seen through the cover, that coincidence was flagged.
  - `bearingInterpretation.consolidatedView` was rewritten. A 270 entry was added to `src/data/source-presentation.js` (note only).
- **Captures:**
  - `n270.png`: plate, default, phase 0.3, close-up, pitch 25.
  - `a270-*.png`: ±40° yaw, side, back.

  The rollers read through the cover and face, the pin dots sit in the cover holes, and the rope runs anticlockwise.
- **Tests.**
  - `tests/movement-270.test.mjs`: 9 pass. The last test now asserts:
    - one pulley rim (plus the rope's lower return sheave) and one rope;
    - no assembled-figure group;
    - the cover rides on the carrier and the face on the pulley, both see-through;
    - the cover clears the hubs and rollers;
    - the pins end recessed in the cover holes.

    The plate-bore check was also corrected. It now compares in scaled units, because the new presentation entry updates the world matrices.
  - `bearing-working-solids`: 5 pass. `source-presentation` and `rotation-indicator`: pass.
- **Screens.**
  - Coincident faces: 0 flagged.
  - Disconnected parts: no detached parts. The 39 near-misses are bearing running clearances and the pin-in-hole clearance of 0.046.
  - Body intersections: 0.0000, open 0.
  - Loop seams: clean.
  - `display-profiles.js` was re-measured. The 270 bounds shrank from x −6.27 to x −2.08.

## 458: pour in full view (fixed)

- **Plate and finding.**
  - Before, each raised bucket hung turned half round and tipped away from the viewer. Its pour left the far lip, behind the bucket (`m458b.png`).
  - The stream also ended in mid-air. Only a 0.40 kerb strip stood beside the well, but Brown's ground runs out to the plate's edges.
- **Change.**
  - `authored-two-bucket-well-pulleys.js`:
    - While the operator draws the bucket aside, he also turns it a quarter turn on the rope. Its yaw is π − side·(π/2)·aside, back to π as it swings home.
    - The bucket therefore tips outward in the view plane, away from the well. The pour leaves the outer lip in full view and falls in open air outside the post.
    - The bail hang offset turns with the bucket.
    - The bucket body stays within |z| ≤ 0.43, clear of the post's front face (z −0.50).
    - At rest and during the exchange the bail still faces the viewer, as drawn.
  - Each ground bank now runs from the kerb (|x| 1.66) out to |x| 2.95. The pour lands on its top.
- **Captures:**
  - `n458.png`: plate and phases 0.29, 0.35, 0.38, 0.46.
  - `n458b.png`: ±40° yaw, side, top, the left bucket's pour, close-up.
- **Tests.**
  - `tests/movement-458.test.mjs`: 11 pass.
    - The hang test now checks the yaw law, and checks that a bucket tips only when fully aside.
    - A new test checks, over 401 samples, that each visible pour lands on its bank top and stays in the view plane (|z| < 0.1).
  - `p106-f3-fixes` and `well-bucket-interfaces`: pass.
- **Screens.**
  - Coincident faces: 0.
  - Disconnected parts: the 9 near-misses are the known pulley spokes and hanger.
  - Body intersections: 0.0448 at the ear hinges (bail against rim torus). This is the known "bail touches the rim at its ear hinges".
  - `display-profiles.js` was re-measured. The sustained visible rate is now 2.26, from the yaw turn.

## 227: Brown's plate width and a pinned chain (fixed)

- **Width.** On the plate the flat links measure 32 px across on a 69 px pitch (top link) and 28 on 73 (hanging links), a ratio of 0.39–0.46. The model had 0.24 on 1.035 (0.23).
  - `authored-belts.js`: `plateLinkEndRadius` went from 0.12 to 0.21, a ratio of 0.41.
  - The analytic sprocket profile (`cleanSprocketProfile227`) is derived from that radius, so its notches regenerate to hug the broader plate ends. No swept profile file is involved.
- **Pins (user direction).** `chain-drive-working-parts.js`: `pinnedOuterLinkGeometry227` replaces the one-piece bent loop. Each link across a tooth is now a real pin-chain outer link:
  - two narrow round-ended side bars, one each side of the pulley plane at ±0.15;
  - a pin (r 0.042) at each joint, through the flat plate's eye (r 0.048);
  - a domed rivet head (r 0.061) outside each bar.
  - The tooth enters between the bars, which leave a half-gap of 0.12 against the tooth's 0.075. This is the "different planes, spaces left for the teeth" of the caption.
  - The bars are narrow, as Brown draws the strips across the teeth and between the hanging plates. So each broad plate shows a rivet head at each end, as on the plate.
  - The pins are closed solids with their ends embedded 0.004 in the bars. The role is now `pinned-outer-link-side-plates-across-tooth`.
- **Captures:**
  - `n227.png`: plate, default, top close-up, tooth close-up, +40°.
  - `n227b.png`: side, pitch 25, phase 0.3, −40°.
- **Tests.**
  - `tests/movement-227.test.mjs`: 7 pass. The plate width / pitch test is new. The orthogonal-planes test now asserts the pinned outer link: its profile, role, pin clearance in the eye, head over the eye, and tooth gap.
  - `tests/chain-drive-working-parts.test.mjs`: 10 pass.
    - This includes the finite wheel/link sweep clearance over a turn and the engaged-flank work test.
    - The triangle budget holds: 36,000 triangles, against the 50,000 limit.
- **Screens.**
  - Coincident faces: 0.
  - Disconnected parts: 0 detached, 0 near-miss, 0 slivers.
  - Body intersections: 0.0000, open 0.
  - Loop seams: clean.
  - `display-profiles.js` was re-measured for 227.

## 081: kept as an involute pinion with a trapezoidal rack (user rule); rod stub forced

- **Tooth form.** Per the user's direction, Brown's square teeth are properly rendered as an ideal involute segment meshing a trapezoidal involute rack. The model already has exactly that:
  - a 10° rack with straight flanks and 22 px flat tops;
  - a conjugate involute segment on 16 divisions;
  - contact ratio 1.10, tip width 11 px;
  - 7 rack teeth and 6 segment teeth, the counts lane f2 verified on the plate.

  So the tooth-form residual ("narrower than Brown's square teeth") is withdrawn, and the geometry is unchanged.
- **Square-tooth study (not adopted).**
  - Before the user's direction arrived, I built true square teeth and re-integrated the finite-contact dynamics.
  - Square teeth on 16 divisions jam: the contact runs at radius about 1.1 against the 0.958 pitch radius, and the next tooth closes on the rack.
  - On 18 divisions (22/22 px) they worked, with a ±10 % lift-speed ripple at each tooth change.
  - It was all reverted per the user's rule. No trace remains in `src/` or `scripts/`.
- **Rod stub (forced, with numbers).** The rod must still pass through the upper plate at its lowest (rest) position. At Brown's gear angle, the settled cycle has lifted the rack by 1.58 (4.2 pitches) from rest, so the stub stands about 1.65 above the plate against Brown's px(10) = 0.07.
  - A pairing scan varied the undrawn rest height. At Brown's gear angle, only rack heights 0.376 apart are available, and every one is the same 1.58–1.65 above its own rest.
  - The only lower branch needs a rest of −1.27 or less. That puts the lowest rack tooth into the lower guide (clearance about 1.07 below Brown's pose).
  - Brown's pose is mid-lift: his lower gear teeth have not yet reached the rack, and his upper ones have already passed it. So the stub is forced unless one of these is accepted:
    - (a) the rod top drops out of the upper plate into the spring at rest;
    - (b) the default frame departs from Brown's gear angle by about 45°.

  Neither was adopted.
- **Captures:** `m81.png` (before), `m81z.png` (plate teeth against the model's involute mesh). The model is unchanged.
- **Tests.** `tests/spring-rack.test.mjs`: 7 pass (unchanged files).

## 302: pinion proportions (fixed; a deferred low)

- **Plate.** Brown's lower pinion is small and nearly square in elevation: raster 53 px across by 43 px high, with fine leaves. A pointed pivot hangs below it (raster 485–501). The model had the inherited squat 8-leaf escape pinion, 1.36 across by 0.46 high. The arbor ended inside its dark hub.
- **Change** (`authored-escapements.js`, only in `sidewaysBalanceWheelCrownEscapement`; 234, 238 and 299–301 are untouched).
  - The drive pinion body is rebuilt with the shared involute `makeGear`: 12 leaves, 0.80 across and 0.645 high, at Brown's height. The dark hub is hidden.
  - The crown arbor runs on through the pinion to z −3.1, and a dark pointed pivot runs to Brown's point (z −3.29).
  - The role is now `coaxial-lower-twelve-leaf-drive-pinion`.
- **Captures:**
  - `n302.png`: plate, default, plate crop, close-up, rotated.
  - `n302b.png`: pivot close-ups.
- **Tests.** `tests/movement-302.test.mjs` (9, one new: 12 leaves, height/width within 0.05 of 43/53, arbor through the pinion, pivot present) and `plate-escapements` pass.
- **Screens.**
  - Coincident faces: 21 pairs, all pre-existing (crown band against saw teeth, as at p106).
  - Body intersections: 0.0000.
  - The pinion extrude is reported open. `makeGear`'s extrusion was reported open at HEAD too, so this is pre-existing.
  - `display-profiles.js` was re-measured for 302.

## Deferred

- **102/103/111 thread fins.** The thread visuals live in `mujoco-screw`, `mujoco-leadscrew-slide` and `mujoco-micrometer`. Their `visual.js` is a hashed motion source of the MuJoCo bakes, so the change needs three rebakes. That is out of this lane's budget.
- **104 worm-wheel normals.** These are in `mujoco-worm-saddle/geometry.js`. The basename `geometry.js` is claimed by p107-b.

## Full suite

`tests/models.test.mjs`: 163 pass (rerun after the last change). The 13 targeted suites: 98 pass.
