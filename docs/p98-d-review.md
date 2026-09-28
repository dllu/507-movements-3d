# Pass 98, lane d: 130, 145 and 146 (user findings)

Reviewer: Claude Opus 5.5, pass-98 lane d. Scratch captures are in `/dev/shm/p98/d/`: `before/` and `after/` hold the default, four-phase, rotated (yaw ±40, pitch ±25), side and back views plus close-ups, and `ba-ID.png` sets before and after side by side with the plate.

## 130: plate shears (production: `mujoco-plate-shears/`, baked)

The production route loads `baked/plate-shears.js`, a MuJoCo recording of `mujoco-plate-shears/geometry.js` and `physics.js`. `authored-cams.js` only holds the legacy synchronous model, so it was not changed.

**Findings, verified**
- The see-through pin hole was real, but the pin itself was intact. Both jaw outlines wind clockwise. three's ExtrudeGeometry does not re-wind the holes in a clockwise outline, and both bores were also wound clockwise, so their walls came out inside-out. The walls were culled, and looking into either bore at an angle showed the jaw behind or the background (`before/130-close2.png`). The pivot pin also stopped 0.07 inside the fixed jaw's back face.
- The blades did not close. Brown's cam (r 0.50, throw 0.26; the model had 0.52 and 0.23) lifts the long arm only about 11°. The blade is drawn 18° open from the fixed blade. Sweeping the drawn cutting edge shows that at least 15° of swing is needed before the whole edge reaches the fixed edge.

**Fix**
- Every bore is now wound opposite to its outline (the `bored()` helper), which gives closed, inward-facing bore walls. This applies to the jaw, the fixed jaw and the cam.
- The pivot pin now runs from z −0.205 to 0.205, so it stands proud of both outer faces (−0.183 at the back, 0.16 at the front).
- The cam keeps the drawn shaft centre and the drawn open pose: its radius minus its throw is still 0.29, so the low point just meets the arm. It grows to radius 0.64 with throw 0.35. The MuJoCo sphere collider now reads these values from `profile` instead of using hard-coded numbers.
- The simulation was re-run and rebaked with `probe-plate-shears.mjs`, then `bake-plate-shears.mjs`, then `validate-plate-shears-bake.mjs`. The jaw now swings −17.2° (it was −10.9°). Penetration is 2.7e−6, there were 0 resets, and the loop seam is 1.6e−12 px. The native replay differs by 0.00025 px, and the 0.25 ms rerun by 0.029 px. The fit bounds widen to x −3.5 and y −1.7 because the larger eccentric swings further out.

**Captures:** `after/tile-130.png` and `after/130-close.png`. From the back, the pin is proud and the bore is closed. At phases 0.5 and 0.75 the jaw's cutting edge lies past the fixed edge along its whole length.

**Tests:** `tests/plate-shears-bake.test.mjs` has a new check. In the closed phase the whole cutting edge must pass the fixed edge by at least 0.03, all bore walls must face their axis, and the pin must stand proud on both sides. The camera-bounds check now uses precise boxes. 4/4 pass. `mujoco-baked-loops` passes 116/116. The coincident-face screen flags 0 pairs; the disconnected-part screen finds 0 detached parts, 0 near misses and 0 slivers; loop seams are clean.

**Residual:** the cam is about 1.3× Brown's diameter. His drawn throw cannot close the drawn blade opening.

## 145: sliding standard (`authored-linkages.js`)

**Finding, verified:** the standard was a box upright on an open trough foot, with two beam "gussets" floating beside it (`before/145-close.png`). Brown draws no braces. His standard is one cast piece: a bell body whose concave sides flare from the wrist eye down to a plinth, with a narrow rib down its face (his two vertical lines).

**Fix:** the upright, trough foot and both braces are replaced by three joined parts:
- The bell body is one smooth-shaded extrusion. Its eye is a circle concentric with the wrist pin, at radius 0.25. That is 1.6× Brown's radius, the same enlargement as the other pin bosses here. The sides are symmetric cubic curves that leave the eye along its tangent and flare to a half-width of 0.39 at the plinth.
- The plinth is a plain block on the ground, half-width 0.41.
- The front rib stands 0.06 proud of the body face and runs from the eye down into the plinth.

