# Pass 54: marks, rims, translucency and rope continuity (lane p54-marks)

Scope: the rule set in the pass-53/54 briefs. No marker stripes, index blocks,
ticks, dots, painted outlines or black rims on faces; no translucency standing
in for Brown's dashed hidden parts; ropes drawn as rope use the laid rope and
run continuously to a real attachment; flat belts are continuous. Captures
were taken from a private non-watching dev server (seven views per ID:
default at two phases, rotated 60 degrees, oblique, top-back, side and back)
before and after each change and inspected.

## Sweep

`/dev/shm/t3/bsweep.mjs` loads every movement through
`src/simulation/model-loader.js` in the browser (so MuJoCo and baked
movements load too), applies source presentation, and lists visible meshes
whose role contains index/marker/stripe/tick/dot/outline/contour/seam/arrow/
bead/indicator, line and point primitives, near-black ring/shape/torus or thin
face meshes, near-white meshes, and translucent non-fluid meshes. Pure-white
(`#ffffff`) hits in 45-62 and 74 are vertex-coloured MuJoCo/baked solids, not
marks. The findings were judged from captures. Fixed beyond the assigned
list: 38 (ink sector-joint lines), 47 (brass feather stripe), 144 (white pin
depth indices), 152 (white stud/pencil motion indices), 254 (white speed and
pocket indices), 267 (direction arrow and arrowhead), 285 (quill index), 299
(crown-wheel witness), 323 (white nick and face indices), 346 (piston-head
index), 473/478/497 (black outline rims), 492 (fulcrum index). A generic
source-presentation pass now hides the white tread and face index marks that
`makePulley` builds on every sheave (all movements; the marks stay as hidden
placeholders).

Left for other lanes or later (reported, not changed): symbolic flow markers
and flow lines in 433-440, 455, 456, 475, 476, 478 (condensate guide lines),
481, 483 and 486 (water/gas lane); 391's tension spring drawn as a line
primitive; 253's hoisting rope, whose two strands stop at the plate's crop
line; 473's black tub hoops (kept as iron hoops); white pin heads used as a
style for real pins (77, 324, 325, 332-340, 349, 350, 401, 403, 415-424 and
others), which are parts rather than marks.

## Per movement

- **15** White's pulleys: the groove and rim faces of each step take a
  darker shade of the step's own colour instead of ink black
  (`authored-white-pulleys.js`). No outline ring remains in any view.
- **24** The ink `RingGeometry` at 0.75 of the pitch radius on each front
  face is gone (`authored-gears-core.js spurGears`).
- **30, 33, 35** `makeProfiledNoncircularGear` no longer paints its ink inset
  contour by default (`showInset` defaults to false); all three gears have
  plain faces both sides.
- **193** The finite guide finisher gives the groove wall, backing disc and
  root strip one wheel material (`reversing-mangle-guides.js`): no black
  layer on the rim edge, no black teeth. The groove reads by its walls and
  shading.
- **194** Same finisher change; the 194 post-process no longer repaints the
  backing ink, so the back face and rim edge are the wheel's blue, and the
  pin seats take the pin material instead of a dark outline around each pin.
- **253** The dark grey torus outline round disc A is removed by
  presentation; the drum flanges take the drum's colour.
- **479** Tank and tube lips take the metal of the part they finish; the bell
  crown seam and bottom rim tori are hidden (`gasometer-working-parts.js`).
  The white gas-flow beads are removed. The suspension is now a heavy flat
  band (0.2 wide by 0.1 thick) lapping flat-faced flanged pulleys, with its
  centreline on the old rope pitch line, so the constant-length law is
  unchanged (`authored-gasometers.js`).
- **480** Same rim treatment (tank lip grey, bell rims hidden, tube rims gold
  or grey); white gas beads removed.
- **67, 70, 71** Tumbler E, cover C and plate B are opaque. In the default
  face view they now hide what Brown dashes behind them; the parts are seen
  by rotating.
- **134** The eight ink separator strips painted on the drum's front face
  are removed. Brown's segmented rim is represented as a plain rim.
- **143** The shaft key takes the shaft's steel material at load time
  (`baked/sliding-worm.js`); the gold stripe is gone. No rebake was needed.
- **155** The ink circle line on the ratchet face is removed by presentation
  (the baked bundle is unchanged).
- **348** The dark slot floors and the black slot-lining strips (the source
  of the orange/black ladder) are hidden: the crossed slots are open through
  the disk as Brown leaves them white. The pins are plain steel and the white
  index rings round their heads are hidden.
- **356** The white spin stripes and dot on ball B are removed; the ball is
  plain, so its spin is no longer visible (accepted per the no-markers rule).
