# Pass 62, lane p62-supports-a: supports, rod ends and residuals

Reviewer: Claude Opus 5.5 (lane p62-supports-a), 2026-09-26.

Captures come from a private Vite server on port 44602 and are not committed.
Each tile shows the plate, the default view at two phases, the view rotated
+60 and -60 degrees, the back view and a far oblique view. The tiles are in
`/dev/shm/p62-supports-a/tiles/<ID>-{a,b}.png`:

- `a`: before this pass
- `b`: after this pass

The rule applied is the pass-60 rule: keep a support only if Brown draws it
or it explains a fixed pivot, and keep it minimal. A rod that runs past
Brown's break continues straight and ends cleanly. Fixed shafts that Brown
draws without a bearing end as plain stubs.

## Changes

| ID | Change | Files |
|---|---|---|
| 48, 52, 53 | Brown draws each fulcrum only as a pin through the bell crank, so the undrawn wall flange and its long shank are removed. The fixed pin ends as a short capped stub behind the lever. Framing is unchanged because each model has an authored fit box. | `jaw-clutch.js`, `pin-clutch.js`, `reversing-clutch.js` |
| 75 | Rod C runs 1.0 further, straight, and ends in the same rounded end below the view at every phase. The exported profile is stretched only in its lower end, so the kinematic foot and the tests are unchanged. The fit box is pinned to the former sampled box, so framing is unchanged. | `reciprocating-pawl.js` |
| 146 | The unmounted fixed front bearing is replaced by the disk's own hub, at Brown's measured radii (centre circles of radius 22.5 and 42.5 px, giving 0.44 and 0.84). The shaft ends as a plain stub in front of the hub. | `framed-yoke.js` |
| 156 | Removed the guide channel, rails, standoffs, arms, post, base, crosshead and slider pin. Also removed the unmounted disk and pivot bearings; the axles are now stubs. The rod runs 1.2 past its ideally guided lower joint and ends in a plain rounded end below the view. The presentation `remove` entry is dropped. | `slotted-elbow.js`, `source-presentation.js` (156), `tests/slotted-elbow-motion.test.mjs` |
| 159 | Removed the pulley post, the rear mounting pad and the rear bearing. The pulley axle is a stub. Rebaked; the motion samples, bounds and closure are unchanged. | `mujoco-cord-treadle/solids.js`, `baked/assets/159.*` |
| 160 | Removed the posts under the bow's end block and under the pulley, the pulley pad and the pulley bearing. The pulley axle is a stub. The small end block stays as the bow's clamped end. Rebaked. | `mujoco-spring-return-treadle/solids.js`, `baked/assets/160.*` |
| 142 | Removed the guide rail, the two-post stand, the bridges, the cross-arm, the stud's rear post and rear bearing, and the slider shoe, guide-bar lug and pin. The rod runs 1.5 past its ideally guided joint, which keeps its end below the plate edge even at the joint's highest point (y -1.92 against -3.2). The fixed stud ends as a stub. Re-exported the asset and regenerated `docs/validation/142-clearance.json`, which shows no overlaps. | `silk-traverse-geometry.js`, `baked/silk-traverse.js`, `scripts/bake-silk-traverse.mjs`, `source-presentation.js` (142), `tests/silk-traverse-model.test.mjs` |
| 163 | The driving drum past the crop now turns on a plain upright shaft (radius 0.1, as the spindle), which ends 0.5 beyond the drum at each end. No bearing is added. | `baked/belt-governor.js`, `tests/belt-governor-baked.test.mjs` |
| 166 | Removed the undrawn brick mould, its pin, bed and guides. The caption names the mould, but Brown does not draw it. The rod runs 1.2 past its ideally guided output point, so it leaves the default view at every phase and ends cleanly. | `lost-motion-brick-press.js` |
| 185 | Removed the diagonal tie bar, the rockshaft boss, and the eccentric shaft's front and rear bearings and flange. The rockshaft and the shaft end as stubs. | `authored-locomotive-valve-gears.js` |
| 219 | The pinion shaft is 8.7 long instead of 4.1; its inner end is unchanged. The fit box now includes the shaft's end. The undrawn footstep and standard are no longer built by the factory (the presentation `remove` entry is dropped), so the authored fit is used directly. The shaft end now lies about 0.99 crown widths right of the crown centre, against Brown's 1.02. | `authored-eccentric-crown-gears.js`, `source-presentation.js` (219) |

## Residuals kept, and why they are forced

- **93**: when the yoke is below the shaft, the plain upper stem passes in
  front of the hub. The depth order is correct and nothing interpenetrates:
  the hub stops at z 0.18 and the stem starts at z 0.21. An upper loop like
  the lower one would contradict Brown's plain upper rod at the plate pose.
  Proposed as a limit, not a flaw.
- **195**: the tooth spaces stay scalloped. They are the sweep envelope of
  the worm across the face. Square radial slots that clear the thread over
  the engagement arc would span about 77% of the pitch, the inverse of
  Brown's narrow notches. See `docs/feed-worm-195-207-finite-review.md`.
- **198**: the light stripe is the main frame's slot for the fixed pinion
  shaft, seen through the carrier's opening. Brown draws this capsule slot
  inside the rack ring, and it is white on the plate. The slot is needed:
  a front shaft would cross the front strap's path. Proposed as faithful.
- **208**: the slots stay open at both ends. The engaged pins span
  -0.082 to +0.40 along the shaft at the slot mouths, so a closed end would
  lie in a neighbouring pin ring's path. The existing limit states this.
- **188**: the valve arm must carry the gab pin from below. Brown's plate is
  cropped just under the rod, but the square default view is centred on the
  mechanism, so the arm shows. A horizontal valve spindle hidden behind the
  rod would be an undrawn guided part and would break the 186-189 family
  construction. Proposed as a limit.
- **185**: Brown's rocker pedestal on its horizontal frame line is not
  reproduced. Behind the rocker, the link sweeps the rockshaft axis (the
  sampled check hits the link rails, the upper rod pin and the lifting lug).
  In the free front layer, the lifting rod (z 0.47 to 0.74) crosses the
  line. So no pedestal can reach the line without interpenetration.
- **159**: the cord still goes slack. Keeping it taut would put the foot
  133 px below the floor (`docs/movement-159.md`), so slack is forced by
  Brown's proportions. The slack shape is a length-preserving illustration
  with a wide bow, up to 1.23 of slack.
- **160**: the bow's small end block stays as its clamped end. It is not
  drawn by Brown, but it is small and explains the fixed end.

## Checks

Intersection screens (`show-body-intersections`, spacing 0.01, 129 samples):

- 48: only a coaxial 0.002 pin-in-bore running clearance, as before.
- 52, 53, 219: none.
- 75: only the coaxial rod pin in its bar bore, depth 0.0000.
- 185: only the moving joint-adjacent link and pin pairs recorded before
  (the largest is 0.062). This pass only removed fixed parts, so it adds no
  pairs.

The screener uses the synchronous registry factories, so 142, 146, 156,
159, 160, 163 and 166 were checked separately:

- 142: `docs/validation/142-clearance.json` regenerated; no overlaps.
- 219: `docs/validation/219-224-414-contact.json` rerun for 219 with
  `IDS=219`: 0 inside and 0 penetration over 17 poses.
- The other added geometry cannot meet other parts:
  - The 146 hub sits on the disk front face, away from the rear yoke and
    clear of the wrist radius.
  - The 156 and 166 rod run-ons lie past the disk and the lever.
  - The 163 drum shaft is coaxial inside the drum.
