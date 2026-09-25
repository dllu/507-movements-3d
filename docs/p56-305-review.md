# Pass 56 · p56-305 lane (Movement 305, Macdowall single-pin escapement)

Files: `src/simulation/authored-single-pin-escapements.js`,
`src/simulation/pin-escapement-working-parts.js` (qualification text only),
`src/data/source-presentation.js` (305 note only), `tests/movement-305.test.mjs`,
`tests/pin-escapement-working-solids.test.mjs`.

## Tracing plate 305

Measured from `public/engravings/mm_305.png` (ink centres, ±2 px):

- The opening is a Z: an upper-left window (x 190–270, y 340–388) and a
  lower-right window (x 259–340, y 370–420) that share a band at the arbor
  (y 370–388). Each has one quarter-circle outer corner (radius about 50 px,
  centred on the band edge) and straight top or bottom, band and neck edges.
  The Z is point-symmetric about (264.5, 381), which is on the pendulum
  centreline (pivot x 264).
- The neck corners are at (270, 370) and (259, 388): upright faces 11 px
  apart, and a band 18 px high.
- The hatched circle in the neck is the pin (17 px across, centre 261, 380).
  The small open ring at (240, 380) is the disc arbor. The disc edge seen in
  both windows and the dashed lower arc fit a circle of radius 34–36 px about
  that ring. So the pin orbit is 21 px (0.274 model units, against 0.075 from
  the 1:60 rule). The feathered mark in the right window is the direction
  arrow, and it is not modelled.

## Mechanism (reworked)

- Pin orbit 0.274, pin radius 0.113 and disc radius 0.47 are all Brown's.
  The escape angle is 3.5°. The pendulum swings ±5.5° (period 4 s, shown over
  at least 6 s).
- The disc arbor stands on the pendulum centreline at the Z's centre of
  symmetry. Brown draws the ring 24 px to the left, but an off-centre arbor
  would put the escapement out of beat.
- Dead faces are arcs about the pivot: the ceiling (right of the neck) has
  radius L − r and the floor (left of the neck) has radius L + r, where
  L = √(D² + e²). The pin locks at exactly 9 or 3 o'clock, pressing up on the
  ceiling or down on the floor. So the lock has zero recoil, and each beat
  turns the disc exactly one half-turn.
- Impulse faces are the upright neck edges x = ±c. The motion law is no longer
  an analytic formula. The disc is driven clockwise, and at every instant it
  turns as far as the actual opening edges allow (a scan followed by
  bisection against the two neck solids). This gives, in order:
  1. The dead rest.
  2. The release, where the pin rolls round the neck corner.
  3. The upright-face impulse.
  4. A short roll down the corner.
  5. The drop onto the opposite dead face.

  Only step 5 is prescribed (5% of a half-beat, a smootherstep); everything
  else is solved against the geometry. All contact through the corner and
  face phases does positive work on the pendulum.
- Landing condition: after leaving the face, the pin must land with its
  centre over the opposite dead face (|x| ≥ c). With Brown's c = 5.5 px
  (0.072), the margin is too small (0.006 at 0.07), so the neck is narrowed to
  c = 0.05 (3.8 px, a 7.7 px gap against Brown's 11). The landing margin is
  then 0.033–0.043.
- Just past the corner, the room the pin has to turn first shrinks by about
  2e-5 rad and then grows, because the corner is not on the pin's radial line.
  The pin is held there, still at its lock radius, until that minimum. So the
  disc never backs up. For up to 0.0013 of travel the pin sits on the corner
  edge rather than on the flat.
- The opening is one clockwise outline: ceiling arc, lower-right quarter
  circle, bottom, lower upright face, floor arc, upper-left quarter circle,
  top, upper upright face. The dead-face arcs run over |x| ≤ 0.22, which
  covers the working range of about 0.16, and then ease to level over 0.2, so
  the band edges read as straight. The old stepped notch and mismatched
  quadrants are gone.
- The pin is now set 0.06 into the disc face, because it no longer sits on the
  arbor end. The arbor end stays as the dark ring at the disc centre.
- Time zero has the pendulum upright, as Brown draws it, in the middle of the
  upper impulse (`geometry.timeOrigin` = half a half-beat).

## Verification

- Captures (`/dev/shm/q305/a2`): the default view, eight phases across the
  cycle (dead rests, corner release, face impulse, drop), oblique, ±60° yaw,
  back, top and a view from below. The disc fills the middle of both windows
  and the ruby pin is clearly visible at every phase. Band edges are straight,
  and no filler or stepped pieces remain. Rotated views show a single
  extruded plate with clean window walls.
- Intersection screen (`show-body-intersections 305 --spacing=0.01
  --samples=129`): before, plate/pin solid 0.0000 at 1.781 (the prescribed
  release corner). After, no pairs.
- Tests:
  - Against the plate mesh, the pin enters the actual plate by at most
    5.7e-6 (the chord sagitta of the arcs). Rest gaps are ≤ 6e-6.
  - The finite corner and face impulse gap is ≤ 1.6e-7 over 548 samples, with
    positive work at every sample.
  - Analytic clearance is ≥ −1e-9 throughout.

## Residuals

- The default pose differs from Brown's picture. Brown shows the pin at
  3 o'clock beside an arbor 24 px left of the centreline with the pendulum
  upright. In the model the arbor is on the centreline, so at the upright
  pendulum the pin is above the arbor, mid-impulse. Brown's arrangement
  appears only at the far swing (floor rest), with the pendulum at about 4.5°.
- The neck gap is 7.7 px against Brown's 11.
- The drop onto the dead face is prescribed, and so is the pendulum's law.
  Forces and the passive dynamics are not solved.
- As before, the disc-arbor bush has no drawn support once the presentation
  removes the undrawn frame. This is visible only from the back.
