# Movement 162 — baked water-wheel governor

162 now uses an offline MuJoCo bake of the reconstructed governor and passive
selector contacts. The 451,713-byte asset has 1,490 adaptive motion keys. Five
instanced tooth sets reduce the 183 source meshes to 38 rendered mesh objects.
Playback loads no MuJoCo/WASM and performs no collision solving in the browser.

## Source and reconstruction

The [original page](https://507movements.com/mm_162.html) has no 2D animation.
The upper bevel pair drives the flyball spindle. A pin on the sliding sleeve
picks up either lower loose bevel's stud, reversing the horizontal gate shaft.
At proper speed neither stud is engaged. The water wheel, gate and remote
transmission are outside the drawing. The old authored code instead switches
output speed at preset thresholds and adjusts them to force balanced travel.

Source measurements use 0.018 world units per pixel: spindle x=263; head pivots
(247,55)/(279,55); elbows (205,160)/(320,160); balls near (178,232)/(347,231),
radius 34 pixels; sleeve pins (248,250)/(278,250); lower gear apex (263,414).
Symmetric inferred lengths are 3.414 to the ball, 2.035 to the elbow and 1.787
for the lower link. Stud roots/tips follow rows 388/401 and 418/435. Relative to
the lower apex their working spans are +0.234…+0.468 and −0.378…−0.072. The
neutral pin center is +0.108, with axial half-height 0.045.

The five equal-ratio bevels use inferred 30-tooth counts, 37-pixel outer radii,
conical backplates, actual bores and the shared back-cone involute approximation.
Tooth ends have conical profiles and analytic cap normals. The gate gear's
shorter face now clears the sweeping selector and stud roots. Horizontal shafts
stop inside their hubs, and the output bearing clears the conical backplate.

The complete 183-mesh assembly includes head cheeks, bored arm eyes and pins,
balls, the long bored sleeve, selector shoulder, studs and both horizontal
shafts. Native hinge coordinates drive all moving parts. The visible pin and
stud working faces coincide with their native counterparts throughout a cycle.
Depths, rear cheeks, bearings and stud-root extensions are inferred. The remote
gate and its support are omitted rather than replaced by invented geometry.

## Native contacts and assumptions

Only the spindle is actuated. Arms, lower links, sleeve, loose gears and output
are passive; site constraints close the linkage and ideal equal-ratio joint
constraints represent the bevel meshes. Output angle and engagement are not
prescribed or reset to force a loop. Full-linkage equilibrium sets nominal speed.
Effective masses remain 1 kg per ball, 0.02 kg per link and 0.1 kg for the sleeve,
with gravity 98.1 world units/s². Gear inertias, output friction and damping are
inferred. There is no hydraulic load or water-wheel feedback.

The native collision model now includes the actual gear body hulls and convex
hulls of the individual loose-gear teeth. Filling the 0.155 body bore in a convex
hull is harmless for the selector, whose minimum radius is 0.16. Tooth hulls are
approximations; the separate visible-surface sweep checks their resulting motion.
Explicit sphere/link-stem contact pairs prevent a ball entering its own lower
link at low speed. The collision stem matches the visible width and depth;
effective link mass remains defined by the original lightweight capsule.

These additions address real intersections found in the complete assembly,
including pin/tooth interference and ball/link overlap. Removing the gear
backing and tooth contacts reproduces the former overspeed pass-through; removing
ball contact reproduces sphere/stem overlap in a disconnected-output stress run.
Normal speed variation is now 0.26 rad/s. The 0.32 and 0.5 stress cases retain
all required physical contacts rather than imposing sleeve travel clamps.

## Loop and numerical qualification

The ideal gear constraints now use high impedance. At the default diagnostic
step, maximum gear-ratio error is 0.00003394 radians, more than 20 times smaller
than the former setting. No additional actuator is introduced.

The drive period is 8.4342254 seconds, seven nominal spindle turns. A cold native
run of 64 cycles at period/65536 finds a repeat seam during sustained engagement,
with nonzero output velocity and contacts on both sides. The selected native
position and velocity bounds are 0.00005717 world units and 0.0004271 world
units/s. The loop advances the output by two complete turns; its forward and
reverse travel are not artificially balanced.

The bake restores the qualified native checkpoint, recomputes constraints and
replays the final cycle and lead-in. It independently recovers the same closure.
A smooth C1 correction over the last 0.1 second removes the small numerical
position/velocity residual. This is an explicit approximation, not an exact
periodic solution. Adaptive linear interpolation plus this correction stays
within a conservative 0.00007318-world-unit bound of every native integration
sample (0.0041 engraving pixels). The initial 2.3186-second lead-in preserves a
near-engraving starting pose; subsequent cycles use the qualified driving seam.

## Verification

Twelve tests cover source gear envelopes, bores and pitch velocities; passive
bidirectional pickup; removed-contact and shifted-stud counterfactuals; neutral
equilibrium; overspeed backing and ball/link protection; gear-constraint error;
visible joint/contact alignment; native-to-baked positions; instanced geometry;
repeat phase, bounds and exact restart. Measured serialized ball/pin positions
stay within 0.00002244 world units of the native replay, including the seam.

At exact gear ratios, a 65-pose bevel sweep clears 3,844 mesh pairs. A full
183-mesh native sweep at a stressed 0.32 rad/s speed variation checks 14,216
cross-family pairs and 34,324,512 surface samples. Its only overlap is intended
selector/stud contact, below 0.00000188 world units. The baked sweep checks 129
off-key interpolated times plus four seam poses, with 65,134,128 surface queries
and no detected intersections above 0.000001 world units. These finite sweeps
sample vertices, edge midpoints and triangle centers; they are not a continuous
collision proof. Same-family rigid joins are intentionally excluded. A separate
test verifies that serialized instanced teeth preserve the audited geometry and
transforms within Float32 rounding.

Four-timestep impact refinement gives successive maximum output-angle differences
of 0.02558, 0.01151 and 0.00955 radians. The final pair changes sleeve height by
0.0001379 world units (0.0077 source pixels). Contact response remains a numerical
approximation, and the documented masses, depths and output friction are inferred.

The production build and desktop/mobile Chrome playback test pass. Front,
oblique and mobile screenshots were inspected. Restart is exact, orbit controls
work, the model fits the viewport, and fog and the unrelated ground are disabled.
The build retains the pre-existing large-main-chunk warning.

Evidence and source hashes are in the 162 reports under docs/validation:
native-selector, contact-refinement, repeated-selector, loop-qualification,
bevel-clearance, solid-clearance and baked-clearance. The compressed asset has a
provenance sidecar. Raw trajectories, screenshots and private builds stay outside
Git. Reproduce with:

```sh
node --test tests/water-governor-*.test.mjs
node scripts/review-water-governor-bevels.mjs
node scripts/review-water-governor-solids.mjs
node scripts/probe-water-governor.mjs
node scripts/refine-water-governor.mjs
node scripts/settle-water-governor.mjs
node scripts/qualify-water-governor-loop.mjs
node scripts/bake-water-governor.mjs
node scripts/review-water-governor-baked-solids.mjs
```
