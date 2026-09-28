# Movement 169 — link-connected variable crank

169 now uses eleven finite meshes. The added short link replaces 168's slot,
with bored end eyes, a narrow web and separate pins. The pitman, two cranks
and visible power rocker follow the engraving's orientation and proportions.
The added base and indexes are removed; dashed lines show the computed pitman
end path and auxiliary circle. Ground and fog are disabled. A four-second
analytic cycle needs no live physics engine or WASM.

## Source reconstruction

The [source page](https://507movements.com/mm_169.html) explicitly identifies
this as the link-connected modification of 168. It has no working animation
script, so there is no direct 169 motion oracle. The underlying circle-closure
routine is shared with the oracle-checked 168 implementation; the added link
is checked independently through its rigid lengths and assembly continuity.

The old factory carried over 168's shaft spacing and equal pitman halves.
It also recorded the auxiliary shaft at (286,274), whereas the engraving
places it near (267,275). The replacement uses that measured center and main
shaft (426,276), at 0.012 world units per pixel. Auxiliary radius is 0.573118,
main radius 1.027595, and added link length 0.916803. The unequal pitman spans
are 2.376969 toward the power wrist and 2.235127 toward the added link.

| Initial moving joint | Engraving | Projection error |
| --- | --- | ---: |
| Auxiliary pin | (251,230) | 0 px |
| Power wrist | (61,286) | 2.883 px |
| Pitman end | (428,172) | 2.883 px |
| Main crank pin | (489,218) | 2.389 px |

The drawing's three pitman joints are slightly noncollinear. A single rigid
pitman follows the direction between its engraved endpoints, retaining the
small residual above. These measurements qualify initial planar joint
positions, not complete contour registration. Brown breaks the power rocker off about 1.36 world units from its wrist.
Since pass 90 (docs/p90-fg-review.md) the whole rocker is modelled, 2.5 long
(about one pitman length; formerly 7.776, the source animation's ratio). It
runs along the drawn continuation to an inferred fulcrum near (-3.016030,-2.602948),
relative to the auxiliary shaft, on a plain round bearing boss. The pin orbit
changes by about 1%. Neither hidden pivot nor axial depths are specified
by the engraving.

The auxiliary crank is prescribed at uniform speed. Two circle-intersection
closures give the rocker and added link. No point is clamped onto a false
closure when circles fail to meet. The chosen main-crank branch stays away
from tangency: over 1,441 phases the inner and outer circle margins remain
above 0.133711 and 0.570216 world units. Load, inertia and joint forces are
outside this ideal kinematic model.

## Finite joints and validation

The first replacement placed the added link in front of the pitman. Its long
main pin crossed the pitman during part of the cycle. The final depth layout
places the main crank behind the added link, then the pitman, with the auxiliary
crank in front. This allows short pins through actual openings and keeps the
main shaft behind the crossing link.

The [source/closure report](validation/169-source-closure.json) records the
measured joints and circle margins. Three tests check all rigid lengths,
branch continuity, the initial source pose and impossible added-link closure.
The [129-pose actual-solid sweep](validation/169-solid-clearance.json) covers
47 cross-body pairs with 4,742,040 bidirectional surface queries and finds no
sampled penetration above 1e-6 world units. Same-body joins and dashed lines
are excluded.

The production build and packaged Chrome desktop/mobile checks pass, including
playback, exact restart, orbit/reset, no WASM request, no page errors and no
horizontal mobile overflow. Front and oblique screenshots were inspected.
The [browser record](validation/169-browser.json) identifies checked files;
temporary build and screenshot artifacts remain in `/dev/shm/169-*`.

```sh
node --test tests/linked-variable-crank-motion.test.mjs
node scripts/measure-linked-variable-crank.mjs
node scripts/review-linked-variable-crank-solids.mjs
```

The full 507-movement review remains active. Next source review: 170.
