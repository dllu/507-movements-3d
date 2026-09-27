# Pass 69, lane p69-w1: water wheels, open water and wells

Reviewer: Claude Opus 5.5 (lane p69-w1). Date: 2026-09-26.

Scope: 431, 432, 437, 438, 439, 440, 441, 442, 443, 447, 457, 458, 459, 460, 487, 489.
For each ID I read the caption, studied the plate and checked function and water in
fresh production-route captures. Each capture shows the plate, four phases (0, ¼, ½, ¾ of
the period) and views rotated ±60°, from the top and from the back. Tiles are in
`/dev/shm/p69-w1/{before,after,final}/ID-tile.jpg` (bulk review artifacts, not in Git).
Framing is measured from fresh motion bounds (`FRESH=1`), because several bounds changed;
the display profiles need re-measuring for the IDs listed at the end.

Streams now use the shared `water-stream.js` helper (continuous swept bodies with a flow
texture, ballistic or guided). Where a stream starts or stops, it emerges progressively:
its length and section grow with the flow. No stream pops on at full length.
`scripts/check-loop-seams.mjs` reports **0 seams and 0 mid-cycle pops** for all 16 IDs.

## 431 Undershot wheel

**How it works:** the headwater stands behind a lifting sluice leaf. The water runs out
under the leaf's raised lower edge and down the apron into the tail race. It strikes the
lowest floats, which turns the wheel anticlockwise.

**What was wrong:**
- The water was one flat box at a single level on both sides of the gate. There was no
  head, no opening under the leaf and no apron.
- The gate leaf was a black block hidden behind the front jamb.
- The gate tower was much shorter than Brown's, so its handle sat level with the wheel top.
- The handle was a straight bar with balls.

**What changed:** `authored-undershot-water-wheels.js`
- The bed is one extruded profile: a level head floor, a cosine apron and a deeper tail
  floor.
- The water is one continuous extruded body: the head pond at axle level, the opening
  under the leaf and the tail race (surface −1.94).
- A guided flow sheet (`WaterStream`) runs under the leaf and down the apron past the floats.
- The sluice is now two slotted post pairs. The leaf runs between them and shows between
  them, as Brown draws it.
- The posts are Brown's height. The screw rises in the slot to a nut, which carries a
  curved S-shaped double handle.
- The race is widened to the left to show the head pond (bounds −6.0 to 4.0).

**Captures:** `final/431-tile.jpg`

**Intersections (after):** only coaxial spoke/shaft pairs (unchanged) and fluid contacts
(floats and rims in the tail water, as intended).

## 432 Breast wheel

**How it works:** the headwater enters the cells between the floats just below axle
level. The close-fitting breast turns each moving cell into a bucket down to the bottom,
where it empties into the tail water. The wheel turns clockwise.

**What was wrong:**
- The breast began 13° above the axle, higher than the headrace floor. It was a wall
  blocking the inlet, and the feed tube passed through the masonry.
- The breast was 48 box segments (a crude polygon), with a translucent front cheek that
  Brown does not draw.
- The tail water lay below the wheel, although Brown's tail water stands against the
  lower floats.
- The gate leaf was black.

**What changed:** `authored-breast-water-wheels.js`
- Brown's hatched ground is one masonry section: a level headrace floor ending at a lip 9°
  below the axle, a breast arc (r 2.78) round to the bottom, and the tail bed.
- The headwater surface is at +0.42. It meets the wheel periphery between the lip and 8.7°
  above the axle, where the cells fill.
- A guided feed sheet runs under the leaf, over the lip and into the cells.
- The tail water surface is at −2.07. It fills the bottom of the breast pit.
- The front cheek is cut away on the camera plane; the rear cheek closes the cells.
- The gate is now slotted post pairs with Brown's long hatched plank leaf.

**Test updated:** `tests/movement-432.test.mjs` now checks for the masonry, where it used
to check for the 48 rails.

**Captures:** `final/432-tile.jpg`

**Intersections:** see the table below.

## 437 Volute wheel

**How it works:** the scroll b takes the water in tangentially and confines it all round
the runner, so it acts on every vane a. The water then escapes down through the inclined
buckets c.

