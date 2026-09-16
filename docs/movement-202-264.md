# Movements 202 and 264: finite worm family pass

The primary references are [202](https://507movements.com/mm_202.html) and
[264](https://507movements.com/mm_264.html), including their local 525-pixel
engravings. Both official pages mark animation unavailable. No independent 2D
motion oracle is available for this pair.

202 depicts a concave worm embracing the large wheel and calls it a modification
of 31 for steadiness or power. The reconstruction retains 60 teeth and a 60:1
single-start ratio. 264 explicitly specifies equal-diameter 100- and 101-tooth
wheels driven by one worm, giving one relative turn after 10,100 worm turns.
Its two long pointers retain those exact rates. At the selected 2.4-second input
period, one relative turn takes 24,240 seconds (6 h 44 min); the output is never
independently accelerated. The visible note explains the slow motion.

## Shared correction

Both wheels are now offline envelopes of their actual finite solid worm motion,
rather than ordinary spur or tilted box teeth. `generate-special-worm-wheels.mjs`
bakes radial tooth fields; `makeInstancedWormWheel` reuses one closed sector per
wheel. All cutting and phase minimization runs offline. The browser builds only
the small repeated render sector and the existing solid-worm primitive.

202 uses an integral, bored, straight-flank worm section warped onto the concave
pitch meridian. Its local axial coordinate is `2.1 sin(s/2.1)` and its radial
addition is `2.1 (1-cos(s/2.1))`; the shaft bore remains straight. The section has
a 20-degree axial pressure angle and module 0.07. The wheel is cut with this
finite hourglass solid, retaining the existing input/wheel phase and direction.
The previous wire thread, visible pitch markers, decorative wheel ring and
invented pedestal are removed from the rendered assembly.

For 264, a single cylindrical worm (pitch `2π × 1.7/100`, pitch radius 0.5,
length 1.1, module 0.034, 20-degree axial pressure angle) cuts both wheels at
axial offsets ±0.19. The 100 and 101 generating ratios are applied independently;
the cutter dimensions do not change. Equal outside diameters do **not** imply
equal operating pitch diameters. The old nominal 1.7-radius circles remain
reference dimensions in the legacy analytic diagnostics, not proof of conjugacy.
The generated working surfaces and finite-solid audit supply the contact evidence.

The rear 101-tooth wheel is keyed to the inner shaft, and the front 100-tooth
wheel to its separate bored outer sleeve. Real hub/pointer bores clear those
shafts; the two hubs no longer overlap axially. Pointer arms start beyond the
shaft openings. The worm has a real shaft bore and face indices. Its formerly
long inferred axial extent and the output shaft are shortened for source framing.
Invented bearing frames are omitted. Both models hide the ground and explicitly
disable fog on their materials.

## Qualification and limits

`review-special-worm-solids.mjs` tests the actual rendered worm and every closed
instanced tooth sector bidirectionally, using triangle vertices, edge midpoints
and face centers, BVH containment and finite triangle distance. It covers one
complete input turn. The committed report in
`validation/202-264-worm-solids.json` records the final pose count, query totals,
clearance and source hashes. The focused tests reject stale geometry evidence,
intersections or a maximum nearest working-surface gap above 0.006. Separate
solid probes check the actual worm, hub, sleeve and pointer bores against their
shafts, and tests preserve the exact full-beat indexing and phase continuity.

The 202 finite worm ends create narrow relief corners which a coarse bilinear
radial field bridged. Increasing radial clearance alone did not resolve that.
Its final 64-by-16 tooth grid therefore applies a conservative one-cell angular
and axial guard before instancing, with 0.0025 radial cutter clearance. 264 uses
64-by-8 fields without that guard. This preserves nearby working surfaces while
removing sampled interference; it is not a manufacturing-grade contact-normal,
loaded contact-ratio, or stress qualification. In particular the old 11/12 pitch
crossings on 202 are diagnostic construction points, **not** a demonstrated
number of simultaneously load-bearing contacts. The original pitch-point
functions are retained for compatibility and explicitly qualified by metadata.

Motion remains the exact prescribed gearing law; compliance, self-locking,
friction, force transfer and backlash under load are not simulated. The primary
engravings do not specify these tooth sections, axial widths or shaft fits;
these are mechanically checked reconstruction assumptions. Finite sampled
clearance is stronger evidence than pitch circles alone but is not continuous
collision proof.

Default, front and advanced-phase browser comparisons against the engravings
were captured in RAM on the shared Vite review server. No page errors appeared.
The simple front view remains available for comparison; the default slight
obliquity exposes the worm/wheel widths and the two independent wheels.

The final **33-pose** audit found zero sampled penetrations in 2,550,790 queries
for 202 and 998,352 / 1,006,386 queries for the two 264 wheels. Maximum nearest
working-surface gaps were respectively 0.002338, 0.000546 and 0.000426 model
units. Final browser rendering used 352,516 / 685,168 triangles including shadow
passes (14 / 44 draw calls); the generated profile module is 23,576 bytes.

The 202 authored fit box is a framing aid, not an enclosing collision box. A
33-pose projection of every visible vertex confirms full-turn framing in default
and front views at square and portrait (0.65) aspect ratios: maximum absolute
normalized screen coordinate is 0.924, leaving at least 3.8% viewport margin.
Actual visible Y spans −2.676795 to 2.814486. The display profiler's larger upper
bound comes from rotating the individual instanced sector's bounding box; it is
not a rendered vertex at Y=3.0012. The smaller authored fit box is retained because
the actual projected motion remains inside the viewport.
