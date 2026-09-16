# Pendulum interfaces: 315–317

This bounded pass retains the existing analytical motion and repairs selected working interfaces. It does not claim validated pendulum dynamics or material compensation.

## Primary references

The official [315 conical pendulum](https://507movements.com/mm_315.html), [316 mercury compensation](https://507movements.com/mm_316.html), and [317 compound-bar compensation](https://507movements.com/mm_317.html) pages and local engravings were inspected. These three official pages have no available animated example. The source establishes a spindle-driven conical pendulum, an expanding mercury bob, and an upper steel/lower brass bar lifting end weights, respectively. It does not specify operating speed, dimensional tolerances, material coefficients, depth, or suspension details beyond the cropped drawings.

## Corrections

- **315:** the vertical spindle now passes through real bored supports and its crank hub/collar. The lower support clears the collar and the shaft clears the foot. The tilted rod passes through a bored spherical ball in a spherical crank seat, replacing mutually intersecting solid spheres and a vertical wrist pin. Ball radius is .225, nominal seat radius .227; the crank plate surrounds the seat. The cylindrical bob has an actual rod bore. Duplicate lower pin/marker geometry is hidden. The retained crank-orbit ring is a reference annotation, not a physical part.
- **316/317:** the suspension brackets now lie along the real pivot axis and have matching bores. The moving hubs have through-bores with .002 nominal radial clearance. Rods begin .25 below the mathematical pivot, join their hubs, and clear the fixed pivot shaft; their lower endpoints remain unchanged.
- **317:** the two W weights have rectangular passages around the two-layer bar; the projecting ends are flat bars. The main bob has a bored rod passage while retaining rounded shoulders. The false front-axis hub is hidden; the lower adjuster and thread align with the actual offset rod.
- All three have a source-facing default camera, hidden ground, actual fog-disabled materials, and minimum display cycles of 8 seconds (315) or 12 seconds (316/317). The analytical authored cycles remain unchanged.

The helper performs construction once; updates add no meshes or geometry. No physics engine or generated asset is loaded for these already determined motions.

## Evidence

Run:

```sh
node --test tests/pendulum-journals.test.mjs tests/movement-315.test.mjs tests/movement-316.test.mjs tests/movement-317.test.mjs
```

All **26 tests pass**. The existing tests preserve analytical conical closure and the compensation models' constant ideal effective length `I/Q`, rates, and full-cycle closure. The new finite test samples actual rendered vertices, triangle centroids, and edge midpoints at 17 equally spaced poses spanning each model's own authored cycle (including the full thermal range). Its selected one-way surface queries are:

| Movement | Queries | Selected interfaces |
| --- | ---: | --- |
| 315 | 701,930 | Spindle/upper and lower bearings/bridge, ball/seat and crank plate, rod/seat and bob |
| 316 | 28,696 | Fixed pivot/moving hub and both brackets, rod/fixed pivot |
| 317 | 136,986 | Same pivot interfaces, rod/main bob, all steel/brass bar segments against both W passages |

All 867,612 queries are free of penetration deeper than the numerical threshold of .00001 scene units. This is a bounded sampled interface check, not a continuous global collision proof. Tests also check fog flags, hidden ground, and scene-count stability over repeated updates.

Serial Chrome source-comparison captures, front views, and advanced poses produced no browser errors. Full-cycle visible-vertex projection maxima were .781, .810, and .836 NDC, respectively, without clipping. Rendered triangle counts including shadows were 39,856 / 25,288 / 24,044, with 51 / 56 / 204 draw calls. Bulk screenshots remain in `/dev/shm/pendulum-final-*`.

## Explicit residuals

315 prescribes spindle speed and treats the top wire as an ideal flexure; torque, gravity-driven deviations, bearing friction, and wire stresses are not solved. The spherical lower journal is a mechanically plausible reconstruction, not a dimension recovered from the engraving.

316/317 prescribe swing and exaggerate a periodic temperature input. Mercury height or bimetal curvature is inverse-fitted to preserve the existing ideal mass model's `I/Q`; these are not constitutive material laws, a fluid simulation, or validated thermal compensation. The ideal mass model still counts the rod up to the mathematical pivot and does not recompute inertia from the repaired detailed solids.

316 retains an illustrative zero-thickness glass wall, wire-style adjustment thread, and simplified jar clamp/adjuster interfaces. Those interfaces were not qualified as thread mating or finite glass/clamp contact in this pass. 317 retains an illustrative lower adjustment thread, idealized piecewise straight bar segments, and prescribed curve/weight alignment; stresses and actual bonded-layer compatibility are not solved. The upper suspension omitted by the source crop is inferred. These residuals do not alter the qualified pivot and bar-passage interfaces.
