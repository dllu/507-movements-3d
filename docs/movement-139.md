# 139: internal-rack tooth and source review

The [source caption](https://507movements.com/mm_139.html) describes a rack that
slides vertically inside a horizontally translating rectangular carriage. A
continuously rotating pinion engages alternate sides. The page has a 2D animation,
but its geometry is not identical to the engraving.

## Verified defects in the current browser model

The browser uses twelve trapezoidal pinion teeth and repeated trapezoidal rack
teeth. Intersecting their nominal, un-beveled polygons after applying the actual
scene transforms detects overlap at all 360 sampled poses. The worst intersection
area is 0.113642 world units squared during the left-end handoff. Their axial
working depths overlap, so these are solid intersections rather than harmless
projected overlaps. Bevels are excluded; the report consequently understates
interference. See [the hashed tooth review](validation/139-tooth-review.json).

Enlarging the original engraving shows **nine pinion teeth**, with one pointing
downward in the pictured pose. The source animation's pinion has eight teeth
(eight pairs of outer vertices spaced 45 degrees apart). The existing browser
has twelve. The animation can therefore guide interpretation of the motion,
but cannot serve as the exact tooth-count or silhouette oracle.

The pictured pinion engages the lower row near the middle of the rack. The
legacy starting phase, 0.24, instead engages the upper row and displaces the rack
sideways. In its ideal three-revolution path, phase 2/3 puts the pinion at the
centre of the lower row. Frame, rack and suspension dimensions still require
measurement; the legacy assumption that the end pitch radius is exactly twice
the pinion radius must not be treated as a measured fact.

## Generated-tooth prototype

`mujoco-internal-rack/profile.js` now generates a nine-tooth pinion with rounded
rack-cutter roots and involute working flanks. Sweeping an enlarged copy of that
pinion through the ideal pitch path cuts a conjugate internal opening. This
replaces independently guessed teeth with a matched pair, including the joins
between straight travel and rounded-end handoffs.

The current experiment retains the legacy pitch dimensions and 2:1 end-radius
ratio pending the dimensional review. It uses 1,024 generating poses, 64 samples
per pinion tooth, 2,048 rack-cutter steps and a 0.002-unit radial cutter allowance.
At 720 separately offset verification poses, no nominal polygon intersection is
detected. The result is one connected rack body with one connected opening.
The generated shape has been rendered and visually inspected. Its bulk polygons
and preview remain in `/dev/shm`; only the generator and compact results are
committed. See [the generated-profile report](validation/139-generated-profile.json).

Tests independently count nine outer tooth tips, check between-sample clearance
at another phase grid, and check continuity of the ideal pitch path. These
results establish geometric clearance on that path. They do **not** establish
passive tooth-driven motion, contact retention, preload, linkage force balance,
source proportions or the adequacy of the reconstruction's hidden supports.
The browser still loads the old implementation.

```sh
node scripts/review-internal-rack-carriage.mjs
node scripts/prototype-internal-rack-profile.mjs
node --test tests/internal-rack-profile.test.mjs
```

Next: measure rack pitch dimensions and the asymmetric suspension cranks from
the engraving, adjust the generating path accordingly, and run passive MuJoCo
contact checks. Then bake validated motion and geometry, check full-cycle hardware
clearance and source alignment, and inspect packaged desktop/mobile playback.
Do not advance to 140 yet.
