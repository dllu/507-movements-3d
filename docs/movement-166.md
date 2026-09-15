# Movement 166 — slotted brick-press drive

166 now uses twelve finite meshes and analytic lost-motion kinematics. The
crank pin traverses a real capsule slot, and the output pin passes through a
bored rod eye. One revolution takes four seconds, including two held-output
dwells. No live physics engine or bake is needed for this ideal geometric model.

## Source and geometry

The [original page](https://507movements.com/mm_166.html) provides a 2D animation
and explains that the slide was added to illustrate the lost motion. The model
keeps that extended output slide and simple guides, while removing the earlier
large added support frame, crank arm and solid orbit/index decorations. The
engraved orbit is a dashed construction line. The disk has a continuous solid
rim, rather than a detached torus. Ground and fog are disabled.

The engraving gives an approximately 203-pixel disk radius about the shaft near
(228,274), and a crank pin near (141,221). The initial crank pose matches that
measured pin center. The slot's two rounded-end centers are approximately
44 pixels apart; the outer head and rod widths follow the drawing. The original
rod is shown only partway to the output joint; its continuation and crosshead
follow the later animation. Axial depths, bearings, guide dimensions and the
output-eye connection are inferred.

A 0.004-world-unit transverse pin fit is included in the end-distance geometry.
The slot hole is conservatively circumscribed when polygonized, so its facets
do not intrude into the ideal working pin. The pin heads sit in front of the
rod face. The disk/hub and both moving pin joints have actual bores.

## Motion and oracle comparison

During each working stroke, ordinary slider-crank closure uses one of the two
slot-end distances. After reversal, an ideal resisting load holds the slide
while the crank pin traverses the available slot length. The next stroke starts
when it reaches the opposite end. Position is continuous at all handoffs;
impact forces, compliance and inertia are outside this ideal model.

The original animation is executed with its own library at 721 phases. With
its crank radius 5.5 and end distances 25/28, our independently written closure
agrees within 7.11e-15 animation units. Its drawing code is not copied into the
new geometry, and temporary source downloads stay in `/dev/shm`.

The production geometry uses the engraving's narrower slot rather than the
later animation's three-unit clearance. Consequently total dwell occupies
31.3338% of a revolution, compared with 35.3632% for the animation's dimensions.
At the four-second display period, the right and left dwells last approximately
0.572 and 0.682 seconds. The output stroke is 2.38817 world units. These are
explicit reconstruction differences, not claims that the two parameter sets
have identical timing.

## Validation

The legacy selected-contact audit found crank-pin intrusion of 0.01402 world
units into both beveled slot meshes and output-pin intrusion of 0.143 into the
undrilled rod. Those objects remain available only as historical diagnostics.

The replacement's 129-pose, 50-pair actual-solid sweep makes 4,437,342 bidirectional
vertex, edge-midpoint and triangle-center queries and finds no sampled
cross-body overlap above 1e-6 world units. Same rigid-body joins and the dashed
construction line are excluded. Three tests cover pin containment, both dwells,
continuous handoffs, source initial position and periodicity. The production
build and packaged Chrome desktop/mobile test pass, including motion, exact
restart, orbit/reset view, no WASM request and no horizontal mobile overflow.
Screenshots and browser artifacts remain in `/dev/shm/166-*`.

Evidence: [legacy pin intersections](validation/166-existing-contact.json),
[executed oracle comparison](validation/166-oracle-comparison.json),
[replacement solid clearance](validation/166-solid-clearance.json), and
[packaged browser checks](validation/166-browser.json).

```sh
node scripts/review-lost-motion-existing.mjs
node scripts/compare-lost-motion-oracle.mjs
node scripts/review-lost-motion-solids.mjs
node --test tests/lost-motion-brick-press.test.mjs
```

The full 507-movement review remains active. Next source review: 167.
