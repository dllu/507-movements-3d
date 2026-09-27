# Pass 70, lane p70-c: water close review (430, 433–436, 440, 442, 457, 458, 460, 461, 464)

Captures are in `/dev/shm/p70-c/` and are not in Git. `before/` and `after/` hold `ID-plate.png` (the render beside
the plate), the phases `ID-pN.png`, the rotated views (`l`, `r`, `top`, `back`) and a tile `ID-tile.jpg`.
Close-ups are in `cmpNNN.png`. The shared helper `water-stream.js` gained one opt-in option, `section(i, u, [a, b])`,
which gives the final say on a stream's half-extents at each sample. Its API and defaults are unchanged, and
`water-stream.test.mjs` passes.

## 430 Overshot wheel

- **How it works:** the headrace feeds the buckets at the top. The bent buckets hold their water down the
  descending right side and spill it over their lower lips below the horizontal. The water falls to the pit floor.
- **Wrong:** the spill was a thin sheet (0.14 → 0.5 thick). Brown draws a broad spray whose inner edge hugs the
  wheel.
- **Changed:** the curtain is one continuous sheet guided down the rim. The new `section` option sets its
  thickness per sample. Its inner edge follows the wheel's outer circle (r 2.88, smooth-maxed to the floor edge
  at x 1.98), and its outer edge stays at x 3.1. It is 0.15 R wide at the spill and 0.4 R on the floor, with a
  free-fall speed, a fade-out at the floor, more streaks, and a wider floor splash.
- **Captures:** `after/430-tile.jpg`, `c430.png`.
- **Intersections:** no solid pairs. The fluid list is unchanged (hub/shaft fit, feed stream at the partitions).
  The curtain touches nothing.
- **Loop:** clean. Raising the splash count to 40 had tripped a pop-normalisation artefact in the seam checker,
  so it stays at 28.

## 433 Horizontal overshot wheel

- **How it works:** a spout jet strikes the flat boards of a horizontal runner. The runner turns in the jet's
  direction, and the broken water drops from the boards the runner carries on.
- **Wrong:** the runner turned counter-clockwise (seen from above) under a far-side strike, so the shed water
  fell under the left. Brown shows it under the right and front.
- **Changed:**
  - The runner now turns clockwise from above (`spin = -1`).
  - The strike is on the right-hand boards, 10° in front of the view's right, at r 1.7 (about 0.6 R right of the
    shaft on the picture).
  - The jet runs with the boards and slants inward (0.7 radial per unit tangential), so the spout still climbs
    away to the upper right at about Brown's slope.
  - The mouth is placed so the free jet, leaving along the spout axis at the speed of the spout's own fall,
    lands on the strike point.
  - The three shed sheets fall 0.3–1.2 rad downstream (right and front). They are thinner, with more drops.
- **Captures:** `after/433-tile.jpg`.
- **Intersections:** no solid pairs (30 meshes). The fluid contacts are the boards sweeping through the start of
  the shed sheets (water falling off the board tips, which is intended).
- **Tests:** rewrote `movement-433` for the clockwise runner and the slanted jet (it had pinned the old
  direction and exact tangency).

## 434 Fourneyron and 435 Warren (plan)

- **How they work:**
  - 434: water fills the eight fixed guide passages and the eighteen runner passages.
  - 435: water fills sixteen guides outside twenty runner buckets and falls through the open eye.
- **Wrong:** one broad sheet per representative passage lay across the vanes (and, in the runner, across buckets
  that turn under a fixed sheet), which softened the vane edges in plan.
- **Changed:** every passage now carries its own continuous sheet on the passage mid-line, below the vane tops.
  - Its width is 0.27–0.28 of the local clear width (pitch × cos of the vane angle, less the vane thickness). This
    narrows sharply where 435's guides turn tangential.
  - The runner sheets ride with the runner (18 and 20) and leave the rim (434) or drop through the eye (435).
  - In 435 the sheets are thrown inward to clear the foundation ring. The four passages over the support arms end
    at the eye.
- **Captures:** `after/434-tile.jpg`, `after/435-tile.jpg`, `c434.png`, `c435.png`.
- **Intersections:**
  - 434: no solid pairs. The only fluid contacts are water-to-water where guide and runner sheets meet.
  - 435: see the table below. `turbine-433-435-solids` passes after the inward throw.

## 436 Jonval turbine

- **Wrong:** torus rings at the casing's top and bottom corners and at both edges of each vane row. Brown draws
  none.