**What was wrong:**
- The scroll water was a round hose along the passage centreline.
- The inlet was a solid bar with a film of water on top of it.
- A tailwater disc floated below the runner with no container.

**What changed:** `authored-volute-water-wheels.js`
- The water fills the scroll passage from floor to one level over the vanes, between the
  outer wall and the runner, and fills the vane ring.
- A circulation sheet along the passage speeds up and narrows as the passage narrows
  (continuity).
- The inlet is now an open duct as deep as the scroll: a floor and two walls continuing the
  passage along its tangent.
- The escape water leaves as four falling sheets under the bucket openings. They turn with
  the runner, which is correct because the flow is steady in the runner frame.
- The floating tailwater disc is removed through a presentation `remove` entry.

**Captures:** `final/437-tile.jpg` and a tilted view (`after/437-tilt.jpg`) showing the
filled passage and the open duct.

## 438 Barker's mill

**What was wrong:**
- The feed was a tiny curve at the flume end, which was a solid bar.
- The funnel water was an open cone film that did not show.
- The level camera could not see into the funnel.

**What changed:** `authored-barker-reaction-mills.js`
- The flume is an open trough, raised so that the fall shows.
- Its water is one continuous stream: it runs down the floor, leaves the lip at trough
  speed and falls ballistically into the water standing in the funnel.
- The funnel water is a solid turned body with a free surface.
- The camera is a little from above (presentation `[0.08, 0.2, 1]`), as Brown's open
  funnel is drawn.

**Captures:** `final/438-tile.jpg`

## 439 Bucket with ground-opened valve

**What was wrong:**
- Water conservation: the stream never stops, but the bucket filled only at the top. It
  rode up empty under the running stream, so that water was lost.
- The water poured out of the opened valve went nowhere; it simply vanished.
- The scaled-cylinder water poked through the tapered staves when the bucket was part full.

**What changed:** `authored-water-bucket-reciprocators.js`
- The bucket gains water at one steady rate whenever its valve is shut: during the return,
  the dwell under the spout and the loaded descent. Only the open valve empties it.
- The payload is a frustum rebuilt in place to the staves' taper at every level.
- A discharge stream issues from the opening round the stem. It grows with the drain rate
  and falls away.

**Test updated:** `tests/movement-439.test.mjs` now checks the constant-inflow schedule.
The source pose is part full.

**Captures:** `final/439-tile.jpg` and `after/439-tile.jpg` (drain phases 0.56 and 0.62).

## 440 Tipping trough water meter

**What was wrong:**
- The camera was nearly side-on, so the raised half and its water were never seen.
- The fall was a vertical rod.
- The discharges were vertical rods.
- There was a black strip under the trough.

**What changed:** `authored-tipping-water-meters.js`
- The flume water and the fall are one continuous stream. It leaves the lip slowly and
  lands beside the divider foot in the raised half.
- The lip is placed so that the stream always falls on the raised side.
- Each emptying half pours from its open outer end under gravity. The pour is recomputed in
  place as the trough swings and grows with the drain rate.
- The underframe takes the trough colour.
- The camera is from the left and above (`[-0.12, 0.55, 1]`).

**Captures:** `final/440-tile.jpg`

**Residual:** from the plate's camera, the water in the raised half is mostly hidden by the
half's own front wall. It shows in the rotated views.

## 441 Persian wheel

**What was wrong:**
- The ported hollow hub was a black ring.
- The tipped bucket's discharge was a stiff vertical rod that ended in the air.

**What changed:** `authored-persian-irrigation-wheels.js`
- The hub takes the wheel colour.
- Each tipped bucket pours from its lip as one ballistic stream, recomputed in place.
- The stream fades where the caption's trough would be. Brown does not draw the trough.

- The load in a tipped bucket is a level body clipped at the lowest rim point. It had
  been a counter-rotated disc that poked through the staves as a thin needle.

**Captures:** `final/441-tile.jpg`

## 442 Eisach pot wheel

**What was wrong:** the hub and spokes were black bars.

**What changed:** `authored-eisach-pot-wheels.js`. The hub and spokes take the wheel
colour.

**Captures:** `final/442-tile.jpg`

