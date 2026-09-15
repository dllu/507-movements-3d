# Movement 162 — water-wheel governor review in progress

162 remains unregistered. Production still uses the authored threshold-based
animation; the reconstructed assembly and native dynamics are candidates.

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

The complete 183-mesh candidate includes head cheeks, bored arm eyes and pins,
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

## Verification and remaining work

Eight tests cover the source gear envelopes, bores, pitch velocities, native
bidirectional pickup, removed-contact and shifted-stud counterfactuals, neutral
equilibrium, overspeed backing protection, ball/link contact, native clock
continuity and visible joint/contact-face alignment. Front and oblique Chrome
views of the full assembly were inspected; fog and the unrelated ground plane
are disabled.

At exact gear ratios, a 65-pose bevel sweep clears 3,844 mesh pairs. The full
assembly sweep uses 65 poses over eight native seconds with 0.32 rad/s speed
variation, above the normal setting. It checks 14,216 cross-family pairs and
34,306,988 surface samples, including native gear-constraint error. The only
sampled overlap is at the intended pin/stud contacts, below 0.000003 world units
(0.00017 source pixels). All other intersections fail the checker. Same-family
rigid joins, such as arm stems in balls and stud roots in gear bodies, are
intentional.

Four-timestep refinement gives successive maximum output-angle differences of
0.01019, 0.00864 and 0.00869 radians. The final pair changes sleeve height by
0.000152 world units (0.0085 source pixels). Repeated-cycle checks use an
8.4342254-second period and 64 cycles at each of two timesteps. Both runs retain
reversal in their final eight cycles. At the finer timestep, internal-coordinate
closure is below 0.000041 and output phase closure below 0.00382 radians, but
these are not exact seams. Impact refinement and a mechanically valid bake
remain open; no phase snapping or false repeating trajectory is registered.

Evidence and source hashes are in `docs/validation/162-native-selector.json`,
`162-contact-refinement.json`, `162-repeated-selector.json`,
`162-bevel-clearance.json` and `162-solid-clearance.json`. Raw trajectories and
screenshots remain outside Git. Reproduce with:

```sh
node --test tests/water-governor-*.test.mjs
node scripts/review-water-governor-bevels.mjs
node scripts/review-water-governor-solids.mjs
node scripts/probe-water-governor.mjs
node scripts/refine-water-governor.mjs
node scripts/settle-water-governor.mjs
```

Next work is tightening/qualifying the ideal gear constraints and repeated
contact response, then baking, registering and testing browser playback.
