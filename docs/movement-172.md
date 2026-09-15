# Movement 172: slider-crank egg curve

The [engraving and animation](https://507movements.com/mm_172.html) show a
uniform crank, a rigid connecting rod and a horizontally guided wrist. A point
on the rod traces an egg-shaped curve. Closed-form slider-crank geometry gives
this motion directly; no contact solver, MuJoCo download or motion bake is needed.
Playback takes four seconds per revolution.

The reconstruction uses seven physical meshes with bored joints, one invisible
camera envelope covering the full travel, and one lightweight dashed line for
the tracer path. Ground and fog are disabled. The shaft mounting, horizontal
wrist guide and axial spacing are inferred where the engraving omits them;
the guide is prescribed rather than shown as an invented rail.

## Source agreement and discrepancies

Measured initial crank and wrist centers match the 525-pixel engraving to
numerical precision. Projecting the drawn tracer onto the rigid rod puts its
center within 2.33 pixels of the selected source point. The original animation
uses a crank radius of 10, rod length of 40 and tracer fraction of 0.375.
The engraving instead implies a rod/crank ratio of about 4.80 and tracer
fraction of 0.3513, which the visible reconstruction retains.

Executing the original animation library at 721 phases agrees with the analytic
wrist coordinates within 3.1e-14 using the animation's dimensions. This checks
the closure independently; the reported tracer samples are calculated from
that closure, not independently extracted from the source animation.

The engraving's dotted witness curve is larger and offset from the trajectory
implied by its joints. Its approximate raster bounds are [181, 189, 357, 326],
versus [168.44, 200.77, 347.05, 316.64] for the reconstructed trajectory. The
rendered line follows the actual tracer rather than distorting the rigid rod
to reproduce that inconsistency.

## Validation

- Three tests cover 721-phase rigid closure, measured initial landmarks,
  rendered tracer positions, finite transforms, four-second periodicity and reset.
- The finite-solid audit samples 129 poses and all 18 pairs across distinct
  rigid families: 3,626,190 surface queries find no sampled intersections.
  This is a sampled clearance check, not a continuous collision proof.
- The production build and packaged Chrome desktop/mobile test pass: playback,
  exact restart, orbit/reset view, no horizontal overflow at 390 by 844 pixels,
  no WASM request and no page errors. Front and oblique views were inspected.

Compact evidence: [oracle](validation/172-oracle.json),
[clearance](validation/172-clearance.json), and
[browser](validation/172-browser.json). Bulk screenshots and build output stay
outside Git. Next source review: 173; the full review remains active.
