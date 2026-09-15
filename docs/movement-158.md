# Movement 158 — treadle and disk

158 now follows the engraving's crank radius, joint centers, straight treadle
and tapered pedestal. The model uses 16 static meshes and three moving rigid
transforms. Its four-second revolution is an ideal kinematic animation, with
no browser physics or mesh generation during playback.

## Source comparison

The [source page](https://507movements.com/mm_158.html) describes a treadle giving
circular motion to a disk, with a crank as an alternative. Its 2D animation uses
a uniform disk phase and solves the connected treadle position. The new model
uses that same kinematic convention. It does not simulate foot force, flywheel
inertia, starting from rest, losses or passage through the treadle's dead centers
under load. The production note makes this limitation explicit.

The oracle comparison executes the actual source animation definition and
library in an isolated JavaScript VM, reading transformed joint points at 721
phases. The foot is the rigid 28/21 extension of the source treadle's joint.
Both the previous model and the new solver, configured with source-animation
dimensions, agree within 4.7e-15 world units. The old equations were correct for
those dimensions; the drawing uses different geometry.

With disk center, radius and crank phase aligned, the animation differs from
the engraving by 27.21px at the crank pin, 12.68px at the fixed treadle pivot,
and 3.98px at the connecting-rod/treadle joint. In particular, its crank radius
is only 60% of disk radius; the engraving's measured radius is about 84.5%.

## Engraving reconstruction

Approximate centers in the 525px source image are disk (281,240), radius 111px,
crank pin (205,295), treadle pivot (421,418), and rod/treadle joint (181,412).
These give a 93.81px crank radius, 119.44px connecting rod and 240.07px treadle
pivot-to-joint distance. No joint-center correction is needed to assemble a full
turn: the inner and outer circle-intersection reach margins are 12.01px and
39.24px. The foot endpoint (78,410) is projected onto the straight treadle axis,
a change of less than one pixel.

The tapered disk pedestal follows the visible foot and dashed outline behind
the disk. The right arched pivot support and horizontal base follow the source
silhouette. Bearings, through-bores, axial retainers, depth separation and the
rear duplicate support are reconstructed, since the engraving does not specify
their complete 3D arrangement. A near-front initial camera with a narrow field of view presents the source
pose with little perspective distortion; orbiting exposes the rods, shafts and
support layers.

At the measured crank radius, the foot sweeps approximately y=169.22–432.91px.
Its lowest edge remains above the base at y=448px. The animation camera fits
the entire sweep, the ground plane is hidden and all materials disable fog.

## Validation

The solver intersects the crank-pin/rod circle with the fixed-pivot/treadle-arm
circle on a consistent branch. Invalid reach throws instead of clamping the
intersection or moving a joint discontinuously. Three tests cover measured
landmarks, all rigid-link lengths, branch continuity, full-turn closure and
base clearance at 4,097 poses. Rendered joint alignment, unchanged geometry,
full-sweep bounds, fog and reset are checked at 513 poses.

A visible-solid audit checks 99 part pairs across 129 phases with bidirectional
vertices, edge midpoints and triangle centers. It found no unintended
intersections in 4,431,726 point queries. Same-moving-body pairs need only one
pose; intentional fixed-frame unions are excluded. Finite surface sampling is
not a continuous collision proof.

The production build and packaged Chrome desktop/mobile test pass: play/pause,
exact restart, orbit/reset view, 390px layout without horizontal overflow, no
page errors and no WASM requests. Source, moving, oblique and mobile views are
inspected with the complete assembly in frame.

```sh
node scripts/compare-source-treadle-oracle.mjs
node --test tests/source-treadle.test.mjs
node scripts/review-source-treadle-assembly.mjs
```

`SOURCE_HTML` and `SOURCE_LIBRARY` optionally provide local oracle snapshots.
Comparison coordinates and source hashes are recorded in
`docs/validation/158-oracle-comparison.json` and `158-assembly.json`.
