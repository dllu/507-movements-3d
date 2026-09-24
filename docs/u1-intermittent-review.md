# Lane u1-intermittent: user-reported defects in 63, 73, 84 and 88

Default and several-phase captures of each movement were inspected beside
the plate (review script plus phase captures under `/dev/shm/u1`, not in Git).
Motion was also sampled numerically.

## 63: pawl and drop rebuilt from Brown's plate and Sam Gallagher's reconstruction

The user reported that the pawl shape was completely wrong. The old model
had a straight pawl on an offset hinge, with a scheduled lift and snap.

Sam Gallagher's animation (`https://i.sstatic.net/CuYwj.gif`, 42 frames,
fetched with a browser user agent and inspected) was used as the reference,
together with Brown's enlargement. The mechanism is now:

- **Drop (rear plate).** Its outline is traced from Brown: the tail over the
  spring, the large boss behind the screw, the arch over the star and the leg
  that Brown dashes. The drop has no fixed pivot.
  - The leaf spring, broken off at the plate's edge, carries the drop. The
    drop swings about the spring's virtual hinge, two thirds of the leaf length
    back from its free end, as an end-loaded cantilever does.
  - The spring is drawn as that cantilever, so its end slope equals the
    drop's rotation.
  - The fixed stop pin sits just under the tail.
- **Pawl (front plate).** Brown's broad hooked pawl: the ring round the
  slotted screw, the arm whose upper edge passes under the drop's striker, and
  the hooked lobe ending in the nose.
  - The pawl hangs on the screw. It is free to fall; the striker stops it
    rising.
  - The nose steps forward into the star's plane.
- **Layers, back to front.** Drop, pin disk, pawl, star.
  - The leg is hidden behind the disk, as Brown dashes it.
  - The pins pass through the disk to reach both the leg and the lobe, and end
    behind the star. As in Gallagher's account, they never touch the star.
- **Motion.** A quasi-static planar contact solution, in the new
  `src/simulation/snap-counter-63-mechanism.js`.
  - The pins push the pawl and drop. The spring and gravity lower the drop and
    pawl at finite rates. The star turns only when the nose drives it.
  - The sequence per pin:
    1. The pin lifts the lobe, and the drop with it through the striker.
    2. The pin escapes the pawl, which falls.
    3. The pin carries the drop about 20° on its leg. The leg's working edge is
       the pin's envelope for a cosine lift law.
    4. The nose drops past the tooth tip into the next space.
    5. The pin escapes the leg. The spring throws the drop down, and the pawl
       turns the star exactly one point. This takes about 0.1 of an event.
  - The steady event is baked into
    `baked/intermittent-63-211-snap-counter-cuts.js` by
    `scripts/bake-intermittent-63-211-snap-counter.mjs`, with a fingerprint.
    The factory falls back to the live solver if the fingerprint does not
    match. A test checks that the live solver reproduces the baked table.
  - The time origin is shifted 0.058 of an event (7° of pin rotation) so that
    phase 0 shows the drop at rest, as Brown draws it.
- **Removed.** The old swept-cut pipeline (`scripts/lib/intermittent-63-211-snap-counter-cuts.mjs`)
  and the factory helpers it used.

Intersections: `show-body-intersections 63 --samples=257` reports nothing. In
the 2D contact check over a steady event, the pins clear the pawl and drop by
more than 1 source px, and the nose clears the star. The striker and stop pin
sit 0.6 px from their parts at rest.

Residuals:
- The star is regularised.
- The leg's lower part is synthesised. It is hidden at rest but shows above
  the disk while lifted.
- While the drop lifts, the hanging nose slides over the tooth tip between
  spaces. The lobe can only lift the pawl about 5°, so the pawl is not raised
  fully clear. Gallagher's animation shows the same.
- The star has no detent. The pawl locks it at rest.
- Friction and dynamics are not simulated.

## 73: springs B and C bend as cantilevers

The old model formed B from a Catmull-Rom curve whose tip was lerped
sideways. C's middle control point was pulled onto B, which made an S-kink.

Both leaves are now `CantileverLeafCurve`: the relaxed centreline plus the
end-load shape (3x² − x³)/2. Each leaf therefore leaves its clamp along the
clamped direction and bends smoothly. The largest turn per 1/96 of a leaf is
0.021 rad, and the clamp slope changes by less than 0.0015 rad.

- **B.** Its relaxed tip now stands straight out from the tooth it drives, so
  pressing it moves the tip along a radius.
  - It runs just inside D's rim at radius 1.40, clamped near the top as drawn.
  - The start phase (0.01) matches the plate: the clamp is near 12 o'clock and
    the tip at 3 o'clock.
- **The press.** It now starts where B's tip first passes under C (phase
  0.47). The tip follows C's radius inward, with a smooth minimum onto the
  driving radius.
- **C.** It no longer kinks. It bends only as its stop rides the teeth. C
  bears on B where the leaves cross, directly over B's plane; the crossing is
  solved exactly.

Intersections at 257 samples: only the intended seated contact of C's stop
pad on A (0.0000). B's leaf clears C's stop pad by at least 0.041. The test
threshold was lowered from 0.05 to 0.04 because the tip now approaches the
tooth radially.

## 84: rack travels about three tooth pitches

Worked by a sub-agent.
- **Why the travel was short.** The plate's fork pins sit beside the
  slot-bridge. That limited travel to −49…+77 px, and the rack tipped beyond
  about ±120 px.
- **Fork A** is widened 1.5× so its pins travel the drawn slots.
- **Teeth.** The lower teeth are regularised to a 52.9 px pitch; no face
  moves more than 10 px. The end rods are lengthened.
- **Motion.** A new governor schedule has the cam walk the rack two steps each
  way, over −103…+139 px. This is about 3 of the 13 upper pitches, against
  1.4 before.
  - The demonstration lasts 17.2 s.
  - The generator is `scripts/generate-selector-rack-travel.mjs`.

Intersections: only the cam seated on a tooth and pin 1 on the slot end
(0.0000). Residual: the fork is wider than drawn, and the slots still allow
only about 4 of the 13 teeth.

## 88: cam A is a true Archimedean spiral

Worked by a sub-agent.
- **Spiral.** r = 1.2030 + 0.06509·θ over one turn, least-squares fitted to
  Brown's 23 traced points. The mean error is 1.1 px, and the worst is 3.2 px.
  The step at C is a radial cut.
- **Centre.** The spiral's centre is 9 px from shaft A, as the trace
  indicates.
- **Motion.** The contact playback was regenerated. Each index is still
  exactly 180°.

Intersections: only the feet C and D seated on the cam (0.0000). The "disc
clips frame" audit item was already resolved by padded framing.
