# Movement 405: finite rule, pencil and displayed cord

Primary reference: [Brown's movement 405](https://507movements.com/mm_405.html),
caption and engraving. The official animation is unavailable. The caption's
“parabola” is inconsistent with its hyperbola title and constant focal-distance
difference; the existing exact hyperbola law is retained.

## Changes

- Shift the rule shank so its right edge is tangent to the finite pencil barrel,
  rather than running through its center. A genuinely bored pivot eye joins the
  shank and clears the upper focus axle. Ticks and the end cap follow the shank.
- Raise the rule above the lower focus pin and cord. A lateral shift alone clears
  that pin only near the central pose: during the sweep the shank otherwise
  crosses it. Extend the upper axle to the eye, move collars behind the rule,
  and connect the underside rule-end anchor with a small bridge.
- Correct the pencil cone direction and align the graphite point with the
  hyperbola trace at Z = −0.145.
- Use external circular tangents, two straight finite cord strands, and a
  continuous clockwise helical wrap around the pencil. The cord radius is 0.012;
  the wrap has 0.0002 radial tessellation clearance. Attachment heights vary
  monotonically along the unfolded path from Z = 0.16 to 0.36, separating strands
  where they cross in plan. This avoids a discontinuous strand swap at the vertex.
- Hide the presentation board/frame and redundant loop/bight decorations. Disable
  actual material fog and the environment floor; return the source-front camera
  direction explicitly with FOV 8 and full-cycle bounds.

## Material limitation: finite cord length changes

The **trajectory is exact only for the ideal point-string construction**:
`|F_lower P| + (ruleLength − |F_upper P|) = 2.65` throughout the sweep.
The visible finite-radius winding is an **illustration**, not an inextensible
physical string driving that trajectory. Its displayed length ranges from
**2.728157 to 3.200556**, exceeding the ideal length by **0.078157–0.550556**.
The change is **0.472399**, or **17.826% of the ideal length**. Hand tension alone
cannot explain or eliminate this variation; a physical realization of this
particular displayed winding would require changing available cord length.
No elastic-cord, reel, friction or tension simulation is claimed.

The browser reconstruction note explicitly says the finite cord requires changing
length and is not inextensible. `finiteCordLengthRange` stores the numeric range,
relative variation, `inextensible: false`, the ideal-trajectory flag and prescribed
winding choice. `finiteCord` records the actual tangencies, wrap and visible length
at the current pose. The existing `contacts` ideal-string residuals remain the
analytical construction's evidence, separate from those finite-length diagnostics.

## Checks

```sh
node --test tests/movement-405.test.mjs tests/hyperbola-finite-cord.test.mjs
```

**11 tests pass.** Existing focal difference, ideal constant-length law,
finite-difference velocity/acceleration, and cycle checks remain intact. New checks:

- 2,049 poses retain continuous winding, circular tangency, and separation of the
  two straight strands; minimum separation beyond their combined radii is
  **0.01432**.
- Actual rendered cord vertices, edge midpoints and triangle centers clear the
  pencil barrel, lower pin and raised rule at 33 full-cycle poses.
- The upper axle clears the real pivot eye, the lower pin remains behind the rule,
  the pencil contacts the rule edge and its graphite meets the trace.
- Wrap triangles wind outward and their analytic vertex normals agree with the
  face orientation throughout the sweep.

Chrome default/front/advanced source comparisons show no errors or cropping.
Rendering including shadows used **102 calls / 16,808 triangles**. Bulk captures
remain in `/dev/shm`. These selected geometric tests are not an exhaustive continuous
all-parts collision proof. Support depths, cord radius, winding and presentation
layers are reconstructed, and the rule sweep is prescribed analytically.
