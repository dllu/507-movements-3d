# Movement 171 — oscillating marine valve gear

A 36-mesh reconstruction replaces the inherited engine/frame illustration with
the source-visible valve gear. It uses finite bored parts, a frame-guided curved
slide, analytic linkage closure and a six-second crank revolution. Three crank
turns and one reversing traversal form an 18-second repeating animation.

## Source and reconstruction

The [source page](https://507movements.com/mm_171.html) has no working animation
script. Its 263-by-525 engraving shows two eccentric straps and rods, a short
slotted reversing link, a central rod with an upper guide tail, and a curved
slide above the trunnion. The added cylinder, piston, valve chest, rear crank
and large supporting frame have been removed from the visible scene.

The right-hand eccentric is in front. Its layered straps have rounded shoulders,
tapered rods, real bearing openings and the illustrated side lugs. Sheave radius
is 0.57, eccentric throw is 0.13, and strap outer radius is 0.735 world units.
The upper slot has unequal end angles, -0.405 and +0.27 radians, matching the
shorter right end in the engraving. The operator's imposed selection varies
smoothly as 0.25s - 0.06s² for s in [-1,1], keeping the finite die inside the slot.
The off-frame reversing rod has a bored eye and the source's shortened extent.

The [source-fit record](validation/171-source-fit.json) measures the initial
orthographic geometry: 16 lower-slide and central/reversing-rod landmarks fit
within 0.5 pixel, and three approximate upper circular features fit within
4.12 pixels. Frontal and oblique packaged views were also reviewed against the
engraving. These landmark errors do not constitute a whole-contour pixel metric;
line thickness, depth and the slightly skewed drawing limit exact superposition.

## Lower compensation and assumptions

John Bourne's [A Catechism of the Steam Engine, section 630](https://www.gutenberg.org/cache/epub/10998/pg10998-images.html)
describes a vertically guided sector, its upper guide tail and end guides on
frame columns, with curvature centered on the trunnion at valve half stroke.
This supports the fixed-guide interpretation of Brown's abbreviated drawing.
The model's guide columns remain fixed while the sector translates vertically;
the follower rockshaft moves with the oscillating cylinder.

The [compensation audit](validation/171-compensation.json) recomputes angles
and circle distances over 3,605 states. At the neutral slide position, cylinder
rocking adds less than 5.56e-16 radians of relative rocker motion. Away from
neutral, the model retains geometric variation rather than imposing exact
cancellation. Across 721 playback poses, the guide columns remain stationary
and the central connecting rod has zero horizontal span.

The hidden crank radius and phase, rocker pivot, axial layers, bearing
clearances and diagnostic valve-output dimensions are reconstruction assumptions.
The unillustrated diagnostic output link is long enough to accommodate its
arm's full lateral reach; its calculated stroke is not a measured historical
valve output. The reversing selection is an imposed operator control. There
is no pressure/load simulation. The finite geometry is analytically determined,
so this mechanism requires neither live MuJoCo nor a motion bake.

## Finite parts and validation

The upper plate has a 0.12-wide through-slot around a 0.11-wide curved die.
The lower slot is 0.102 wide around a 0.09-diameter follower. Bored guide blocks
fit the measured unequal source bounds. Solid end bridges and an eye web join
the lower slide into a rigid assembly. The central tail stays through its
bored upper guide; its z=0.52 plane clears the eccentric rods. Pins span their
eyes, and the eccentric pin caps clear the central rod.

The [whole-assembly sweep](validation/171-all-clearance.json) checks all 35
physical meshes across 512 cross-rigid-family pairs at 129 poses. Its 16,549,746
bidirectional surface queries find no sampled penetration above 1e-6 world
units. It also checks guide engagement at those poses. Same-rigid-family unions
and the non-rendering camera envelope are excluded. This is sampled clearance,
not proof between samples. Targeted [lower](validation/171-lower-clearance.json),
[upper](validation/171-upper-clearance.json) and
[eccentric](validation/171-eccentric-clearance.json) sweeps also pass.

The [closure audit](validation/171-existing-closure.json) covers 721 phases at
five reversing settings, with maximum length error 1.34e-14 world units. The
[cycle check](validation/171-cycle.json) covers every mesh transform, with a
2.23e-16 position seam and a 0.000110 one-sided velocity difference at a
0.0001-second step. The [scoped model test](validation/171-unit.json), production
build and [packaged desktop/mobile checks](validation/171-browser.json) pass:
playback, exact Restart, orbit/reset, no page errors, no WASM requests and no
horizontal overflow at 390-by-844. Fog and ground are disabled.

Historical failures remain in the [original lower-interface audit](validation/171-existing-contact.json)
and [pre-guide-repair whole-assembly diagnostic](validation/171-before-upper-joins.json).
Their geometry predates the current reconstruction.

```sh
node scripts/review-marine-valve-source-fit.mjs
node scripts/review-marine-valve-compensation.mjs
node scripts/review-marine-valve-closure.mjs
node scripts/review-marine-valve-cycle.mjs
node scripts/review-marine-valve-all-solids.mjs
node scripts/review-marine-valve-lower-solids.mjs
node scripts/review-marine-valve-upper-solids.mjs
node scripts/review-marine-valve-eccentric-solids.mjs
node --test --test-name-pattern='^movement 171 ' tests/models.test.mjs
```

Next source review: 172. The full 507-movement review remains active.

## Display correction

Default framing now uses sampled bounds of the moving hardware and an 8-degree field of view. The oversized invisible camera envelope is removed; the mechanism and its motion are unchanged. Desktop/mobile playback and Restart checks pass.
