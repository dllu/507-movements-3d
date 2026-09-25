# Pass 53: no hidden-line notation (lane p53-no-hidden-lines)

Rule 1 of pass 53 says that renders contain no engraving notation. Brown dashes
a part only because paper cannot show an occluded part, and he dots paths,
construction circles, axes and second poses to explain the motion. The 3D model
shows the parts themselves, so every dashed or dotted stand-in has been removed.
Where the notation represented a real hidden part, that part is now drawn
solid and appears when the view is rotated.

## Method

- Search: `grep -rnE "hidden-ink-lines|hiddenLineMaterial|LineDashedMaterial|dashSize|dashed|dotted" src/simulation src/data`. I also searched roles and names for
  `dot|dash|witness|orbit|construction|path|pitch-circle`, looked for mesh-built
  dash loops (`dashCount`, `dashedBeam`, `pathDashes`), and searched the baked
  bundles for `Line*` objects.
- I judged each hit by what it renders. Comments that say where Brown dashes
  something are left in place. Ruled water strokes (`ruled-water-lines`) are
  water texture, not hidden-line notation, and remain.
- Captures come from a private non-watching Vite server:
  `review-movement-source-views.mjs` default and oblique views, plus a
  scratch rear view at (-7, 3, -10) for 94/221/261/279/281/297. The images
  are in `/dev/shm/p1/{before,after}`.
- Intersections come from
  `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=65`,
  run on the IDs whose visible geometry grew (221, 297, 310).

## Changes per movement

| ID | Removed notation | Real part now shown | Notes |
|---|---|---|---|
| 94 | Ink dashes tracing the spiral groove over the opaque slotted plate (`hidden-groove-dashes` and its per-frame update) | The grooved spiral plate behind shows through the radial slots and from behind | MuJoCo visual note updated |
| 142 | Dotted circle (LineSegments at r = 1.58) on the carrier disk | No hidden part; the circle was notation | `silk-traverse-geometry.js` changed; rebaked with `scripts/bake-silk-traverse.mjs` (the provenance is updated) |
| 166 | Dashed crank-pin orbit (`constructionOrbit`) | none | |
| 168, 169 | Dashed slot-pin and auxiliary-pin orbits | none | The production `variable-radius-crank.js` and `linked-variable-crank.js` |
| 172 | Dashed egg trajectory (`nonphysical-trajectory-witness`) | none | The tracer point remains |
| 175 | Dashed crank orbit (`nonphysical-crank-orbit-witness`) | none | |
| 221 | Dashed groove g-h edges. The real grooved plate had been hidden (`visible = false`) | The guide g-h is now a real, visible open channel: an elliptical band carried by three spokes from D's hub, with the outer and inner rails behind it, in front of C | See the 221 residual |
| 261 | Dashed drum circle on B's face and the dashed drum-side strand of D | The real drum (behind B, turning with B) and the cord to its tangent. Both are visible from a rotated or rear view | `hidden-ink-lines` import removed |
| 279 | Dashed hidden edges of the crank throw and shaft | The throw and shaft solids that already existed | |
| 281 | Dashed rear-arm edge and the dashed lever at its other extreme | The real rear driving arm behind the disk | Presentation note updated |
| 297 | Dashed EdgesGeometry outlines that replaced arm A, its hub, arbor and pallet mounts (the real parts had been hidden) | The real arm A, hub, arbor and mounts | See the 297 residual |
| 310 | Dashed pendulum-rod centre line (the real rod had been hidden) | The real pendulum rod | |
| 369 | 24 dash cylinders tracing the bob's cycloidal path | none (the curve remains in `userData.bobPath` as data) | |
| 405 | Dashed transverse and focal axes | none | Presentation note updated |
| 408 | Brown's inset construction (circle, dashed rays, working lines), the construction arc through the pins, and the dotted-line-equivalent pin chord | none | The pins, legs and blade are unchanged |
| 411 | Dotted isosceles construction triangle (`dashedBeam`) | none | `constructionApex` is kept as geometry data |
| 421 | Dotted crank-pin circle | none | Presentation note updated |
| 423 | Dotted circle round D | none | See the 423 residual. Presentation note updated |
| 424 | Solid torus that stood in for the dotted wrist path round b | none | Presentation note updated |
| 473 | Rope-coloured ring standing for the dotted external water line | The translucent tub's water shows the level | Presentation note updated |

`src/simulation/hidden-ink-lines.js` is deleted. After 261 and the 63 lane's
own change, nothing imports it. Movement 63's code was not touched.

No file under `src/` references `LineDashedMaterial` any more.

## Intersections (worst depth before → after)

- 221: before, 4 bodies with the guide plate hidden. After, 4 bodies with the
  now-visible band, rails, spokes and hub included. No pairs in either case
  (65 samples at 0.01).
- 297: 2 bodies, no pairs, with the arm now visible.
- 310: 5 bodies, no pairs, with the rod now visible.
- The other IDs only lost non-solid lines or notation meshes, so their
  intersection rows are unchanged.

## Residuals (honest)

- **221**: Brown dashes g-h because it lies behind C. In the reconstruction
  the guide cannot sit behind C, because B's 32-tooth wheel (tip radius about
  1.04) sweeps over shaft D (the closest approach from D to B's centre is
  about 0.91). The channel therefore lies in front of C, as it already did
  when hidden. It is now drawn as a slim grey open band on three spokes. The
  default view shows C's face and teeth through it, but the band covers B's
  pinion hub and the end of the arm.
- **297**: Brown dashes arm A behind the disc. In the reconstruction the
  pallets work on trundle ends that stand in front of the front disc, so the
  real arm lies in front. The default view now shows the arm solid, where
  Brown dashes it.
- **310**: The real pendulum rod is now drawn solid in front of the wheel,
  where Brown dashes it.
- **423**: Brown's dotted circle round D may be a flywheel behind the casing.
  No flywheel is modelled, and the open section has no back wall that would
  hide one.
- 411 and 408 lost their construction figures. The default framing still
  leaves the empty space those figures occupied, so both display profiles
  need re-measuring.

## Candidates left for later passes (not dashed rendering)

- 178: accent-coloured centre-line and stroke witnesses. They are solid
  witnesses, not dashed ones.
- 411: `ground-travel-index-*` marks on the ground.
- Translucent faces used to reveal hidden parts: `gravity-tumbler.js` (face
  E) and `authored-intermittent-core.js` near line 2650.
- `authored-gears-core.js` 142 study markers (review-only; production 142 is
  baked) and the authored review-only 168/169 witness tori in
  `authored-variable-cranks.js`.

## Validation

- Regenerated with identical results; only the source hashes changed:
  `docs/validation/221-222-223-contact.json`, `142-clearance.json`,
  `166-solid-clearance.json`, `168-solid-clearance.json`,
  `169-solid-clearance.json`, `172-clearance.json`,
  `175-assembly-clearance.json`, `175-oracle.json` and
  `175-source-fit.json`.
- The browser reports (`16x/17x-browser.json`) were not rerun and are not
  hash-tested.
