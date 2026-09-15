# Movement 163 — belt-shifting governor review in progress

163 is not replaced in production yet. The new native model is a linkage study,
not a qualified belt transmission or complete visible reconstruction.

## Source and current defects

The [original page](https://507movements.com/mm_163.html) has no available 2D
animation. A flyball governor moves a cranked lever and belt fork. The central
pulley is loose; the upper and lower pulleys are fast on the spindle. Higher
speed shifts the belt downward and lower speed shifts it upward. The remote
gearing reverses the water-gate action; that gearing is not drawn.

The old implementation prescribes spread from instantaneous point-ball
equilibrium, uses a rotating slot at the crank input, and schedules belt drive
windows to balance output travel. It adds receiver pulleys, bevel gearing, rack
and water gate outside the engraving. Those additions cannot establish source
fidelity or passive governor correctness.

Measurements in the new geometry use 0.018 world units per engraving pixel:
spindle x259, head y48, ball radius33, bell pivot (348,343), output pin
(466,343), fork (466,470), pulley planes y449/470/492. Symmetric arm lengths
are inferred from the drawn ball and elbow centers. The measured sleeve center
is y245. Depths, masses and detailed fork/groove contact are not specified by
the engraving and remain reconstruction assumptions.

## Native study

Only spindle rotation is actuated. Flyball arms, lower links, rotating sleeve,
nonrotating collar, crank, connecting rod and vertically guided belt fork are
passive. Ideal constraints represent the collar bearing and a fork that slides
radially in a horizontal annular groove. Unlike a slot attached to the crank,
this allows the tip to follow its circular path while transmitting vertical
sleeve motion. The study currently places the tip on the spindle centerline at
neutral; the final fork contact location still needs source/clearance review.

The equilibrium speed includes the complete rotating linkage and the gravity
load of the collar, crank, rod and fork. With inferred light link masses it is
5.1233362 rad/s. A single sinusoidal speed variation produces the motion; no
sleeve, crank or belt-fork coordinate is prescribed. The 10-second drive period
and 0.15 rad/s variation are diagnostic settings, not a final animation choice.

Five tests verify source neutral closure, crank/rod geometry throughout native
motion, full-linkage static equilibrium, gravitational motion after removing
the spindle actuator, and timestep refinement. The 20-second default probe has
maximum connection error below 0.00000022 world units; the neutral spread stays
within 0.000000017 radians. A four-times-heavier output linkage needs a lower
nominal speed, confirming that its load participates in the equilibrium.

## Open travel and solid geometry issues

The diagnostic fork does not yet reach the upper pulley. The source upper plane
is -2.718 world units. At 0.4 rad/s speed variation, the straight lower-link
collision stems limit upward fork travel to -2.90065. Removing ball/stem contact
lets it reach -2.84502, exposing a real depth/clearance issue rather than a
speed-timing issue. More speed variation also overshoots the lower pulley.

Even with zero governor spread and no collision restriction, this centerline
crank-tip construction reaches only -2.77089, short of the upper plane. Thus
removing collisions or increasing speed cannot fix the reconstruction. The
input contact radius and out-of-plane arm/ball/link placement must be resolved
against the engraving before choosing the operating range. The ideal radial
slide currently has unlimited travel; a finite groove will also need clearance
checks. These shortcomings are intentionally not hidden by relocating the
source pulley planes or clamping the fork.

Next work: reconstruct the sleeve groove and cranked fork with enough physically
valid travel, complete the visible solids and belt/pulley contact model, then
qualify and bake the motion. Remote gate/gearing and hydraulic feedback remain
outside the drawing. No browser model has been registered from this study.

Evidence: [native probe](validation/163-native-linkage.json), including source
hashes, cold runs, load and actuator counterfactuals, and zero-spread reach.
Raw trajectories remain in /dev/shm. Reproduce with:

```sh
node --test tests/belt-governor-physics.test.mjs
node scripts/probe-belt-governor.mjs
```
