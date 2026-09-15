# Movement 163 — belt-shifting governor review in progress

163 has a 43-mesh source assembly, passive native linkage and a reduced belt
traction model. It is not registered in production yet; repeated-motion
qualification, belt motion cues and a browser bake remain to be completed.

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
coordinates are not prescribed. A 10-second cycle with 0.25 rad/s variation is
the current assembly-check setting. Its final playback timing needs qualification.

The first study treated reaching the upper pulley center as necessary for
selection. Finite belt width makes that condition too strict. At the native
upper travel limit, belt and upper fast pulley overlap by 0.12274 world units
(6.82 source pixels), while part of the belt also contacts the loose pulley.
At the lower limit, the lower fast overlap is 0.28435 (15.80 pixels). At the
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

## Verification and remaining work

Eight tests cover neutral source geometry, passive crank/rod closure, full-load
equilibrium, removed spindle actuation, timestep refinement, finite-width pulley
selection, removed belt friction and visible/native joint alignment. The
20-second 0.25-rad/s probe has maximum connection error 0.000000264 world units
and maximum belt speed 4.54574 world units/s. A four-times-heavier output linkage
needs a lower equilibrium speed, confirming participation of its gravity load.

The visible-solid sweep checks 809 cross-family mesh pairs at 65 native poses
over 20 seconds: 20,183,242 vertex, edge-midpoint and triangle-center queries,
with no detected intersections above 0.000001 world units. Same-family rigid
joins are excluded. This is a finite sampled audit, not a continuous collision
proof. Front, driven and oblique Chrome snapshots were inspected; fog and the
unrelated ground plane are disabled. The private diagnostic is not a packaged
browser integration test.

Next: add a restrained cue for longitudinal belt motion, qualify repeated native
motion and interpolation, bake the visible assembly, and test desktop/mobile
playback before registering it. The full 507-movement review remains active.

Evidence: [native probe](validation/163-native-linkage.json) and
[visible clearance](validation/163-solid-clearance.json), with source hashes.
Raw trajectories and preview snapshots remain in /dev/shm. Reproduce with:

```sh
node --test tests/belt-governor-*.test.mjs
node scripts/probe-belt-governor.mjs
node scripts/review-belt-governor-solids.mjs
```
