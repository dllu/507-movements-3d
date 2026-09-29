# Pass 110, lane a: movement 73's spring C

The user said: "The spring in 73 behaves very unrealistically. It also doesn't need its depth component. The whole thing can bend out of the way."

## Plate and caption

- **Plate.** C is one gentle leaf. It rises from the hatched block, bends concave towards A, and its end enters a tooth space at about 141°. It heads clockwise, nearly along the tangent, not hooked inwards. C's centre line, read at 3x (radius as a fraction of A's crest radius), is: 205° 1.68, 188.5° 1.37, 173° 1.16, 155° 0.99, 141° about 0.89.
- **Caption.** B passes under C, and C presses B into a tooth of A. B is released "on its escape from" C. C serves as a stop.

## What was wrong

- **Depth layers.** C had a deep web reaching back to B's nib and a thin end in A's front half. The nib escaped by passing under C's end, which is a depth trick.
- **Shape and motion.** C's end was a tight J-hook. Its motion was a scripted propped-beam shape plus a 0.1 s cosine drop.

## Change

New module `src/simulation/spring-index-073-leaf.js`, the factory in `authored-intermittent-core.js`, a bake in `src/simulation/baked/spring-index-073-leaf.js`, and the script `scripts/bake-spring-index-073-leaf.mjs`.

### C's shape

- C is one flat leaf of constant section: half-width 0.035, z from 0 to 0.16, with its round end on the band.
- Its drawn shape is one circular arc from the block's corner to the seat, fitted to the plate points. The arc has radius 1.80 and fits with RMS 0.019.
- The seat is the corner of a tooth space: the pad touches both the working face and the next tooth's back.

### Planes

- A, C and B's nib share one plane. The nib reaches from B's leaf (z −0.19 to −0.07) forward to 0.15.
- B's leaf and clamp still pass under C and behind A, as the caption says.

### Simulation

C, the nib and A are simulated together; D is kinematic.

- **C** is an inextensible elastic rod. Each segment of the drawn centre line is turned by a rotation field made of four uniform-cantilever mode slopes, so the leaf keeps its length exactly (2.004354). Mass and bending-stiffness matrices are integrated along the drawn curve.
  - First mode: 3 Hz, damping ratio 0.45.
  - C is preloaded 0.04 into A.
- **B's nib** rides a radial spring with a quarter of C's tip stiffness (4 Hz, damping ratio 0.4). It translates radially, like the old guided leaf.
- **A** turns on viscous bearings.
- **Contacts** are frictionless and one-sided, in both directions between C's round-ended band, the nib's outline and A's profile. They are solved by projected Gauss–Seidel on an implicit-Euler step (dt 1 ms).
- **Replay.** The simulation runs once through the nib's pass, from 190° to 80°, and records every 4 ms.
  - Outside the pass everything rests. The remaining difference from rest at the end of the pass is below 1e-7 and is blended out.
  - The bake is fingerprinted (configuration, parameters and solver revision). The live simulation is the fallback and is used for validation (about 0.8 s).

### Resulting sequence (emergent, not scripted)

1. C's edge presses the nib down the next tooth's back into the tooth space. The nib reaches radius 0.921, which puts its inner edge 0.16 below the crest.
2. The nib drives the tooth face.
3. At C's end the nib lifts C bodily out of its way. C's end rises 0.19 and rides over the tooth and the nib.
4. C's end drops in behind the nib, and B springs out. A has overshot the tooth by about 7°.
5. C's preload then seats A back until C's end is in the corner of the tooth space: the click's detent action.
6. Net result: exactly one tooth per turn of D.

## Verification

### Clearances in plan

Sampled at 6000 points per turn of D, and at 2400 points across the pass in the test. The worst overlaps are:

| Pair | Worst overlap |
| --- | --- |
| C–A | 0.00005 |
| C–nib | 0.0001 (interpolation of the 4 ms replay) |
| nib–A | 0.00005 |

### Continuity

Sampled at 20000 points per turn:

- C's end moves at 2.5 units/s at most (the drop).
- The nib moves at 3 units/s at most.
- A turns at 1.3 times D's rate at most, during the seating.
- The turn closes on itself exactly, one tooth on.

### Bending

- At full lift, C's curvature change is largest at the clamp and falls steadily to about zero at the free end. It follows the moment of a load near the end.
- The largest second difference of turning is 3e-7, so there are no kinks.

### Screens (73)

- Body intersections: worst 0.0000.
- Disconnected parts: 0 detached. The one near miss is the unchanged shaft in A's hub bore.
- Coincident faces: 0.
- Loop seams: 0.

### Captures

In `/dev/shm/p110/a/after/`:

- `plate-before-after.png`: the plate, before and after, in the default view.
- `views.png`: default, yaw ±40 / pitch ±25 and side views, at rest and at phase 0.65.
- `pass.png`: 16 phases through the pass, head-on.
- `pass3.png`: a close-up of the drop.

### Tests

- `tests/movement-073.test.mjs` (7 tests, rewritten):
  - one plane and constant section
  - dense clearances and the sequence
  - continuity
  - clamp-maximum curvature and no stretch
  - the arc fit
  - the bake matches the live simulation
- The movement 73 test in `tests/models.test.mjs` (rewritten).

## Residuals

- A overshoots by about 7° and is seated back by C in about 0.15 s. This is physical click behaviour, not a fault.
- D is kinematic. Contacts are frictionless. The stiffness, damping and preload values are reconstruction choices.
- C's rod model is linear in its four modal amplitudes. The deflections are small (0.19 on a 2.0 leaf), and the rotation field is integrated exactly.
- B's nib is still a square-ended block at the end of B's leaf. The nib is 0.08 long; it was 0.11.
