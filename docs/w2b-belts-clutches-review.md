# Pass-51 wave-2 lane w2b: belts, pulleys, chains and clutches

Reviewer: Claude Opus 5.5. Each movement was captured with
`scripts/review-movement-source-views.mjs` before and after the change and
compared with `public/engravings/mm_NNN.png`.

## Changes

- **1–23, 134, 227–229, 243 (`authored-belts.js`)**: the shared pulley and
  belt primitives add white face stripes, tread patches, belt markers and rope
  beads that Brown never draws. `createAuthoredBeltMovement` now detaches
  every visible white mesh for these IDs (none has a drawn white part). Their
  userData handles remain, so motion tests still track the positions. Marks
  that a factory had already hidden (134's drum index, 243's tread patches)
  are left in place as invisible references.
- **7**: flat front elevation (`cameraDirection (0,0,1)`, fov 10). The caption
  names three lower pulleys, and the plate draws them as one continuous block
  with the belt on the middle, loose pulley. The three pulleys are therefore
  widened to nearly touch (0.272 at 0.28 pitch).
- **14**: rebuilt to the plate's four-sheave upper block over a three-sheave
  lower block. The blocks are solid round-ended barrels (thick cheeks and
  partitions plus a crown skin on the hook side), with the mortise slots open
  at the front, back and rope side (`hoist-hardware.js makeTackleCase`, which
  only 14 uses). With four sheaves over three, the only reeving that uses
  every sheave makes the standing part fast to a becket eye on the lower
  block. Seven parts carry the load, so the ideal advantage is 7. Brown's rule
  (twice the lower sheaves, 6) ignores the becket part, and the kinematics
  record it as `nominalBrownRuleAdvantage`. The camera is raised slightly to
  show the upper block's top mortises, as the plate does.
- **18 (`authored-fixed-tackle.js`)**: the middle sheave grows from 0.67 to
  0.73 of the top sheave (plate about 0.77) and the movable sheave from 0.75 to
  0.81 (plate about 0.73). The vertical side strands need the middle sheave to
  be smaller than the movable one, because the movable-to-upper strand passes
  outside it.
- **227**: links lying in the pulley plane are now flat plates. A thin web is
  seated inside each wire loop and stops short of each joint by the
  neighbouring link's wire sweep, which leaves an eye at each end. Links that
  stand across the teeth stay open loops.
- **228 (`chain-drive-working-parts.js`)**: the camera now looks from the left
  and above (`(-9,3.6,7)`), as in the plate, with the shaft running back to the
  upper left.
- **229**: the legs are cut to the plate's lengths. The left leg ends about one
  pitch radius below the wheel centre and the right leg 0.7 below it; links
  whose lower end passes these limits are not drawn. The source-animation
  chain state is unchanged. Fit bounds are tightened to the shorter chain.
- **243**: all five pulleys are plain discs (an annular web on the bored hub)
  in place of spoked wheels. The fourteen band markers are no longer drawn.
- **48 (`jaw-clutch.js`)**: the white rim stripe is removed. The jaw crests now
  roll over in a cosine from the top of the axial driving flank, with no flat
  land. The flanks stay axial so that drive contact and the existing contact
  proofs hold; fully symmetric waves would change the motion law.
- **53 (`reversing-clutch.js`)**: the white index tooth on each bevel, the
  crown-jaw rim stripes and the shaft stripe are removed. Field of view is 8
  for a flatter elevation.
- **58 (`three-speed-selector.js`)**: pulley index stripes are removed, and a
  padded `cameraFitBounds` keeps the lower gear cluster off the viewport edge.
- **61, 62**: the default view is the closed drum Brown draws (`sectionView`
  false); the cutaway stays available through the Section view control.
  Pulley index stripes are removed.
- **45**: the white band had already been removed by the gears lane
  (`authored-gears-core.js` passes a null `indexAngle`). No change here.

## Intersections (show-body-intersections, spacing 0.01, 129 samples)

- 7: worst depth 0.0029 (white stripes against the belt) → 0.0003, which is
  seated belt-on-drum contact.
- 14: deforming rope pairs 0.0139 → 0.0164, where the rope sits on the sheave
  treads. The rope end seated in the becket eye measures 0.0098. No solid
  pairs.
- 18: 0.0046 → 0.0020, all rope-on-tread (deforming).
- 227, 229: clear before and after.
- 243: 0.030 (band marker in the band) → clear.
- 48: unchanged. The coaxial and zero-depth pairs are the existing seated
  fits.
- 53, 58, 61, 62, 134, 228: geometry is unchanged apart from colour, marker or
  camera changes; not re-screened.

## Residuals

- 7: Some perspective remains on the bevels at fov 10. The three lower pulleys
  keep their function colours.
- 14: Ideal rope with small fleet angles. The advantage of 7 departs from the
  caption's arithmetic, as recorded above.
- 18: The movable sheave is larger than the middle one, which the plate
  reverses.
- 48: The working flanks stay axial, so the jaws read as rounded humps with one
  steep side rather than the plate's symmetric waves.
- 227: Sprocket teeth and hub are unchanged.
- 229: The chain ends step by one link as links pass the drawn cut-off.
- 14, 18, 229, 243 and 7: the display-profile motion bounds were not
  remeasured (that is outside this lane).
