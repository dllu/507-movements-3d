# Pass-51 wave-3 lane w3b: escapements and maintaining power (290–321)

Scope: 290, 291, 292, 294, 295, 296, 297, 299, 300, 301, 302, 304, 305, 307,
309, 310, 313, 314, 319, 320, 321. Captures were taken with
`scripts/review-movement-source-views.mjs` on a private non-watching dev server
(before and after, default and oblique views, inspected). Intersections are
from `scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`
(registry model, no source presentation); for the changed contacts a finer
time scan was also run.

## Changes

| ID | Change | Worst non-seated solid depth before → after |
| --- | --- | --- |
| 290 | Tooth front flanks hook forward (root trails the tip by 0.06 pitch, as Brown's hooked points), so B's recoil face no longer cuts the tooth behind its tip at full recoil. | 0.026 → none (also none on a 129-step fine scan) |
| 291 | Stop d rises with A at its own station (lift × progress²) and is 0.29 tall, seated 0.01 under A; light spring f moved in front of A (z 0.43–0.55); stud i stands on A's upper edge. | stop d/A 0.14 → 0.024 (seat); f/A 0.05 → 0. Working stud a/hook k 0.104, notch g/hook k 0.055 and tooth/notch g 0.046 remain. |
| 292 | Default view cropped to Brown's close-up (F at top, rim arc and pallets, hub at the bottom edge). Studs are triangular prisms inscribed in the stud circle the pallet faces were cut for, apex leading. | none → none |
| 297 | Arm A, its pivot hub, arbor and pallet mounts are drawn as dashed hidden-line outlines (meshes kept, not rendered); pallets B and C stay solid. Presentation also removes the rear plate and bearings that showed once the hub was hidden. | none → none |
| 301 | View cropped a little above the arbor as Brown breaks the wheels; ground hidden. | none → none |
| 302 | Ground shadow hidden. | none → none |
| 305 | Presentation removes the pendulum index stripe and the disc index tick. | none → none |
| 310 | Pendulum rod rendered as a dashed centre line as Brown draws it (solid rod kept as the invisible working body); gravity plates rebaked (fingerprint only; plate outlines unchanged). | none → none |
| 313 | Detent spring D ends at the pipe carrying T (0.20 outside the lock point) and bows outward past the wheel's widest point; the detent body starts there too. Bank E stands behind the wheel plane with a longer heel; unlocking jewel V radius 0.105 → 0.085. | tooth/detent 0.093 → 0 ; tooth/E 0.050 → 0 ; V/passing spring 0.031 → 0.011 ; tooth/P landing 0.019 unchanged |
| 314 | Pallet C and carrier moved to the rear half of the wheel plane; lever raised to z 0.18–0.46 in front of the wheel with a short locking nib of A in the wheel plane; lever hub/arbor start in front of C and run to a front journal. | 0.119 → 0.037 (tooth/C during prescribed impulse, pre-existing; a finer scan shows up to ≈0.08) |
| 319 | Timing-screw stems start on the outer face of the brass arm layer instead of running through the arm roots. | 0.093 → 0.049 (steel arm root seated in the bar end) |
| 320 | Undrawn demonstration handle ring removed (it threaded the chain); weight W lowered 0.03 clear of pulley L's flange. | 0.051 (deforming) → none |
| 321 | Maintaining spring re-shaped (inner tangent 2.60, handle 2.70) so it loops ≥ 0.33 clear of the axis instead of passing through arbor B; G's decorative face ring and white index bar removed. | 0.139 → 0.034 (adjacent spring segments at bends) |

## Per-ID visual verdicts and residuals

- 290: matches the plate layout; pallets A/B read as small lugs on carriers
  rather than Brown's square notches.
- 291: close to the plate; the working stud a/hook k contact still overlaps
  while the detent is held at full lift (prescribed lift law).
- 292: close-up now matches Brown's framing; studs read as small triangular
  blades; handoff and timing prescribed.
- 294, 295, 296, 299, 300, 304, 307: unchanged; see ledger notes. 295 remains a
  one-cylinder, one-wheel reading of Brown's superposed composite.
- 297: arm A now reads as a dashed hidden member, as drawn; pallets float in
  front of the disc on the dashed arm.
- 301: cropped like the plate; the spacer still reads as a dark drum.
- 302: no ground; crown still coarser than Brown's.
- 305: no white index marks.
- 309: Brown's omitted pendulum rod is already removed by presentation (the
  ledger claim that it is drawn in front is stale).
- 310: the rod is now dashed; the lyre legs are curved (the ledger claim of
  straight bars is stale). Stops D/E remain mostly cut away by the swept plates.
- 313: detent now stands outside the tooth circle as in Brown.
- 314: lever lies in front of the wheel as Brown draws B across the teeth;
  B's lock is shown in front of the teeth only (its long curved face swings
  deep into the wheel while A locks, so it cannot have an in-plane nib).
  A small grey front journal ring marks the lever pivot.
- 319: unchanged appearance; screws sit on the bar ends.
- 320: no handle; weights clear.
- 321: spring loops left of B as drawn.

## Files

Production: `src/simulation/authored-annular-escapements.js`,
`authored-free-escapements.js`, `authored-stud-escapements.js`,
`authored-lantern-escapements.js`, `authored-escapements.js` (299–302 only),
`authored-gravity-escapements.js` (310 builder only),
`baked/gravity-escapement-plates.js` (regenerated, 310 entry),
`authored-lever-chronometers.js`, `authored-compensation-balances.js`,
`authored-maintaining-power.js`, `authored-going-barrels.js`,
`src/data/source-presentation.js` (297, 305 entries).
Tests: `tests/annular-stud-working-solids.test.mjs` (292 crop framing check),
`tests/debaufre-300-301-working-solids.test.mjs` (301 fit distance 27 → 19.5).