The body and rib each overlap the plinth by 0.01, so there are no coincident faces. Proportions come from the plate at 14 px per source unit. The rail was already removed by source presentation, so the plinth slides on the ground as drawn.

**Captures:** `after/145-close.png` (default, rotated ±, side) and `after/tile-145.png`.

**Tests:** in `models.test.mjs`, the movement 145 block now requires no brace or gusset. It also requires the body to sit into the plinth, the rib to reach the plinth and stand proud of the body, and every body vertex above the pin to lie on the concentric eye circle. It passes. `docs/validation/145-assembly.json` was regenerated with 65 poses: 27 parts, 0 failing pairs. `144-assembly.json` was regenerated because it fingerprints the same file; only its hash changed. The coincident-face screen flags 0 pairs. The disconnected-part screen finds 0 detached parts and 0 slivers; its 12 near misses are the existing wheel and pin bore clearances, none of them on the standard.

## 146: loop-groove yoke (production: `framed-yoke.js`)

The production route is `model-loader` → `framed-yoke.js`. `authored-cranks.js` holds only the legacy model and was left unchanged.

**Finding, verified.** On the plate, the dotted lines behind the disk trace the following:
- the groove's top edge (rows 203 and 228)
- a rounded island (rows 228–280)
- the groove's bottom edge (row 303)
- the frame's bottom edge (row 332)
- the lower stem

So the groove is a closed loop round an island, not a straight slot. The site has no 2D animation for 146.

**Kinematics.** The yoke is a vertical slide, so the wrist crosses the loop horizontally only between −R and +R, where R = 93.3 px. The loop's ends are therefore semicircles whose outer points lie at exactly ±R (a stadium). Straight vertical ends would force the yoke to jump. The wrist offset within the loop is ±h on the straight runs and ±h·sin(acos((|x|−R+h)/h)) round the ends. The yoke position is y − offset. The plate fixes h: the wrist sits in the top run and the loop centre is 53.5 px above the shaft, so h = 39 px. The yoke position and velocity are both continuous. The stroke is ±(R−h) = ±1.07.

**Fix**
- The yoke is one watertight solid. A 30 px wall runs round the groove (Brown's thickness), with the island inside, the stems, and a floor under the groove. Its interior coincident caps are removed before merging, and it is smooth-shaded.
- The wrist runs from z −0.35 to 0.51, passing through the disk and stopping 0.02 above the groove floor.
- The disk and its hub use `makeSeeThrough`, the shared style, so the groove and wrist read from the default camera.

**Captures:**
- `after/146-phases.png`: 8 phases.
- `after/146-zoom.png`: the wrist rounding the right end at phases 0.2–0.3, then the bottom and left runs.
- `after/tile-146.png`: rotated, side and back views.

**Tests:** `tests/framed-yoke.test.mjs` was rewritten. It checks:
- the wrist centre stays on the stadium centre line at all 257 samples
- the wrist circle clears both groove walls
- there is floor under the wrist and the groove is open above it
- the yoke never jumps
- the stroke is ±(R−h), and Brown's pose (loop centre at row 253.5)
- the frame top and bottom are within 3 px of rows 174 and 332
- the stem ends and see-through flags

It passes. `docs/validation/146-assembly.json` was regenerated with 65 poses: 5 parts, 4 pairs, 0 failing. The coincident-face and disconnected-part screens are clean.

**Residuals**
- The loop is narrower than drawn. Its centre line reaches ±93 px, where Brown's reaches −110/+125, because the wrist cannot reach his ends. Keeping a constant wall, the frame's outer width is 270 px against Brown's 327, so the "ears" project less past the disk.
- At the loop ends the groove is tangent to the wrist's path, so the wrist gives the yoke no push at that instant. The yoke's own inertia carries it through; the motion is prescribed.
- The shaft stub's shadow shows through the disk.

## Other checks
- `check-loop-seams --ids=130,145,146`: 0 seams.
- `authored-loader`, `see-through-part` and the `models.test` blocks for 130, 144, 145 and 146 pass. Routes are unchanged.
- `screen-body-intersections` loads the legacy synchronous models for 130 and 146, so its figures for those two do not reflect the production models.
