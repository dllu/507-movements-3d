# Movement 168 — variable-radius slotted crank (review open)

The existing model needs source-proportion and finite-joint corrections.
Its centerline construction is consistent with the later source animation,
but that animation's dimensions do not closely reproduce the engraved pose.
No replacement is registered yet.

## Executed source reference

The [source page](https://507movements.com/mm_168.html) has a working animation.
It uses a radius-2 auxiliary crank, two length-10 pitman halves, main and
auxiliary shafts 10 units apart, and a length-30 power rocker whose fixed pivot
is (10,30). The visible right-hand power member continues beyond the drawing.

`src/simulation/variable-radius-crank-motion.js` independently closes those
links using angular circle intersection. Executing the original animation
and its library at 721 phases gives maximum wrist/slot-pin coordinate error
1.155e-14 drawing units. The [oracle report](validation/168-oracle-comparison.json)
records source hashes and sample poses. Downloaded source code stays in
`/dev/shm`; it is not incorporated into the model.

The finite rocker produces a nearly elliptical slot-pin path. An exact ellipse
is not imposed, nor is the power wrist forced to move on a straight line.
Two tests check rigid lengths and continuous selection of the right-hand
assembly branch over 1,441 poses, and rejection of impossible closure.

## Engraving mismatch

The approximate raster comparison anchors the auxiliary shaft at (286,264),
uses 216 pixels between the shafts, and keeps axes parallel to the image.
The source shaft centers differ vertically by three pixels, so this is an
approximate diagnostic rather than a fitted projection certificate.

| Initial joint | Engraving position | Animation projection error |
| --- | --- | ---: |
| Auxiliary pin | (310,217) | 12.18 px |
| Main slot pin | (123,161) | 41.38 px |
| Power wrist | (473,263) | 38.43 px |

Thus matching the animation alone is insufficient for source fidelity. The
replacement needs independently measured crank radius and pitman spans, with
an explicit assumption for the unseen power pivot. The drawing's main slot
pin, auxiliary pin and wrist are approximately collinear but its two visible
pitman halves are unequal. Preserve rigid linkage closure while fitting those
measurements; document any residual inconsistency instead of deforming the rod.

## Actual-solid defects

The [97-pose selected-interface sweep](validation/168-existing-contact.json)
performs 1,075,342 bidirectional surface queries. It finds up to 0.114251 world
units of main-pin penetration into the solid slot backing, and 0.114562 into
the auxiliary crank's undrilled end. No sampled main-pin/slot-frame penetration
is found. These are cross-body interfaces; rigid pin/pitman joins are excluded.
The audit does not qualify all other parts or the complete assembly.

Replace those interfaces with finite pins and real openings. Also reconstruct
the broad tapered pitman visible in the engraving, remove the added base and
index decorations, use dashed construction paths, and review the existing
10.13-second period. Preserve the visible continuation of the power member
while documenting its hidden pivot. Browser validation follows replacement.

```sh
node scripts/compare-variable-crank-oracle.mjs
node scripts/review-variable-crank-existing.mjs
node --test tests/variable-radius-crank-motion.test.mjs
```

Movement 168 remains open. The full 507-movement review remains active.
