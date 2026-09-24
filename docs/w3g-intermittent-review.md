# Pass-51 wave-3 lane w3g: intermittent residuals

Movements 63, 70, 71, 73, 206, 211, 213, 214, 215, 233 and 237. Each route
was captured with `scripts/review-movement-source-views.mjs` beside its
engraving before and after the changes. Intersections were screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

| Movement | Change | Worst overlap before → after |
| --- | --- | --- |
| 63 | The spring's two straight box leaves and their joint spheres are now one continuous flat leaf (rectangular section, 0.075 × 0.095) bent through its deflected middle, so there is no leaf-to-leaf joint. Its drawn end stops 0.03 below the attachment point, against the tail's underside. | leaf × leaf 0.0121, joint spheres 0.0024, leaf on drop 0.0021 → none |
| 73 | B is a flat band of rectangular section, 0.12 wide along D's rim and narrowing to the pad's width where it turns in to the teeth. C is a flat band too. Both stop at their round tip pads instead of running into the pad centres. The hatched block is 6 × 6: it runs out of the view to the left and below, so only its corner shows, as in the plate. `cameraFitBounds` keeps the previous framing. | spring × pad welds 0.0397 / 0.0329 → none |
| 206 | The wheel has 53 teeth, 0.27 deep (root 2.11), where it had 44 teeth 0.30 deep. The right pawl bears on tooth offset −16 at face fraction 0.2, within 0.07° of the engraved contact angle. The right reset swing is 0.15. The lever swings 6.9° each way, down from 8.45°, because each vibration now advances one finer tooth. The resetting fingers clear by at least 0.0006 (left) and 0.0035 (right). Both drive forces stay within 60° of the face normal (worst alignment −0.51). | zero-depth working contact → none |
| 215 | The generator now also relieves the slot mouth beside the convex terminal sector along the pin's real entry path. The entry rows are solved against the first slot and shared by all indexes, and that slot's mouth is different. The other slots and the solved rows are unchanged. | pin × slot mouth 0.0015 → none (zero-depth lock contact only) |
| 233 | The wheel is broken off below with an irregular line, about 0.7 R under the centre, as Brown draws it. Plates, rims and trundles discard fragments below a world-fixed wavy line (`applyWorldBreakBelow`), so the break stays put while the wheel turns. | none → none |
| 237 | The arm boss sits low on the stud (0.5 above the face, where it was 1.02). The straight arm rises from the boss through the unchanged pawl hinge to the handle. It runs level only inside the pawl eye (±0.17). The stud stands from the face up through the boss. The wheel's black face collar (`crown-wheel-output-hub`) is removed by presentation. The pawl, hinge height and baked lift law are unchanged. | none → none (the first inclined bar grazed the pawl eye at 0.015; fixed by the level span) |

`makeFlatBandGeometry` and the `band` option of `makeDynamicLeafSpring` are
used only by 63 and 73. Movement 235's round tappet spring is unchanged.

## Checked and left unchanged

- **215 proportions.** The 2× plate measures the driver at 0.63 and the star
  at 0.54 of the centre distance, so the star is about 0.86× the driver. The
  model has 0.66 and 0.58 (0.87×). The ledger's "Brown's is ≈0.6×" is
  stale. What still differs is the outline. The concave locks meet the slot
  mouths in 0.116-radius horns, where Brown draws rounded ears. Rounding the
  horns would shorten the lock arcs and move where the pin first touches.
  The handoff tests require a compressive pin face through
  [0.004, 0.025] and crescent support at pickup, so the horns were kept.
- **213 square teeth.** A square-gap cutter was tried in the contact
  generator. The pin centre passes below Brown's tooth-top level
  (top + pin radius = 2.06) over ±14.5° about the line of centres. That
  window is wider than the 16.4° pitch once the flank push is added. Square
  teeth of Brown's height therefore stop the pin at their tops ("disconnected
  branch"). The only square profile that solved was 0.08 deep (flat tops at
  1.788). That is less than half the current rounded teeth and about 40 % of
  Brown's, so the swept rounded notches were kept. The baked file was
  restored and `--check` is byte-identical.
- **211 arc and pinion.** The lock needs a whole pinion turn per index, so
  the wheel's teeth plus the entry pin must cover the pinion's positions
  less its missing lock positions. With 18 positions at Brown's 2.5 ratio,
  Brown's ≈80° arc allows only 10 teeth at 8°, which needs 7 missing pinion
  teeth. Brown shows about 4. Brown's plate is not kinematically closed, so
  the 40/16 construction was kept.
- **214 tooth width and finger angles.** The generator records 0.66 as the
  widest square tooth that clears through a full mesh at 0.06 root
  clearance. The finger lengths and the counterwheel angle are tuned for a
  single blocking encounter. Neither was changed.
- **63 centre distance and arm top.** The pins cross the star's plane, so
  the widened centre distance (pin circle + star points = 2.095 < 2.15) is
  what keeps them clear. The raised arm top keeps the relieved drop back in
  one piece above the swept pawl shank. That would need a rebake of
  `intermittent-63-211-snap-counter-cuts` and a new cut-topology check. Not
  attempted.
- **70 rim.** The rim's inner radius (1.25 = 0.577 of the centre distance)
  matches Brown's dotted circle (0.57). Its outer radius equals C's radius
  because the closing law in `open-rim-tappet-motion.js` uses `rimOuter` as
  the corner that seats the stud. It was left as is.
- **71 notches.** They measure about 119° and 219° against Brown's ≈132°
  and ≈214°. They are set by the guard/stud lock and were not changed.

## Tests

`tests/movement-206.test.mjs` pins the new tooth count (53), root radius,
right-pawl offset and face fraction, and rocker amplitude (6.8–6.95°). The
bounds on handle travel (> 0.08 each way) and per-sample reset step
(< 0.005 over 53 cycles) scale with the finer pitch. The contact-error bound
is 4e-15 (it was 3e-15; the measured value is 3.02e-15). The `models.test.mjs`
block for 63 names the single `springLeaf`. Passing: the 063, 071, 073, 206, 211,
213, 214, 215, 233 and 237 movement suites; crown-pawl-237, gear-finger-stop,
geneva-stop-215 contact, geneva working solids, lantern-stop-233,
open-rim-tappet and split-rim-213 contact; source-presentation; movement-235;
and the `models.test.mjs` blocks for 63, 70, 71 and 73.
