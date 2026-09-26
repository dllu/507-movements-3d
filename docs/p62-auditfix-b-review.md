# Pass 62, lane p62-auditfix-b: 238, 264, 297, 304, 313

Audit findings are from `/dev/shm/audit62/b/findings.json`. Each fix was
checked against `public/engravings/mm_NNN.png`, then recaptured on a private
server: default, ±60° about the vertical, back and top views, several motion
phases, and `review-movement-source-views` default and oblique views.

## 238: B is a plain square step

- **Finding:** B was a rounded knob with a small stepped ledge. The knob came
  from the rear layer's convex-hull web (a 0.28 disc at the strap). The ledge
  came from the swept-star carve beside the face, plus the uncarved rear
  layer showing in the notch.
- **Plate:** B is the anchor's straight left edge, a straight top on which the
  star rests, and a straight inner edge square to the top.
- **Fix** (`seven-tooth-238-working-parts.js`): both anchor layers are trimmed
  to that step.
  - Nothing is left above the corner–root–tip top line.
  - A straight edge runs square to the face from its tip down to the swept
    notch floor. Its depth is found where that edge re-enters the baked swept
    region (0.413).
  - In the notch, the rear layer takes the same swept floor as the front
    layer, so the anchor reads as one plate.
- **Rebake:** not needed. The star sweep's inputs (star, kinematics and the
  hashed sources) are unchanged.
- **Intersections:** the screen shows only the existing zero-depth working
  contact at B, before and after.
- **Tests:** the 238 working-parts, contact and movement tests pass. The face
  seat test needed the step edge exactly at the face tip.

## 264: loop seam

- **Finding:** the loop checker reports a 0.52% worm jump and a 15.4 velocity
  kink at the loop.
- **Measured:** the loop already closes on an exact whole beat: 10,100 worm
  turns, 101 turns of the 100-tooth wheel and 100 of the 101-tooth wheel in
  202 s. `pose(0) == pose(202) == pose(404)` exactly. The pose difference
  across t = P ± ε scales linearly with ε (5.3e-4, 5.3e-6 and 5.3e-8 at
  ε = 1e-5, 1e-7 and 1e-9), which is steady motion, not a jump.
- **Why the checker flags it:** its fixed bracket is 1e-6·P. For any worm
  speed, that bracket spans 2e-6 × 10,100 turns = 0.127 rad of worm rotation.
  The number of worm turns per beat is fixed by the lcm of the two wheels, so
  no whole-beat period can be clean under this bracket. The kink comes from
  normalising the worm's true speed by an aliased sweep peak, and it is
  already classed mechanical.
- **Result:** no production change. 264 stays on the loop-seam allowlist with
  its existing, accurate reason. Removing it would need the checker's bracket
  to scale with the fastest part's period, which is outside this lane.

## 297: arm A behind the wheel

- **Plate:** Brown dashes arm A and its pivot behind the wheel and shows the
  pallets working the pins. The arm cannot run between two end discs: from its
  pivot outside the rim (r ≈ 4.2) to C inside the pin circle (r ≈ 1.25–1.5),
  it crosses the 2.38 trundle orbit, which the pins sweep continuously. A rear
  plate would also block the bars.
- **Fix** (`authored-lantern-escapements.js`, `lantern-finite-playback-parts.js`,
  `lantern-pallet-contact.js`):
  - One plain bored front disc remains. The rear disc and rear hub are
    removed.
  - The eight pins run from flush with the disc face (+0.005) back 0.68 to
    z = 0.10.
  - B and C are bars from z = 0.54, short of the disc, back into arm A, which
    is one plate at z = −0.20…0.02 behind the pin ends.
  - The disc uses the shared see-through style, so the arm and pallets read
    as Brown's dashed arm and solid pallets.
  - The pivot hub and arbor are shortened to the arm layer.
  - The wheel arbor runs from just in front of the hub to z = −0.40.
- **Motion:** the XY contact geometry and the baked MuJoCo motion are
  unchanged. `generate-lantern-escapement-motion.mjs --check` passes.
- **Intersections:** none, before and after.
- **Faces:** zfight count 3 → 1. The one left is the coincident arm/hub bore,
  hidden by the arbor.
- **Tests:** rewritten for the new layout: one see-through disc, flush pin
  ends, bars short of the disc, and the arm behind the pins.
- **Residual:** the pivot hub shows speckled radial streaking in the default
  view. This was already present and looks like the quadrant cue on the small
  hub, not z-fighting.

## 304: two pin forms, short pins

- **Plate:** A pins (left) are half-rounds, their flat trailing side along
  the radius. B pins (right) are thin slanted slips, nearly radial.
- **Fix** (`authored-stud-escapements.js`):
  - B is now the circular segment of the A outline that carries every pallet
    contact (arc −147°…−48° with a 6° margin, closed by its chord). It is a
    thin, nearly radial slip with the exact working arc.
  - Pins in the right half at the source pose are B and those in the left
    half are A, as drawn.
  - The pins now stand 0.34 out of the wheel face (the rim's thickness)
    instead of 0.66. The pallet bits are 0.20 deep, and the plate and collet
    follow.
  - The pallets are still carved by the A outline, which contains B.
- **Intersections:** clear, before and after.
- **Tests:** the 304 tests pass. The B role text changed from "trapezoidal" to
  "slip".

## 313: timing and wheel proportions

- **Timing:** the finding's 0.5 s is the authored physical period (4
  vibrations/s). In the viewer, `applyDisplayTiming` gives
  `playbackTimeScale` 0.125, so one cycle takes 4 s and each beat 2 s, which
  already meets "beat ≥ 1–2 s". The authored period is not changed: the
  display profile is measured in authored time, and changing it would
  mis-scale the speed caps.
- **Wheel, measured on the plate:** window radius 120 px, tooth roots 147 px,
  tips 178 px, crossings 19–23 px, window corners at the crossings 24 px from
  the centre.
- **Wheel fix:**

  | Measure | Before | After |
  |---------|--------|-------|
  | Tooth roots (× tip radius) | 0.77 | 0.82 |
  | Crown (× tip radius) | 0.86 | 0.89 |
  | Window radius (× root radius) | 0.84 | 0.82 |
  | Crossing width (× window radius) | 0.164 | 0.19 |
  | Hub fillet (× window radius) | 0.10 | 0.17 |

  The result is Brown's broad cross and wider rim, still one filleted
  `spoked-wheel.js` plate.
- **Intersections:** clear. The free-escapement solids and chronometer
  tests pass, including the impulse and lock working gaps.
