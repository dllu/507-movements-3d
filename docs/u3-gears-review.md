# u3-gears: user-reported defects on 191, 192, 196 and 198

Pass-51 user-feedback lane. Production code is in `src/simulation/authored-gears-core.js`, and each change is confined to that movement's factory. Helpers are listed under each movement.

## 191 Scroll gears: complete teeth at the step

**Defect.** Only the lower scroll had trapezoid teeth, and one of them straddled the reset step and was cut off. The upper scroll was an envelope cut that left thin nubs and a mangled tooth at the seam. Movement 38 does not have this problem because each of its stepped sectors ends on a whole tooth.

**Fix.**
- **Tooth generation.** `scripts/generate-irregular-gear-profiles.py` (new `hob_scroll`) generates both scrolls offline with one straight-sided 20° rack. The rack rolls along each sampled pitch spiral, and every pose is clipped to a wedge that never crosses the seam ray. This makes the two scrolls conjugate, with the same tooth form on both.
- **Tooth phase.** Each step ends on a whole tooth on its long side, flush with the radial wall. The short side starts with a gap.
- **Reset relief.** Around the reset (±8% of the cycle), each scroll's swept mate plus 0.0025 clearance is cut from the short-side notch floor only. This is Brown's stepped relief.
- **Orientation.** On the plate, the upper wheel's long side is left of the step and the lower wheel's is right of it. To match, the upper scroll is now the uniform Archimedean driver turning clockwise, with `state.driverAngle = -inputAngle`. The lower scroll follows counter-clockwise.
- **Unchanged.** Pitch law, ratio range (0.613 to 1.521), period and closure.
- **Rendering.** Both bodies render the baked contours (`generated-irregular-gear-profiles.js` keys `191` and `191driver`). The analytic trapezoid tooth meshes are hidden.

**Evidence.**
- Planar audit, 513 poses: overlap 0 and minimum gap 0.0024. The largest gap of 0.0092 is the 3.5% backlash.
- `show-body-intersections 191` reports no open pairs.

## 192 Eccentric mangle wheel: traced groove

Handled by a sub-agent (same lane) inside `eccentricVariableSpeedMangleWheel`.

**Trace.** The tooth row was traced with the contour extractor and an ink scan, then smoothed into 56 knots joined by 112 arcs. It follows the plate's path: the rim run, the turn at d, the neck past b, the hub lobe, the right lobe and back along the rim.

**Gearing and groove.**
- 65 wheel teeth and a 6-tooth pinion.
- The pinion runs outside a raised hooked land. The groove b–d is the pinion-shaft path, one pinion radius outside the pitch curve.
- The tooth land was regenerated from the actual pinion with `scripts/generate-reversing-mangle-cavities.mjs`. The baked data for 193 is byte-identical.
- In `reversing-mangle-guides.js`, a 192-only flag `toothLandInsidePitchLoop` was added.
- The 192 presentation also removes the hidden universal-joint drive.

**Motion.** The speed ratio varies continuously from −0.143 on the rim run to +0.287 on the hub lobe. The wheel reverses twice per cycle. Rolling, guide and mesh-phase errors are all ≤ 1e-14.

**Intersections.** The first check found the hub hitting the pinion by 0.032. The hub was lowered, and the check now reports no solid pairs. The pinion's open mesh is reported as before.

**Residuals.**
- The pinion (kept as the working drive, although the plate omits it) overhangs the wheel edge on the rim run.
- The generated teeth are rounded rather than Brown's square ones.
- The hub is drawn as a dark boss.

## 196 Wheel A: traced outline

**Pitch curve.** The pitch curve of wheel A is now traced from the plate. It was fitted midway between the drawn tooth tips and roots at 30 points around hub A (130, 250). That includes the right lobe's lower flank, which the arm hides; this span is inferred from a smooth closure.
- The trace is smoothed with six Fourier harmonics per coordinate (largest deviation about 2 px).
- The curve is not star-shaped about A, so it is parameterized by a counter-clockwise curve parameter rather than a polar radius.
- The shape is a pear: a round lobe about A, a concave waist on top (curvature radius at least 0.61, larger than the pinion radius) and a long right lobe (reach 1.52 against 0.75 on the left).

**Teeth and pinion.** 22 teeth, with the 10-tooth pinion radius set to 0.412 so that the traced perimeter closes at unit scale.

**Source pose.** The source pose keeps the wheel unrotated with B under its lower flank. Brown's A–B spacing is about 8 px larger than the traced pitch radius plus the pinion radius, so the modelled centre sits 8.5 px below A.

**Arm angle.** The carrier angle is now unwrapped, because the arm straddles ±π.

**Tests.** They were updated to the traced shape:
- 22 teeth, 2.2 pinion turns per cycle, and index closure after 5 cycles or 11 pinion turns.
- The arm still reverses 4 times, with strokes of 0.41 and 0.14 rad.
- The wheel teeth are regenerated from the actual pinion.

**Evidence.** Planar audit overlap is 0 and `show-body-intersections 196` is clear.

## 198 Lifted mangle rack: smooth carrier

Handled by a sub-agent inside `fixedPinionLiftedMangleRack`.

**Carrier plate.** One carrier plate, traced from the plate (35 points, smoothed), replaces the capsule plate and its two small stub arms. It has a rounded upper-right lobe and a swept lower-left foot, and both rods pin directly into bored eyes in the plate.

**Other parts.**
- The strap is a broad, round-ended pinned bar.
- The frame's top edge has moved down to Brown's height, and the upper rollers moved with it.
- The linkage kinematics are unchanged. The outline is bent slightly near the modelled pivots, 7–11 px off the drawn ones.

**Intersections.** `show-body-intersections 198` is clear.

**Residual.** The lower-right fixed rod pin sits at the frame's right edge, not at Brown's inset pin.

## Validation reruns

- `docs/validation/191-196-201-contact.json`: produced by `review-irregular-gear-profiles.mjs`, then `generate-irregular-gear-profiles.py`, then `review-irregular-gear-contact.mjs` and `.py`.
- `200-226-bevel-solids.json` and `202-264-worm-solids.json` (`POSES=33`): only the source fingerprints changed.
- The 205-208-209 and feed-worm reports fingerprint individual functions that this lane did not touch, so they were not rerun.
