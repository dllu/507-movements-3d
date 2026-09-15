# Movement 168 — variable-radius slotted crank

168 now uses nine meshes with a broad tapered pitman, a through-slot, and
finite pins passing through real openings. The added base, solid slot backing,
index decorations and invisible framing box are removed. Dashed construction
paths show the auxiliary circle and actual slot-pin orbit. The near-frontal
view fits the complete visible motion, with no fog or ground. Playback is
analytic and takes four seconds per auxiliary revolution; no WASM is required.

## Source proportions and hidden closure

The [source page](https://507movements.com/mm_168.html) provides a working
animation. It uses equal length-10 pitman halves, a radius-2 auxiliary crank,
10-unit shaft spacing, and a length-30 power rocker with pivot (10,30).
Those ratios validate the mechanism but differ from the engraving.

The production geometry uses 0.012 world units per pixel. Main and auxiliary
shafts follow (70,267) and (286,264). The auxiliary pin follows (310,217), giving
radius 0.633277 and initial angle 1.098674 radians. The left and right pitman
spans measure 2.342460 and 2.032398 world units. A single rigid pitman direction
follows the line from the engraved slot pin to the power wrist; the small
remaining noncollinearity in the drawing is not animated as rod deformation.

| Initial joint | Engraving | Rebuilt projection error |
| --- | --- | ---: |
| Auxiliary pin | (310,217) | 0 px |
| Slot pin | (123,161) | 1.443 px |
| Power wrist | (473,263) | 1.443 px |

These are planar joint-position checks, not whole-contour or screenshot
registration claims. The previous animation-proportioned model missed the
slot pin and wrist by approximately 41 and 38 pixels after shaft alignment.

The power rocker is shown only for the approximately 1.36-world-unit length
visible in the engraving. Its inferred full length is 7.776, retaining the
source animation's ratio to shaft spacing. The initial direction follows the
engraved upper continuation, placing its hidden pivot at approximately
(3.539788,7.661824), relative to the auxiliary shaft. Depths, pin clearances,
shaft support outside the picture and absolute timing are inferred.

The auxiliary crank is prescribed at uniform speed. Circle intersection closes
the right pitman span and rocker; the rigid left span determines the slot pin,
which sets the main crank's angle and changing radius. The finite rocker gives
an approximately elliptical orbit, not an imposed exact ellipse. This is an
ideal kinematic reconstruction, without load, inertia or impact calculations.

## Validation

The [executed oracle comparison](validation/168-oracle-comparison.json) checks
721 phases using the animation's own dimensions. Independent angular closure
agrees within 1.155e-14 drawing units. The production dimensions intentionally
differ; the report records both parameter sets and initial source-position
errors. Raw downloaded animation code remains in `/dev/shm`.

The [legacy selected-contact audit](validation/168-existing-contact.json)
found pin penetration into the solid slot backing and auxiliary crank end.
The replacement [solid sweep](validation/168-solid-clearance.json) checks
129 poses, 29 cross-body pairs and 4,494,102 bidirectional surface queries,
with no sampled penetration above 1e-6 world units. Rigid-body joins and dashed
construction lines are excluded. Axial separation keeps the two shafts clear
of the moving pitman throughout the cycle.

Three tests check oracle-dimension closure, invalid configurations, the
engraving's initial joint positions, and production closure/radius limits over
1,441 poses. The production build and packaged Chrome desktop/mobile test pass,
including playback, exact restart, orbit/reset, no WASM request, no page errors,
and no horizontal mobile overflow. Front and oblique screenshots were inspected;
temporary artifacts remain in `/dev/shm/168-*`. The
[browser record](validation/168-browser.json) identifies the checked sources.

```sh
node --test tests/variable-radius-crank-motion.test.mjs
node scripts/compare-variable-crank-oracle.mjs
node scripts/review-variable-crank-solids.mjs
```

The full 507-movement review remains active. Next source review: 169.
