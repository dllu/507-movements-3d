# Movement 163 — baked belt-shifting governor

163 now plays a 675,832-byte offline MuJoCo bake with 1,761 adaptive motion keys.
The 43 physical meshes and seven subtle belt seam marks load without browser
physics or collision-mesh generation. The native linkage and reduced belt
traction model remain available for validation.

## Source and reconstruction

The [original page](https://507movements.com/mm_163.html) has no available 2D
animation. A flyball governor moves a cranked lever and belt fork. The central
pulley is loose; the upper and lower pulleys are fast on the spindle. Higher
speed shifts the belt downward and lower speed shifts it upward. The remote
gearing reverses the water-gate action; that gearing is not drawn.

The old implementation prescribes spread from instantaneous point-ball
equilibrium and schedules belt drive windows to balance output travel. It adds
receiver pulleys, bevel gearing, rack and water gate outside the engraving.
The reconstruction includes the source governor, sleeve, crank, rod, frame,
three pulleys and open belt runs. It leaves the remote transmission outside the
model instead of assigning an invented arrangement to it.

Measurements use 0.018 world units per engraving pixel: spindle x259, head y48,
ball radius33, bell pivot (348,343), output pin (466,343), fork (466,470), pulley
planes y449/470/492. Symmetric arm lengths follow the drawn ball and elbow
centers; the sleeve center is y245. Pulley faces are 16 pixels wide and the flat
belt is 18 pixels wide. The U frame sits in front of the belt, as drawn.

Depths, masses and fork/groove construction are inferred. Two crank cheeks
straddle the sleeve and engage annular-groove shoes through bored pins. The
0.40-radius groove flanges are wider than the indistinct engraved collar, to
retain the shoes throughout the measured radial travel. A 0.24 axial gap admits
the tilting crank toe and 0.115-radius shoes. The toe's short horizontal portion
clears the lower flange before turning into the source-shaped curved arm.
The head, sleeve and rod joints have actual bores and pins.

## Native dynamics and finite belt engagement

Only spindle rotation is actuated. Flyball arms, lower links, rotating sleeve,
nonrotating collar, crank, connecting rod and vertically guided belt fork are
passive. Ideal constraints represent the collar bearing and a fork sliding
radially in a horizontal annular groove. The tip follows its circular path
while transmitting vertical sleeve motion. Ball/lower-link contact remains
active; no joint or sleeve travel is clamped to manufacture selection.

The equilibrium speed includes the rotating linkage and gravity load of the
collar, crank, rod and fork. With inferred light link masses it is 5.1233362
rad/s. A sinusoidal speed variation produces the motion; sleeve, crank and fork
coordinates are not prescribed. The diagnostic assembly checks use a 10-second cycle and 0.25 rad/s variation.
The final bake uses 9.811084 seconds, eight nominal spindle revolutions, with
the same speed variation. Each spindle revolution takes about 1.23 seconds.

The first study treated reaching the upper pulley center as necessary for
selection. Finite belt width makes that condition too strict. In the settled baked cycle, the maximum upper fast-pulley overlap is 0.09824
world units (5.46 source pixels), while part of the belt also contacts the loose
pulley. The maximum lower fast overlap is 0.22304 (12.39 pixels). At the
engraved neutral pose only the middle pulley contacts the belt. The belt never
overlaps both fast pulleys at once. Thus partial engagement supports the source
function without moving its pulley planes or bypassing ball/link contacts.

Belt transport and middle-pulley rotation are passive native degrees of freedom.
A reduced regularized Coulomb law uses instantaneous axial overlap and tangential
slip to apply equal-and-opposite belt/pulley forces. Inferred parameters are
friction coefficient 0.35, full-width normal force 10, equivalent belt mass 0.05,
load friction 0.1 and tangential slip regularization 0.05 world units/s. The native
solver integrates transport, middle-pulley rotation and reaction on the spindle.
Removing friction leaves transport at rest while the governor still shifts.

This is a reduced transmission model, not a simulated flexible belt. The belt's
axial shape follows the fork; bending, sag, tension dynamics and axial shifting
friction are omitted. Native fork mass accounts for an inferred lightweight
shifter. The visible belt has a 0.0002 radial clearance from the polygonal pulley
surfaces (0.011 source pixels). Traction is supplied by the explicit reduced law,
not by triangle collisions. Remote gearing and hydraulic feedback remain absent.

## Settling, interpolation and playback

The native governor still had residual oscillation after 32 cycles. After 128,
corresponding states across the final two cycles agree within 3.23e-8 in joint
position and 9.05e-8 in velocity. The selected start is within 0.000222 radians
of the engraved neutral spread. An arbitrary constant spindle phase aligns the
initial front view; the native mechanism and its loads are invariant under this
rotation about the vertical axis.

The baker restores the native checkpoint, advances to the selected phase and
replays one complete cycle. Its conservative visible-position closure bound is
1.51e-7 world units and velocity closure bound is 3.94e-8 world units/s. Native
samples are unchanged: there is no seam blending, endpoint snapping or forced
travel balance. The loose pulley advances by 43.95998 radians and the belt by
37.23668 world units per cycle, retaining their measured motion.

Adaptive linear interpolation stays within a 0.00001961-world-unit displacement
bound of all 65,537 native ticks (0.0011 engraving pixels). The bound includes
tessellated loose-pulley rotation and belt marks. The repeated seam marks are a
visual aid with spacing chosen from measured cycle travel; belt speed is not
changed to make the pattern repeat. Marks enter and leave at the cut ends of
the depicted runs, where the unseen remote belt path would continue.

## Verification

Eleven tests cover source geometry, passive linkage closure, full-load equilibrium,
removed spindle actuation, timestep refinement, finite-width selection, removed
belt friction, visible/native joint alignment, serialized geometry, interpolated
native positions, bounds, repeated phases, seam continuity and exact restart.
The serialized balls and fork stay within 0.00000372 world units of native replay.
The JSON round-trip test caught and fixed a full-Euler-rotation reset needed for
belt marks restored from serialized quaternions.

The cold native visible-solid sweep checks 1,061 cross-family pairs at 65 poses
over 20 seconds: 20,710,192 surface queries, with no detected intersections above
0.000001 world units. The final baked sweep checks 1,103 pairs at 129 off-key
times plus four endpoint/seam poses: 40,079,650 queries, also clear. Same-family
rigid joins are excluded. These finite vertex, edge-midpoint and triangle-center
sweeps are not continuous collision proofs. Serialized positions, triangle indices
and transforms match the audited source solids, with signed zero normalized by JSON.

The production build and packaged desktop/mobile Chrome test pass. The latter
checks visible playback, restart, orbit controls, responsive layout, absence of
browser errors and no WASM loading. Source, moving, oblique and mobile screenshots
were inspected. Fog and the unrelated ground are disabled. Thin belt and pulley faces do not
receive shadows, avoiding shadow-map acne; belt seam marks do not cast shadows.
The build retains the
pre-existing large-main-chunk warning.

Evidence: native-linkage, loop-qualification, solid-clearance and baked-clearance
reports under docs/validation, plus the compressed asset's provenance sidecar.
Raw trajectories, previews and private builds remain in /dev/shm. Reproduce with:

```sh
node --test tests/belt-governor-*.test.mjs
node scripts/probe-belt-governor.mjs
node scripts/review-belt-governor-solids.mjs
node scripts/qualify-belt-governor-loop.mjs
node scripts/bake-belt-governor.mjs
node scripts/review-belt-governor-baked-solids.mjs
```

Continue at 164; the full 507-movement review remains active.