- **370** The mirror is one silvered square block (the white inset face is
  hidden); the crank and mirror indices are hidden in the factory.
- **407** Removed: the white bar-edge strip, the slide index, the white line
  primitive along the bow's working edge, and the two construction points.
  The cord collar is brass.
- **408** The orange drawing-edge stripe is removed.
- **411** The ground travel ticks and wheel indices are removed. The push
  handle bar was lowered 0.30 so it rests on the brace end and runs up into
  the arch, which carry it.
- **414** The index-coloured first scroll tooth is plain, the feather key is
  the shaft's steel, the white shaft index is removed, and the three black
  hub stubs (which stopped 0.10 short of the scroll) are replaced by three
  web arms in the scroll's colour that reach into the innermost turn.
  `docs/validation/219-224-414-contact.json` was regenerated (unchanged
  results, new source hash).
- **419** The white pulley face/tread marks are gone through the generic
  pulley pass.
- **494** The white rhombus pivot dots are removed.
- **502-506** A `hideWhiteMarks` presentation option hides white index boxes
  and repaints 504's painted index teeth in the wheel's own colour.
- **458, 459** The plain leg tubes were being re-shown every frame by the leg
  update; they are now pinned hidden, so only the laid rope shows.
- **358** Both fusee cords now share the band colour, so they read as one
  band crossing the fusee. Thickness is unchanged (0.018): the cut groove
  and the tested 0.040 separated take-offs leave no room for more.
- **270** The rope is endless: it runs down past the plate's crop round an
  equal lower return sheave (for both figures), with a whole number of lays
  in the loop so the travelling lay closes. The camera fit keeps Brown's crop
  (legs to 3 units below the axle).
- **278** Lift rope a runs on up to y = 12 (the unmodelled hoist) so the
  break and upper piece are out of every framed view; no stub floats above
  the platform.
- **373** The belt is endless, running up-left past the crop round a driving
  pulley of the same size, which is excluded from camera fitting.
- **163** The flat belt's two runs continue past the crop round a driving
  drum as tall as the belt's shift; the six grey seam strips (belt-travel
  markers) are pinned hidden. Both are added at load time in
  `baked/belt-governor.js`; the bundle is unchanged.
- **334** The rod under chain D is as wide as the chain's eye (0.90 source
  units, was 0.30), so it reads as Brown's bar, not a wire.
- **490** The slack in each free rope span now hangs down (away from the plan
  view) instead of bowing up; in plan the spans are straight. The slack
  amount and fixed rope length are unchanged.
- **427** The floating black wire ring (Brown's dotted head ring) is hidden;
  the head rings are on the omitted cylinder head. The piston guide pins
  remain as their followers.

## Residuals

- 358: the band is still thin (groove-limited); a thicker band needs the
  fusee groove recut and the take-off spacing retested.
- 427: the head rings are not modelled, so the guide pins run in nothing
  visible.
- 270, 373, 163: the return sheave/pulley/drum beyond the crop has no
  modelled support.
- 278: the rope's top end reaches no modelled hoist.
- 490: the rope still rides over the lower barrel flange (unchanged).
- 479: tank and bell remain translucent as a section stand-in (not in this
  lane's list; the brief rules out translucency for hidden parts).
- 414: the scroll face web is still shaded where Brown leaves it white.

## Tests

Run: the movement tests for every changed ID plus the family solids and
contact suites (see the final report). Updated for intended changes:
`belt-governor-baked` (53 meshes, hidden seams, framing excludes the
beyond-crop run), `movement-356` (23 meshes, spin indices detached),
`movement-373` (band plus return run), `movement-407` (notation removed),
`movement-254`, `movement-299`, `movement-323` (indices removed).

## Intersection screens after the changes

`show-body-intersections.mjs --spacing=0.01` (129 samples for 479, 65 for the
rest): 479 band ends seated in the bell lugs (0.090) and weight sockets
(0.020), intended attachments; bands tangent to their laps. 348, 373, 427,
253 clear. 411: only rolling tangency and pencil-on-paper contact. 414:
0.0001 pinion on its feathered shaft. 270: the new return sheave's web sits on
its journal (0.0001). 278: only the pre-existing leaf-spring half joins
(0.017) and seated pawl/tooth contact. 334: roller tread contacts only. 490:
the rope end inside its tiller clamp (0.028, intended). 458/459: the laid
rope ends in the bucket bails (0.014, intended); 459's pre-existing 0.007
star-pin/worm graze is unchanged. 480 (rim material and size only) timed
out; 358 (colour only) runs out of memory on its 3600-sample laid cords.

Final test run: 381 tests in 57 files for the changed families pass, plus
`source-presentation.test.mjs` and `models.test.mjs` (the 475 failure in
`models.test.mjs` is another lane's presentation change).
