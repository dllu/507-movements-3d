# Inclined bevel wheel 200 and accumulative bevel train 226

Primary references: [movement 200](https://507movements.com/mm_200.html) and
[movement 226](https://507movements.com/mm_226.html), captions and engravings.
Both official animation controls are unavailable.

## Mechanical corrections

**200 now uses the single inclined driving wheel shown by the engraving.** The
previous reconstruction treated it as two separate rigid bevel sections on a
horizontal shaft. That extra section is unnecessary: one inclined pitch cone can
mesh with both unequal coaxial output cones at opposite generators.

Retaining the inferred 24/48/32 tooth counts and output speed magnitudes, the
input shaft inclination `epsilon` and cone half-angle `delta` follow:

```
sin(epsilon) = (48 − 32) / (2 × 24)
tan(delta) = 2 × 24 × cos(epsilon) / (48 + 32)
upper cone = pi/2 + epsilon − delta
lower cone = pi/2 − epsilon − delta
```

This gives a **19.471°** inclination. All three cones share an apex, outer cone
distance and module. The upper output turns at −1/2 input speed and the lower at
+3/4 on their common stationary spindle. Each wheel has a genuine bore and a
short concentric journal. Tooth counts and exact dimensions remain inferred;
the illustration is not a dimensioned manufacturing drawing.

**226 retains six equal gears and the physical 3× output law.** The first stage
counterrotates F and hollow shaft C. With frame A fixed to F, the second stage's
`omega_C + omega_E = 2 omega_A` forces three output turns per input turn.
The official caption's claimed doubling is incompatible with that topology;
the browser note states this discrepancy.

Its bevel tooth bands now span axial cone distances **0.82–1.05**, matching the
engraving's narrow faces rather than the prior nearly full cones (0.27–1.05).
Working depth increases from 0.13 to 0.22. Genuine bores fit the input, central,
planet and nested output shafts, while shortened hubs avoid intersection near
crossing shaft axes. The carrier now has a physical connection to F outside the
loose output sleeve; it was previously a floating frame. Index bars no longer
cross shaft passages, and fixed bearing bores match the shafts/sleeve they support.

Both models use the existing **Tredgold back-cone involute approximation**.
These are conical working flanks, not exact generated octoid tooth surfaces.
Equal module/base pitch and approximate transverse contact ratios are checked:
**1.691405 / 1.598337** for 200 and **1.559017** for 226. Motion remains analytical;
there is no runtime physics/contact solving or expensive mesh optimization.
Fog is disabled on actual materials and no environment floor is shown. Display
cycles have a 12-second lower bound; central timing profiles preserve all ratios.

## Evidence

```sh
POSES=33 node scripts/review-200-226-bevel-solids.mjs
node --test tests/movement-200.test.mjs tests/movement-226.test.mjs tests/bevel-200-226-solids.test.mjs
```

The [saved finite-surface report](validation/200-226-bevel-solids.json) tests the
actual tooth and gear-body vertices, edge midpoints and triangle centers
bidirectionally across one full input tooth period. It records nonpenetration
and closest working-surface distances for both 200 contacts and all four 226
contacts. This includes twice-relative-speed planet motion in the second stage.
Selected hub/shaft checks additionally span a full carrier revolution.

The final 33-pose report records **583,670 queries for 200** and **820,138 for
226**, with **zero detected penetration**. Maximum sampled closest gaps are
**0.001597** and **0.001864**, respectively. All **13 focused tests pass**.

Chrome source comparisons at default, front and advanced phases showed no page
errors or cropping. Rendering including shadows used **236 calls / 49,704
triangles** for 200 and **358 / 90,512** for 226. Review images remain in
`/dev/shm`, outside Git.

## Residuals

The finite audit samples surfaces and poses; it is not a continuous collision
proof or an exhaustive all-parts collision study. Back-cone flanks approximate
conjugate bevel contact and include small display clearances. Bearing designs,
carrier mounting depth, tooth counts for 200, and tooth sections are inferred.
The models do not simulate friction, elastic deformation, load-dependent backlash
or bearing forces. The hidden cantilever supporting 226's planet is a plausible
reconstruction, not geometry recoverable completely from the plate.