- **Changed:**
  - All the rings are removed.
  - The shutes run from the drum out to the trunk wall, as drawn, so no water bypasses them.
  - The drum grows 0.09 so the shutes root in it.
  - A plain runner hub (shaft to annulus, full row height) carries the buckets that the inner rings used to join.
- **Captures:** `after/436-tile.jpg`.
- **Intersections:** see the table below.

## 440 Tipping trough meter

- **Wrong:** from the plate camera, the raised half's water was hidden by its front wall.
- **Changed:** the camera moves to `[-0.18, 1.0, 1]` (from the left and well above). The water standing in the
  raised half now shows over its front wall through the fill (p0.2, p0.35, p0.7, p0.85).
- **Flume:** it already ends about 0.3 past the default crop (NDC x reaches 1 at 2.3 of its 2.63 half-length).
  Shortening it further would shrink the authored fit box (which intersects with the motion bounds), so it is
  left as is. It still ends in free space in wide or rotated views, as Brown breaks it off.
- **Captures:** `after/440-tile.jpg`.
- **Intersections:** no geometry changed.

## 442 Eisach pot wheel

- **How it works:** the current turns the wheel. Each rigid pot fills at the bottom and, inverted at the top,
  pours into a trough through the wheel.
- **Wrong:** the trough sat 0.08 under the pot mouths, so the pour could not be seen.
- **Changed:**
  - The trough is lowered to Brown's height, about halfway between the wheel top and the axle (y 1.40), and
    widened to a 0.9 board. All the spokes are in the rear rim plane and the pots' inner faces stay beyond r 1.9,
    so it passes clear of both.
  - Each pour is a continuous sheet the pot's width (`WaterStream`, reshaped in place each frame). It falls on its
    ballistic path from the mouth with the pot's own velocity, about 0.6 down to the trough water, and fades with
    the flow.
- **Captures:** `after/442-tile.jpg`, `cmp442.png`.
- **Intersections:** see the table below.

## 457 Well sweep and 458 Pulley with two buckets

- **Wrong:** at the top dwell the water drained from the upright bucket.
- **Changed:** the raised bucket is tipped about its ears to empty it.
  - Body, floor, rim and water hang in a tipper on the ear axis. The bail keeps hanging from the rope.
  - `tippedEmptying(u)`: the bucket tips to 118° over 62 % of the dwell, holds, then rights itself over the last
    30 %.
  - The water kept is exactly what the tipped bucket can still hold (the frustum volume under the level plane
    through the lowest lip point), so it empties by spilling over the lip.
  - The water mesh is the interior below a level plane: an exact frustum when upright, and when tipped the convex
    hull of the interior corners below the plane and the edge crossings (a fixed buffer, so the geometry keeps its
    identity).
  - One continuous pour stream falls from the lip. It fades with the spill rate.
  - The bail turns freely on the ears. Past about 60° of tip it falls to the pour side, so the far half of the
    rim does not swing up through it. The rope keeps the bail's crown, so the bucket hangs back by `bailHang`
    (in the factory state).
  - The factories' states carry `bucketTilt` / `leftBucketTilt` / `rightBucketTilt`, and the water fractions
    follow the spill.
- **Captures:** `after/457-tile.jpg` (p0.86–0.97), `after/458-tile.jpg` (p0.41–0.97), `cmp457.png`.
- **Loop:** clean. One pop of 2.4 % remains at 457's fastest spill (see the residuals).
- **Tests:** `movement-457`, `movement-458` and `well-bucket-interfaces` are updated for the tipper hierarchy and
  for tipping replacing the eased drain.

## 460 Bailing scoop

- **Wrong:** the low scoop hung at a pin line of 32° (top edge 41°) against Brown's shallow slant.
- **Changed:** a search of the four-bar found a pose that keeps Brown's plumb pitman and middle notch.
  - The pitman now takes hold 2.45 from the pivot, 25° below level, so the top edge is at 33°.
  - The beam stroke is 79° (high angle π − 1.05).
  - The raised floor still reaches 25.6°, past the 24° drain slope.
  - The pit water rises to −1.27, so the mouth dips 0.1 under it. The lift to the channel is 0.67.
  - Toggle margin: 0.24.
- **Captures:** `after/460-tile.jpg`.
- **Tests:** `movement-460` now pins the new selected lift (2.93).

## 461 Swinging gutters

- **Wrong:** the even serpentine threw its water from the free diagonal back over the right boxes into the pool.
  Brown draws only the top jet.