**Residual:** each pot pours into the trough just below the wheel top. The drop is short
(about 0.1), so the pour barely reads.

## 443 Stream-driven Archimedes screw

**What was wrong:**
- The casing was opaque, although Brown dots the spiral inside it.
- The water pockets were spheres (beads).
- The discharge was a hose-like tube.

**What changed:** `authored-stream-driven-archimedes-screws.js`
- The casing takes the shared see-through style (`makeSeeThrough`). Brown dots the spiral,
  so the style is permitted here.
- Each pocket is the water trapped in one turn: an annular sector of the passage on the
  low side between two flight turns. Its axial half-length is 0.3 pitch, less than the
  flight's nearest approach. It fades in place at the inlet and at the top.
- The discharge is a ballistic stream from the open top into the trough.
- The flight casts no shadow through the see-through wall.

**Test updated:** `tests/movement-443.test.mjs` now checks the pocket placement and fade.

**Captures:** `final/443-tile.jpg`

## 447 Reaction ferry

**What was wrong:**
- The boat's and banks' shadows fell two units down onto the river bed and read as a ghost
  boat.
- The well coamings were black outlines.

**What changed:**
- `authored-reaction-ferries.js`: the bed receives no shadow.
- The coamings are deck timber.

**Captures:** `final/447-tile.jpg`

## 457 Well sweep and 458 Pulley and two buckets

**Reviewed:**
- The bucket water is a volume-solved frustum.
- The well water sits in the cut-away shafts.
- The ropes are laid.

**Residual:** at the top dwell the load drains away from the upright bucket. The
operator's emptying (tipping it out) is not modelled.

**Changed:** nothing.

**Captures:** `final/457-tile.jpg`, `final/458-tile.jpg`

## 459 Reciprocating well lift

**What was wrong:**
- The struck bucket tipped its mouth inward, so it would spill back into the well. Brown's
  left bucket pours outward into the trough.
- The payload was an upright cylinder, which poked through the staves of the tipped bucket.
- The water vanished with no pour.
- The troughs were solid slabs.

**What changed:** `authored-reciprocating-well-lifts.js`
- Tilt sign reversed on both sides.
- The payload is a clipped level body inscribed in the tapered bucket. It can never stand
  above the lowest rim point, so tipping pours it.
- A pour stream falls over the lowest lip into the trough, recomputed in place and grown
  with the emptying rate.
- The troughs are open boxes (floor, sides and inner end) with running water while they
  receive.

**Test updated:** `tests/movement-459.test.mjs` tilt signs, with an explanation.

**Captures:** `final/459-tile.jpg`

## 460 Fairbairn bailing scoop

**How it works:** the scoop pivots on the ridge between the pit and the upper channel. It
dips its mouth into the pit water, and the beam and pitman then raise it until its floor
falls toward the pivot. The water runs back along the floor and pours out of the spout
over the ridge into the upper channel.

**What was wrong:** the engine could not work.
- The upper channel and its water were buried inside a solid left bank.
- The pit water stood at the same level as the delivery.
- At the top of its 20° stroke the raised bucket still lay below its outlet, so it could
  never empty.
- The outlet sat over the pit.

