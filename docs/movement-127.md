# 127 — opposed rack air-pump drive

The [engraving and caption](https://507movements.com/mm_127.html) show one
lever on a pinion shaft driving two opposed vertical racks. This is an
analytically determined mechanism: rack displacement is exactly ±Rθ, so live
physics or a baked simulation is unnecessary.

The previous model had an invented base, guide rails and bearing standard,
excessively long narrow racks, a solid decorative wheel, and a tooth phase
offset inherited from a superseded gear primitive. Its many algebraic checks
did not test the finite tooth profiles. Those checks are replaced by a compact
source-dimension, motion, finite-profile and browser test suite.

The replacement uses 100 source pixels per world unit, a wheel diameter of
190 pixels, left/right rack lengths of 356/372 pixels, 34-pixel rack backs,
and a lever end-to-end vector approximately (470,211) pixels. The shaft is
at approximately (252,263). Four curved spoke windows are reconstructed.
The uneven engraving teeth are regularized to an 18-tooth involute pinion,
20-degree pressure angle and conjugate rack flanks, with 0.2-pixel flank relief.
The lever is behind both racks and the gear, with positive depth clearance.
Supports omitted in the engraving are represented by ideal constraints;
depths, circular knob backs and precise spoke curvature remain inferred.

The source animation confirms a 120-degree pinion swing and opposite equal
rack strokes. Its timeline has two 40%-cycle travel intervals and two 10%
dwells. Our hand-operated input uses smooth harmonic reversals, with the same
swing and travel, over four seconds. This intentional timing interpretation
avoids abrupt changes in hand speed; it is not an exact animation replay.

Validation: 721 poses have zero polygon overlap between finite gear and rack
profiles. A half-tooth phase error produces detectable overlap. At 121 poses,
each rack is within 0.3 source pixels of a working gear flank. Full-stroke
travel, opposite displacements, lever depth clearance and rack camera bounds
also pass. These are sampled geometric checks, not a claim about manufactured
tolerances or a continuous collision proof. Desktop source and moving poses
were visually inspected. Ground and fog are disabled, and the camera favors
the engraving's near-frontal view.

The production build, two focused geometry/motion tests, two adjacent model
regressions and the packaged-browser playback test pass. The latter checks
portable subdirectory hosting, desktop/mobile rendering and no WASM download.
The mobile capture was also visually inspected.
