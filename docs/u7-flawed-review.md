# Pass-51 lane u7-flawed: user-reported flaws in 120, 142, 197, 217, 221, 299, 321

Reviewer: Claude Opus 5.5 (lane u7-flawed), 2026-09-24. Each ID was checked in the default
production captures (`scripts/review-movement-source-views.mjs`) and in eight-phase captures
of the default view, before and after the change.

## 120 — compound-pinion segment clamp (live MuJoCo)

- **Cause:** the reversing input stroke of 1.9 rad swung the external jaw 25° and the internal
  jaw 28°. The lower loop swept across the pinion, the internal tooth band ran to within 3° of
  its end, and the jaw tips crossed.
- **Change:** the default stroke is now 0.8 rad (`segmentClampStroke` in `profile.js`). The
  jaws swing 11.6° and 13.3°, close part-way and reopen. The pinion stays at least 33° and 22°
  inside the external and internal tooth arcs. Camera bounds follow the stroke. A 1.9 rad
  stroke is still available as an option, and native jaw contact still stops it.
- **Tests:** the jaw-contact tests now pass `amplitude: 1.9` explicitly. A new test covers the
  default stroke: jaw angles, tooth-arc margins, no jaw contact, both gear pairs in contact,
  and rolling error below 0.15 px.
- **Intersections:** `audit-segment-clamp-clearances.mjs` (21 poses) finds 0.0367 px of
  working-tooth contact overlap (it was 0.0426) and no unintended overlaps.
- **Residual:** the jaws no longer meet. Brown's caption says the jaws are "brought together",
  but a full closure needs about 47° of relative jaw rotation, which this plate geometry
  cannot give while the segments stay centred on the pinion.

## 142 — silk traverse (baked)

- **Change:** the presented rod is now the full 370-px rod, not the broken-off stub. Its
  slider shoe, pin and guide lug ride the vertical `output-guide-rail`. Source presentation
  removes only the rear post, the guide supports and bridges, and the base.
- **Framing:** the camera fits the disk and gears and crops at y = −3.2, the plate's lower
  edge. The rod and rail run out of frame there, as Brown's rod does.
- **Motion:** the rod always points down: its angle stays between −121° and −59°. The slider
  is visible just below the disk at the top of its travel. No rebake was needed, because
  the bake is unchanged.
- **Intersections:** the 721-sample clearance report of the complete model still applies,
  since it already includes the rail and shoe.

## 197 — mangle rack

- **Change:** in `mangle-rack-working-parts.js`, 197 only now fits the camera to the swept
  bounds of the whole cycle. The travelling frame stays in view throughout: maxNdc is 0.89
  (it was 1.63).
- **Residual:** in the square capture the frame is smaller.

## 217 — heart cam

- **New presentation:** `heart-cam-217.js` builds Brown's symmetric heart for plate 217.
  - **Groove:** the centre-line radius comes from 19 ray measurements of the engraving,
    fitted with a quintic (maximum residual 2.6 px). It is outermost at e and has an inward
    notch at D.
  - **Walls:** both walls are exact offsets of the centre line, with engraved bevel lines on
    each land, like Brown's double walls. The island is keyholed around the hub boss.
- **Stud and lever:** stud A rides the groove on a reconstructed lever about a fixed shaft H
  to the right of the cam. At every cam angle the lever angle is solved from the actual
  groove: centre-line error is below 1e-6, the swing is 27.6°, and the motion is continuous.
  In the plate pose the stud sits at e.
- **Split from 218:** the lever about H of plate 218 cannot trace a heart. The complete shared
  217/218 transmission (catch G, notch wheel F, and the −⅓ / +⅔ / dwell law) now presents
  plate 218 only. It is still exported as `createWoolComberTransmission(217)` for
  validation, and the 217/218 tests use it.
- **Intersections:** the relative-motion screen (0.01 spacing, 129 samples) is clear. The
  lever boss is bored for H, and the roller is seated on the lever.
- **Residual:** the lever is reconstructed; Brown draws the cam alone.

## 221 — elliptical driver

- **Change:** the translucent grooved plate g–h is hidden (it is kept for offline checks).
  The groove is drawn only as Brown's two thin, opaque dashed lines.
- **Framing:** the camera fits the swept bounds of a whole driver turn, so orbiting wheel B
  stays in view (maxNdc 0.89).
- **Validation:** the 221/222/223 contact report was regenerated. Only its source hash
  changed; the results are identical.
- **Intersections:** the screen is clear.

## 299 — verge escapement

- **Change:** the crop runs wider along the crown edge. The fit now spans ±1.55 local units
  along the local z axis, which the presentation turns horizontal; before, it was ±1.05.
  About three and a half raked teeth show, the wheel ends run out of view, and the verge
  journal and pallets sit above.
- **Rejected:** a raised camera exposed the verge staff, so it was reverted.
- **Residual:** the pallets are still thick blocks, and the tooth leading faces are vertical
  where Brown's are raked. Both are unchanged because the verge law depends on them.
- **Intersections:** the screen shows only tangent working contact.

## 321 — Harrison going barrel

- **Change:** spring S–S′ is now one smooth round wire along a flat spiral about the arbor.
  - **Anchors:** it runs from S′ on G to S on the larger ratchet.
  - **Shape:** the radius falls monotonically from S′ to S, so the coils never cross. The
    material length is constant: an exponent is solved each frame.
- **Motion:** the spiral has 1.87 turns at the going preload. It unwinds smoothly by a quarter
  turn while T holds the larger ratchet, then winds back as R re-engages. The largest change
  is 0.004 turn per 1/512 cycle.
- **Clearance:** coils stay at least 0.125 apart (wire diameter 0.07). No coil comes inside
  the S anchor radius, so the spring stays clear of the arbor.
- **Weight:** the weight is 0.1 thinner, so its back face clears the lowest coil while winding
  lifts it.
- **Intersections:** the screen shows only the seated spring ends in their anchor pins
  (0.091) and the rope's barrel wrap.