- **Changed:**
  - The highest diagonal joins the top pipe through a port where it passes behind it: a hole in the front layer's
    back plate plus a short collar between the layers. The stub above the port stays open as Brown's vent.
  - The even serpentine's top parcel climbs through the port on its exchange half and waits just past the
    junction in the top pipe. It pours on the left-down swing, ahead of the odd parcel, through Brown's one jet.
    Every horizontal run is still made while it slopes to its left end.
- **Captures:** `after/461-tile.jpg`, `cmp461.png`.
- **Tests:** `movement-461` is rewritten for the path end, the per-half inventory (the even serpentine holds 4
  parcels through the left-down swing), and both jets at the open left end on that swing only.

## 464 Hero's fountain

- **Wrong:** after each run the bowl refilled and the foot emptied over 2.5 s with no flow drawn.
- **Changed:** the loop is now continuous steady play, as Brown draws it playing.
  - The drain carries exactly the jet's return, so the basin, the air volume and the pressure hold.
  - The levels are held at the source pose (disclosed).
  - The plume is a willow of six ballistic threads with scrolling streaks over the faint crown, and the crown
    scrolls too.
  - Scrolling runs 0.8 tiles/s, 10 per loop, so the seam is clean.
- **Captures:** `after/464-tile.jpg`, `cmp464.png`.
- **Tests:** `movement-464`'s reset tests are replaced by steady-play checks (flows on, drain = jet, levels and
  pressure held, no reset).

## Intersections (`show-body-intersections --spacing=0.01 --samples=129`)

| ID | Before (ledger) | After (solid pairs) | Fluid or intended contacts |
|---|---|---|---|
| 430 | sampled clear | none | hub/shaft fit and feed stream at the partitions (both unchanged); the curtain touches nothing |
| 433 | sampled clear | none | boards sweeping the start of the shed sheets (water leaving the board tips) |
| 434 | sampled clear | none | water-to-water where guide and runner sheets meet; no sheet touches a vane |
| 435 | sampled clear | none | water-to-water only; the eye falls clear of the foundation ring and arms |
| 436 | sampled clear | none (rings gone, shutes reach the wall) | none |
| 440 | sampled clear | camera only | not rescreened |
| 442 | sampled clear | none (the lowered trough clears pots and spokes) | pots and their water dipping in the stream (intended) |
| 457 | sampled clear | rim×bail 0.050, body×bail 0.017, rope×bail 0.015 | all at the bail's hinge on the ears and the rope's knot on the bail crown (joints; the bail is now its own body) |
| 458 | sampled clear | rim×bail 0.045, body×bail 0.017, rope×bail 0.015 (deforming) | the same hinge and knot contacts |
| 460 | sampled clear | none | scoop in the pit water; scoop-water×trunnion 0.033 and ×discharge 0.020, both the same as pass 69 |
| 461 | sampled clear | none | the pool round the dipping pipes, boxes and water (intended) |
| 464 | sampled clear | none | none |

Bad faces (`scan-bad-faces`): only degenerate or same-look coplanar findings, and no inverted or mixed faces.
461 and 464 are clean.

## Residuals

- 433: the jet slants in 35° from the float motion. The shed sheets cross the next boards' tips as those sweep
  through the falling water.
- 435: the four eye passages over the support arms end at the eye, without a fall.
- 440: the flume still ends in free space in wide or rotated views (Brown breaks it off; it ends 0.3 past the
  default crop).
- 457/458: the dwells are short, set by the source keyframes (1.2 s and 0.75 s), so the tip is brisk. The spill
  falls back into the well or shaft, since Brown draws no receiving vessel. A 2.4 % visibility pop remains at
  457's fastest spill. The bail touches the rim at its ear hinges.
- 461: the even parcel waits in the top pipe through the right-down swing, and the jet shows two sequential
  sheets that read as a fan. Water movement is still a prescribed shift register.
- 464: the levels are held in steady play, a disclosed large-vessel approximation. A real run lowers the bowl and
  raises the foot.


## Loop seams

`check-loop-seams` over all twelve IDs: 0 seams. The only mid-cycle pop is 2.42 % at 457's fastest spill.

## Tests run

These pass:
- `water-stream`
- `movement-430`, `433`, `434`, `435`, `436`, `440`, `442`, `457`, `458`, `460`, `461`, `464`
- `water-wheel-430-432-solids`, `turbine-433-435-solids`, `fluid-rotor-436-438-solids`,
  `water-mechanism-439-440-444-solids`, `water-lifting-441-443-solids`
- `well-bucket-interfaces`, `well-scoop-gutter-solids`, `fountain-balance-interfaces`
- `movement-431`, `432`, `437`, `438`, `441`, `443`, `459`, `465`
- `reviewed-cycle-timing`, `source-presentation`
