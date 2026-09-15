# Movement 160 — spring-return treadle, review in progress

160 remains open. The production animation is still the authored model; the
spatial band helper is a tested candidate for its replacement.

## Source

The [original page](https://507movements.com/mm_160.html) specifies a treadle,
return spring and a band passing once around a pulley. Its Animated tab is
unavailable; there is no original 2D animation to use as a motion oracle.
The local engraving is `public/engravings/mm_160.png` (525 × 525 pixels).

The current measured centers are pulley (319,252), treadle pivot (160,413),
treadle band eye (360,381) and upper band attachment (362,104), with a 43-pixel
pulley pitch radius. These identify the mechanism but are not yet a complete
outline fit. The source shows a solid pulley face and shaped treadle pedestal;
the existing spoked pulley, generic rear posts, bulky foot plate and oblique
camera do not reproduce that appearance. A packaged browser screenshot was
inspected at `/dev/shm/160-legacy-source.png`.

## Reproduced failures

`node scripts/review-spring-return-treadle.mjs` reviews the existing model at
257 phases. The full wrap lies entirely in one plane. Two material points
almost one circumference apart overlap at every phase; 137 phases have exactly
coincident centerlines. The maximum radial-tube overlap witness is 0.096 world
units, or 5.33 engraving pixels. Exact band-length closure therefore does not
establish physical correctness.

The visible spring centerline varies from 6.01768 to 6.14935 world units,
a 2.19% change. It is a hand-shaped bending curve, not an inextensible elastic
leaf. The reported spring force is calculated after prescribing the treadle
angle and does not drive the return. Its four-second cycle is a reasonable
initial display speed, but its dynamics remain unqualified. The rendered foot
stays 0.0983 world units above the source floor in this audit; floor penetration
is not the reproduced problem here. This is not a full solid collision audit.

## Spatial full-wrap candidate

`AxiallySeparatedBand` lifts an arclength-parameterized planar route of constant
length L to z(s) = z0 + (z1-z0)s/L, where s is material distance from the upper
attachment. All XY coordinates are unchanged. The spatial length is exactly
sqrt(L² + (z1-z0)²), also constant. Smooth planar tangencies stay smooth because
the depth slope is the same on the straight spans and the wrap.

Each material point keeps its depth as the mechanism moves. The helical contact
pattern migrates around the drum, but the material has zero axial velocity.
Inside the wrap, its XY velocity still matches the drum's rotation. Thus the
spatial separation does not require invented axial slip or band stretching.
The test checks that identity with central differences at fixed material
coordinates, not merely a stored no-slip error field.

The candidate uses inferred endpoint depths 0.24 and 0.72 world units. Across
129 poses, 1,025 points per route give a conservative nonlocal surface-clearance
lower bound of 0.05772 world units (3.21 pixels), after subtracting two sample
spacings and the band diameter. Sections within four radii of material distance
are excluded from this nonlocal check. The wrap's axial surface envelope is
[0.27933,0.65541]; a replacement drum must accommodate this moving envelope.
The test's maximum no-slip velocity error is 1.62e-10 world units/second;
4,096-chord length integration differs from exact length by at most 1.96e-6.
These are sampled-pose checks, not continuous-time hardware qualification.

Reproduce with:

```sh
node scripts/review-spring-return-treadle.mjs
node scripts/review-spatial-treadle-band.mjs
node --test tests/axially-separated-band.test.mjs
```

Small reports with source hashes are in `docs/validation/160-*.json`.

## Next work

Reconstruct the source leaf and supported solid pulley, with appropriately
separated attachment depths and a drum wide enough for the full wrap. Replace
the stretching spring curve and qualify the spring-driven return under explicit
load/material assumptions. Inspect actual band/drum, attachment, spring and
frame clearances through the cycle. Then bake expensive work and verify framing,
restart, speed and desktop/mobile playback before production registration.
