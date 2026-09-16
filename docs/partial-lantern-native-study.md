# Movement 199: bounded passive-rack contact study

**Working geometry and playback are unchanged. This study is not bake-qualified.** The existing
[finite-profile review](partial-lantern-rack-review.md) still applies to the
browser's prescribed source-oracle motion. This pass tests whether rack inertia
can supply its late coasting interval and whether finite contacts can reverse
that rack without a position actuator.

## Source and selected mechanical question

[Brown's 199](https://507movements.com/mm_199.html) has four pins on fewer than
half the lantern circumference, opposed racks with enlarged entry teeth, and
fixed frame guides. The registered `mm_199` animation supplies triangular
translation with instantaneous velocity reversal. It is a motion reference,
not a force solution. The source gives no rack mass, load, friction or impact
compliance.

The previous phase-0.99951171875 witness remains: its close tooth face retards
the rack, while the nearest positive-driving candidate is 0.091804 away. That
alone does not rule out an inertial coast. Adding a fixed driving flank under
the exact oracle law is problematic: at phase 0.4995, all four candidate circle
contact points whose normals both permit that velocity and drive the rack lie
inside another phase's full pin sweep, by about 0.120–0.122 units. A small
rounded-end trial reduced the gap but did not close the handoff and was rejected.
A contact-only quasistatic follow trial also retained a 0.0253-unit branch jump
under finer sampling. Neither trial replaced playback.

## Native model

`mujoco-partial-lantern/physics.js` decomposes the **existing visible baked tooth
outlines into 888 convex prisms**. Tests verify convexity and preservation of
polygon area to 1e−12; no convex hull fills concave working passages. All four
full-radius cylindrical pins and their source mount positions remain. The rack
has one unactuated horizontal slide joint. Only the input hinge has a velocity
actuator, targeting continuous clockwise 0.9 rad/s rotation. Guide constraints
are ideal joints; guide hardware and shaft meshes are not re-simulated.

Reconstruction assumptions are normalized rack mass 1, input inertia 0.1,
viscous guide damping 0.015, zero contact friction/gravity, actuator gain 10,000,
contact `solref` 0.0005/1, and per-geom margin 0.0001. The rack starts at −2.4
with the source's forward speed, 0.687549. That initial kinetic energy is
explicit, not evidence of self-starting. These inferred values are not physical
measurements from the engraving.

The first softer run reproduced the stroke but allowed 0.00180 sampled
penetration. Stiffer contact reduced it. A trial with excessively large
opposing margins jammed/preloaded the narrow passages; it was rejected, not
used to infer mechanism behavior. The final margin is below the available
initial opposed-face clearance, which is separately tested.

## Final controls and failed qualification

The final runs cover 24 seconds at each timestep; comparisons use equal measured
input angles so motor tracking error is not mistaken for rack disagreement.

| Metric | dt = 0.000125 | dt = 0.0000625 |
| --- | ---: | ---: |
| Final-cycle rack minimum | −2.397456 | −2.399429 |
| Final-cycle rack maximum | −0.002990 | −0.001137 |
| Worst sampled contact gap | −0.00002425 | −0.00007657 |
| Maximum input tracking error, rad | 0.002633 | 0.002135 |
| Consecutive-cycle position disagreement | 0.005469 | 0.002430 |

The maximum timestep disagreement is **0.016735**, above the 0.001 qualification
limit. Both repeatability controls also exceed 0.001. Thus the finite model can
coast and reverse through nearly the full 2.4-unit source stroke, but it has not
established a sufficiently reproducible periodic trajectory for baking.

With contact disabled for 16 seconds, the rack never reverses, has zero contacts,
and coasts from −2.4 to **7.380250**, ending at velocity **+0.540846**. The setup
regression also checks this motion against the analytical damped free-slide
solution. There is no hidden rack position actuator. Disabled motion is now a
required qualification control, not merely an informational plot.

The comparison additionally rejects nonfinite samples, nonmonotone input/time,
less than two cycles of coverage, mismatched input starts, missing disabled
contact evidence or disabled reversal. All coverage/control/contact-tracking
checks pass for the saved final runs; numerical agreement fails. Full contact
penetration is sampled every 0.005 seconds rather than asserted as a continuous
maximum. The disabled zero-contact count is checked at every native step.

## Reproduction and next work

Commands and model assumptions are in
[`src/simulation/mujoco-partial-lantern/README.md`](../src/simulation/mujoco-partial-lantern/README.md).
`study-results.json` records compact final metrics and model hashes. Large XML
and trajectory artifacts remain in `/dev/shm/199-native44-bounded*.{json,xml}`.
No native study runs in the browser, and no unqualified motion dataset is loaded
by production.

A separate metadata-only correction preserves the existing source animation
bounding box and normalized pose when adding availability fields; the helper
previously overwrote those fields.

The four new study checks and nine existing movement/profile checks all pass
(**13/13**):

```sh
node --test tests/partial-lantern-native-study.test.mjs tests/partial-lantern-rack-working-parts.test.mjs tests/movement-199.test.mjs
```

The next bounded contact pass should isolate pickup sensitivity at a single
reversal, recording native impulse and energy with the same finite prism model.
It must establish timestep convergence and repeatability before exporting a
cycle; neither smoothing the observed jump nor forcing endpoints to match is a
qualified dynamics correction. This pass preserves the reproducible model and
failed controls so that investigation need not restart with source tracing.
