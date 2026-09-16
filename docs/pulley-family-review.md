# Pulley forms 255–259: shared component pass

Reviewed the [255](https://507movements.com/mm_255.html),
[256](https://507movements.com/mm_256.html),
[257](https://507movements.com/mm_257.html),
[258](https://507movements.com/mm_258.html), and
[259](https://507movements.com/mm_259.html) engravings and captions. The original
pages all mark the animation tab unavailable (verified 2026-09-15).

These are rigid pulley specimens: flanged and plain flat-belt treads, a round
concave groove, a smooth V groove, and a notched V groove. Their rotation is
analytical. No belt route, mating pulley, imposed load or angular speed is
specified; adding contact dynamics would not resolve any of those omissions.
The existing display timing remains one revolution in approximately two seconds.

## Corrections

- All five formerly passed a solid shaft through solid hubs and pulley bodies.
  The hubs now have shaft bores; bodies and flanges have hub bores. A 0.008-unit
  radial assembly allowance keeps their finite triangulated surfaces separate.
- The shared `boredLatheGeometry` closes the meridian onto a through-bore and
  retains sharp shoulders and V roots while smoothing the circular groove.
  The periodically notched 259 body has annular end caps and an inner bore wall.
- 255's shaft was 7.2 units long despite a source length of about 4.46 at the
  wheel's existing scale. Its tread was also too wide. The shaft is now 4.46,
  tread 0.85 and each flange 0.26 units, matching the same source scale.
- The near-elevation default view exposes a little depth while keeping the
  source's horizontal shaft and narrow pulley profile legible. Full-turn bounds
  include the rotating speed indices. Ground and material fog are disabled.
- Face speed indices sit immediately on the face rather than visibly floating
  in front of it. White indices and dark rim treatments are visual annotations,
  not separate mechanical members.

## Validation and residuals

`node --test tests/pulley-family-review.test.mjs tests/movement-25[5-9].test.mjs`
passes 47 tests. The new checks raycast through the actual triangulated bores,
check solid annular caps, compare 255 axial dimensions with its source, and
sample full-turn framing. Existing checks retain the groove seating laws,
source proportions and rigid motion. This is a bounded component correction,
not a complete contact or mechanical manufacturing qualification.

The rear faces and hidden bores are mechanical reconstructions. The engraving
supplies no notch count or notch depth for 259: 48 equal notches and the retained
shallow cosine section are inferred from its visible half. No band is rendered,
so adhesion and band deformation are not simulated or validated. Cosmetic
rim outlines and indices remain raised surface details. No irregular contour
extraction is needed: these parts are intended surfaces of revolution.

Browser inspection captured all five default views beside their engravings and
all five at an oblique, advanced pose, with no page errors. The pulley profiles,
shaft extents and grooves remain visible without ground interference. Captures
are transient review artifacts in `/dev/shm/25{5,6,7,8,9}-pulley-{default,angle}.png`.
