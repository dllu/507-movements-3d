# Pass-51 wave-5 lane w5a: gears and intermittent residuals

Scope: 3, 194, 195, 196, 198, 206, 208, 214, 215, 216, 218, 219, 227, 228.
I captured each movement before and after the changes with
`scripts/review-movement-source-views.mjs` on a private non-watching dev
server. Intersections come from
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.

## Changes

- 3: the 0.131 belt/rim "torus" pair was a real mesh defect, though it was
  never a penetration. `contactWidthDirection` in `authored-belts.js` negated
  a free leaf's end axis but not the next wrap's axis. The ribbon frame
  therefore flipped 180° across one section at the drum (segment 93) and one
  at the driven pulley (segment 218), and those sections were drawn as
  crossed (bow-tie) quads. The screen's single-ray inside test hit the crossed
  quad on its diagonal, so it read a rim point 0.126 away from the belt as
  inside it. Five other ray directions found no hits. The contact axes are now
  signed consistently around the loop, falling back to the raw axes only for
  an odd half-twist. Both flips are gone, and the screen shows only
  belt-on-drum seating: 0.0021 and 0.0011. Movement 4, the other user, has no
  sign change and is unaffected.
- 194: the universal joint no longer overlaps itself.
  - The ring lies across the shafts, and the trunnion stubs run tangentially,
    square to the plane the slip shaft leans in. The pinion stays on the fixed
    radial guide line, so the shaft only leans in that plane.
  - The rear shaft starts above the ring.
  - The slip shaft seats on the yoke ball's surface, and its own joint balls
    are hidden.
  - The pinion shaft stops under the ball.
  - The rim bead is sunk 0.05 so it stays under the pinion's lower face. This
    was a real 0.021 pinion/rim overlap that the screen had classed as
    "fluid" because of the word "envelope" in the role.
  - Presentation now also removes the pitch-circle line and the whole joint.
    Brown draws free pins and a plain pinion bore, and the joint would stand
    end-on in front of the pinion. The factory still builds the joint.

  Worst depth 0.083 → clear, in both the factory and the presented model.
- 198: the front cross-tie's end mounts rose through the rod plane at the
  tie's ends. Brown draws the rods passing under the strip ends. The mounts
  are now 0.08 × 0.065 posts standing on the rack's root rail. Their
  carrier-local y is 1.08–1.145: just outside the pinion's tip path (1.075)
  and inside the rods' sweep, whose centreline comes no nearer than 1.22.
  0.075 → clear. This is only visible obliquely.
- 206: the pawl bands now stay broad to square-cut ends. The nose taper is
  3% of the length, down from 16%, through a new `noseLength` option; the
  default is unchanged for the other callers. The band half-width is 0.14,
  up from 0.115. The bands sit above the ratchet (z ≥ 0.235), so the screen
  stays clear.
- 219: playback now starts at the plate's pose, input travel 260° past the
  nearest-radius reference. Brown's broad bar (the web slot here, from the
  arbor through the geometric centre) points to the far left, and the pinion
  meets the rim at the far right. The raster centre/arbor offset in the
  source reference puts the eccentric about 115° from the pinion contact, not
  180°. The kinematics are unchanged. Input travel 0 remains the exact
  nearest-radius reference. `canonicalTimes` now has `sourcePose: 0` and
  `nearestRadius`; it replaces `sourcePoseNearestRadius`. The 219 test checks
  the presented centre direction against the raster.
- 228: the wedges are smaller: axial depth 0.5 → 0.3, and the disc radius
  1.9 → 1.95 hides more of their roots. The rungs rest at 1.995 and the
  side-link inner radius is 1.916, both clear of the disc planes. Still
  clear.

## Not changed (with evidence)

- 208: the pin/web overlap (0.0535) is geometric. With the inner ring
  selected, the middle-ring pins cross the pinion plane at |y| ≈ 0.48–0.84,
  where the web's lower edge is at z ≈ 0.43–0.60. The pins end at z 0.68 and
  must reach the slot roots (z 0.57) on the line of centres. No pin height
  serves both.
- 218: the net advance is a third of a turn per cycle, and the catch
  re-enters at the same rocker pose. The notch count must therefore be a
  multiple of three, and Brown's eight is not. The notch outline is the
  milled envelope of the hook's oblique entry arc. A square notch that
  contained that envelope would leave about 0.13 of backlash on one driving
  flank.
- 219: the lantern is still about twice Brown's relative size. Halving it
  needs 80 crown teeth or a 4-stave lantern, which means regenerating the
  face cutter.
- 206 teeth: they are still less hooked than Brown's. Every contact angle in
  the tests hangs on the tooth face, so it was not reshaped. The catalog
  archetype "forty-four-tooth" lives only in `src/data/movements.json`, which
  this lane may not edit. The factory copy must equal it (movement-206 test).
- 195, 196, 214, 215, 216, 227: the listed residuals are unchanged. Brown's
  rectangular slots on 195 would break the worm conjugacy. A longer lobe on
  196 changes the carrier motion and the baked irregular profile. On 214 and
  215, wider teeth and rounded ears break the stop contact checks. On 216, 24
  teeth over 180° leaves no hand-off gap.

## Reports regenerated

`191-196-201-contact.json`, `200-226-bevel-solids.json` and
`202-264-worm-solids.json` (`POSES=33`) only record the new
`authored-gears-core.js` hash; their results are unchanged.
`219-224-414-contact.json` was rerun for 219: 0 inside, 0 penetration, and a
maximum working gap of 0.0029. `205-208-209` and `221-222-223` do not
fingerprint the edited functions or files and still pass.