**What changed:**
- `authored-bailing-scoops.js`:
  - The beam stroke is 87°. The pitman stays in Brown's middle notch.
  - The source connection is lower, so the mouth dips 0.24 under the pit water.
  - The scoop floor continues under the trunnion to a spout (Brown's beak) beyond the pivot.
  - The discharge is one guided stream along the floor and over the spout, plus a
    ballistic fall into the channel. It advances as the flow starts.
- `well-scoop-gutter-parts.js`, 460 branch:
  - The left bank is a narrow ridge (top −0.55) carrying the trunnion.
  - The upper channel beyond the ridge brims at −0.60.
  - The pit water is a full level lower (−1.5).
  - The side plates carry the spout.
  - The trunnion standards stand on the ridge top.
  - The base is flush with the pit floor.
  - The beam tail is shortened, so it clears the bank top through the stroke.

**Tests updated:** `tests/movement-460.test.mjs`:
- six floor boards
- the new selected lift, plus a new assertion that the raised floor slopes to the spout
- a toggle margin of 1.2 (the outer notch approaches but never reaches toggle)
- a closure tolerance of 2e-15
- the stream visibility rule

**Captures:** `final/460-tile.jpg`, `after/460-tile.jpg`

**Residual:** the low scoop hangs steeper than Brown's (about 56° against 33°). His pivot
stands higher above the ridge; I kept the pivot and banks to limit the change.

## 487 Paddle wheel

No water is drawn and none is built. I checked the paddles against the official animation's
radii (10 to 13). **Changed:** nothing.

**Captures:** `final/487-tile.jpg`

## 489 Feathering paddle wheel

**What was wrong:** the bucket pivot bosses, crank-end bosses and arm pivots were black
discs, and a black ring stood round the shaft.

**What changed:** `authored-feathering-paddle-wheels.js`
- The bosses take the bucket colour.
- The pivots take the arm colour.
- The front bearing takes the support colour.

**Captures:** `final/489-tile.jpg`

## Intersections

`node scripts/show-body-intersections.mjs ID --spacing=0.01`, run at 129 samples. For 437,
439, 458 and 459 the 129-sample run timed out or ran out of memory on the shared machine,
so those IDs used 65 samples.

| ID | Solid pairs after | Other classes |
|---|---|---|
| 431 | 0 | fluid (floats, rims and spokes in the tail water and flow sheet); coaxial hub/spokes on the shaft (pre-existing) |
| 432 | 0 | fluid; coaxial |
| 437 | 0 (65 samples) | 10 fluid, 1 coaxial |
| 438 | 0 | fluid |
| 439 | 1 at depth 0.0000: the valve disk seated on the bottom ring (intended seat) | 2 deforming rope contacts at the eye and bail (≤0.040); fluid |
| 440 | 0 | fluid |
| 441 | 0 | fluid |
| 442 | 0 | fluid |
| 443 | 0 | 27 fluid |
| 447 | 0 | fluid; 2 coaxial |
| 457 | 0 | 5 fluid |
| 458 | 0 (65 samples) | 2 deforming rope contacts at the bails (≤0.014); fluid |
| 459 | 3 (65 samples): the star pins graze the worm thread by 0.0071 (known since pass 52), and the tappet crank pin meets the arm eye by 0.0011 (seated pin) | 2 deforming rope contacts; fluid |
| 460 | 0 | 4 fluid |
| 487 | 0 | none |
| 489 | 0 | none |

`scan-bad-faces` finds nothing new from this pass. The findings are:
- degenerate zero-area caps on clipped water cells (432, 442, 459, 460)
- the known pulley groove z-fight (439)
- the drum/float end-plane z-fight (432)
- the arm jets' mixed winding (438)
- the swivel balls (447)

## Files touched

- `src/simulation/authored-undershot-water-wheels.js`
- `src/simulation/authored-breast-water-wheels.js`
- `src/simulation/authored-volute-water-wheels.js`
- `src/simulation/authored-barker-reaction-mills.js`
- `src/simulation/authored-water-bucket-reciprocators.js`
- `src/simulation/authored-tipping-water-meters.js`
- `src/simulation/authored-persian-irrigation-wheels.js`
- `src/simulation/authored-eisach-pot-wheels.js`
- `src/simulation/authored-stream-driven-archimedes-screws.js`
- `src/simulation/authored-reaction-ferries.js`
- `src/simulation/authored-reciprocating-well-lifts.js`
- `src/simulation/authored-bailing-scoops.js`
- `src/simulation/authored-feathering-paddle-wheels.js`
- `src/simulation/well-scoop-gutter-parts.js` (the 460 branch only)
- `src/data/source-presentation.js` (437, 438, 440 and 443 entries)
- Tests: `tests/movement-432`, `-437`, `-439`, `-441`, `-443`, `-459`, `-460.test.mjs`,
  and `tests/water-wheel-430-432-solids.test.mjs`


## Streams that could still move to the shared helper

- 438: the arm jets use `water-volume.js` jets. They are correct because they rotate
  rigidly (steady flow in the runner frame).
- 439: the falling feed is a stretched jet, still one continuous body.
- 442: the pot discharge is a short rod.
