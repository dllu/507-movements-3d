# Pass 75, lane p75-fa: audit-73 lane-a fixes (415, 433, 435, 337, 338, 329, 346, 387, 408, 247)

Captures are in `/dev/shm/p75-fa/`, outside Git.
- `tiles/ID-before.jpg` and `tiles/ID-after.jpg`: the plate beside default phases 0, 0.25, 0.5 and 0.75, rotations of +60° and -60°, back, top, and both sides of the loop seam.
- `after/ID-default.png` and `after/ID-oblique.png` come from `scripts/review-movement-source-views.mjs`.
- `zoom/` holds the close views named below.

The audit findings and before-tiles are in `/dev/shm/audit73/a/`.

## 415 Dickson reversible drive: drive rod D

**Flaw.** An undrawn grey slotted guide box stood at the right end of rod D, with a slider block in it. D was also a round rod, where Brown draws a flat bar.

**Change** (`authored-dickson-reversible-drives.js`):
- D is now one flat extruded bar, 0.14 wide and 0.06 thick. It has a rounded eye on the lever-tail pin, and the bar is tangent to that eye.
- The bar runs straight past Brown's crop, 1.6 beyond its guided point.
- The guide bars, the end bridge and the slider block are gone. `inputSlider` survives only as an empty group marking the guided point beyond the crop.
- The bar turns on the pin and points at the guided point, so the connecting-rod kinematics are unchanged.
- The camera fit stops at x = 2.45, just past the wheel rim, as the plate's crop does. So the wheel fills the frame more like the plate.
- The presentation note is updated, and the stale `white-input-slider-joint-index` removal is dropped.

**Evidence.** `tiles/415-after.jpg` and `after/415-default.png`: no guide, and the flat bar runs off the right edge. In the ±60° views the bar ends cleanly in the air, well outside the default frame.

**Intersections.** Unchanged pawl/rim contacts and cord deformers. There are no new pairs, and mesh count fell from 28 to 23.

## 433 Horizontal overshot wheel: spout brace

**Flaw.** A diagonal timber brace ran from the overhead beam's end to the spout. Brown draws none.

**Change** (`authored-horizontal-overshot-water-wheels.js`): the brace block is removed. The spout is free and runs out of the picture to the upper right.

**Evidence.** `tiles/433-after.jpg`: no brace in the default view or at ±60°.

**Intersections.** Fluid and spray pairs only; no solid pairs.

## 435 Warren turbine: strut spider

**Flaw.** A four-armed strut spider and a shaft collar hung under the fixed ring.

**Change** (`authored-warren-central-discharge-turbines.js`):
- The spider and the lower shaft bearing are removed.
- The shaft is shortened from 2.32 to 1.60, so it ends as a plain stub just below the hub (an ideal fixed axis).
- The flow-description text no longer mentions a hidden lower support.

**Evidence.** `zoom/435s-after.jpg` shows the side and under views: only the shaft stub remains below.

**Intersections.** No solid pairs. Mesh count fell from 95 to 90.

## 337 and 338 Vibrating-rod parallel motions: radius pin F

**Flaw.** Pin F's wall-bracket shank ran back 4–5 diameters, from z 0.53 to -0.55, to a tiny flange. Its floor column had already been removed by presentation.

**Change** (`authored-vibrating-rod-parallel-motions.js`, both variants):
- F's wall bracket and its floor column are no longer built.
- F is the bare 0.34-long pin through the radius rod's eye (rod z 0.61–0.79, pin z 0.53–0.87), so it protrudes 0.08 each side.
- The O-shaft flange, which is not flagged and is hidden behind the beam boss, is kept.
- The presentation `remove` entries for 337 and 338 are dropped and their notes updated.

- **338 only (lead addition).** The eyes at pin U were 0.141 bores round a 0.095 pin, which left a visible crescent round the pin. The radius bar's eyes (F and U) and the vibrating rod's eyes (L and U) now close round their pins with 0.006 running clearance. The joint is unchanged: it was already centred analytically, with an end-to-pin error of 0.

**Evidence.** `zoom/337-338-after.jpg`. `zoom/338-U.jpg` shows pin U filling both eyes. shows the -60°, +60° and back views: short stubs only.

**Intersections.** None, before and after.

## 329 Epicyclic piston guide: wheel B

**Flaw.** Wheel B was a solid disc gear. Brown draws a four-spoked cog.

**Change** (`authored-epicyclic-piston-guides.js`):
- B's body is rebuilt with the shared `spokedWheelGeometry`, using its own 24-tooth involute outline. It has a rim inside 0.76R, four straight spokes 0.13R wide with small 0.03R fillets, a 0.21R hub and the 0.078 pin bore.
- The spokes stand at 30° and 120° in Brown's pose, as on the plate.
- The bore of the dark hub tube is now 0.0795 (in `piston-guide-329-331-parts.js`, `correctEpicyclicGuide`), so it no longer z-fights the web's 0.078 bore.
- There is no rotation cue, since the spokes show the turning.

**Evidence.** `zoom/329-B.jpg` beside `/dev/shm/audit73/a/p329.png`.

**Faces.** zfight 1 and zfightSameLook 2, the same as the audit baseline.

**Intersections.** None, as before.

## 346 Table engine: slotted guide

**Flaw.** A grey straight slotted guide at z 0.19 was paired with separate thin black tapered standards and a black tube arch at z -0.17, offset behind it. From the front this read as a black rim; from the side the two frames were asymmetric.

**Change** (`authored-table-engines.js`):
- The standards and the tube arch are replaced by one flat grey loop, which is the tapered outer frame Brown draws around the slot. Its legs taper from ±1.30 at the cover to ±0.91, and its top is a semicircle 0.18 wide.
- The loop is in the rails' own plane, depth (0.34) and material, so the guide reads as one consistent frame from every side.
- `blocks.guideStandards` is removed. `blocks.guideArch` is now the loop.

**Evidence.** `tiles/346-after.jpg` and `zoom/346-s.jpg` (+45°): the inner slot rails and the outer tapered loop are one grey plane, with no black rod.

**Intersections.** None; the old open tube arch is gone.

## 387 Tide ladder: water at the pier

**Flaw.** The translucent water box ran 0.38 past the wharf face across the full width, showing a pale blue strip on the pier face.

**Change** (`authored-tide-ladders.js`):
- The water is an extruded plan outline.
- It stops at the masonry face (x = face) across the wharf's full width, and enters only the recessed slot between the fixed posts.
- It keeps the same depth fade and level motion.

**Evidence.** `zoom/387-def0-crop.png`: no strip on the pier face at high water.

**Intersections.** The wall/water fluid pair fell from 0.325 to 0.000, a face touch. The boat hull in the water (0.130, a fluid pair) is unchanged.

## 408 Centrolinead: clamp slots

**Flaw.** The joint disc's slots were short 48° arcs, hidden mostly behind the legs, so they read as short notches.

**Change** (`drawing-gauge-parts.js`, `correctCentrolinead`):
- There are now two long arc slots with round ends, concentric with the joint. They span 25–150° and 212–335° from the blade, about 125° each, as measured on the plate with angle rays (`zoom/p408-rays.png`).
- The slots run from radius 0.437 to 0.507, centred on the clamp radius of 0.472.
- Each clamp screw stands in its slot.

**Evidence.** `zoom/408-j.jpg` beside `/dev/shm/audit73/a/p408.png`. The audit's "about 70°" undercounts the plate; the ray overlay gives about 120–125°.

## 247 Sounding-weight release: fixed world and weight exchange

**Flaw.**
- The "view follows the rod" display frame moved everything, so with a fixed camera the sea bottom slid vertically.
- The spent weight was carried 16 units aside in about 0.2 s, and vanished when zoomed out.

**Change** (`authored-sounding-weights.js` and the wrapper in the same file):
- **Fixed world.** The display frame stays at rest. Brown's pose now stands 0.8 above the bottom (`recoveredBodyY = seabedContactBodyY + 0.8`), so the default fit shows his rod, weight and foot with the bottom's surface just below. The bottom never moves.
- **Sequence** (11.4 s per sounding):
  1. The rod is lowered onto the bottom, the probe trips the catch, and the weight drops. The release and impact follow the unchanged finite-seat law.
  2. The rod is hauled up on its line to y = 24, out of any view.
  3. The spent weight settles slowly (7.4–11.4 s) into the soft bottom until it is wholly buried.
  4. Far above, a fresh weight is threaded on and the catch is set.
  5. The rod is lowered back into Brown's pose as the spent weight disappears.
- **Two alternating weights.** The fresh weight is the one buried in the previous sounding. It travels continuously and out of sight: sideways inside the bottom to x = -38, up there beyond the side of any view, and across above the view to the rod's line. Nothing fades, jumps or moves unsupported within three times the fit, and the seam checker reports no jump.
- **Bottom.** The bottom is now an opaque block, 84 × 3.6 × 3.4, deep enough to hold the buried weight.
- The loop is two soundings long (22.8 s), displayed at 16 s. The leadsman's hand keeps its offset above the rod.

**Evidence.**
- `tiles/247-after.jpg`: default phases.
- `zoom/247-wide.jpg` at 3× zoom-out over the loop: the bottom is fixed, the weight settles and sinks, and the rod returns.
- `after/247-default.png`.

**Intersections.**
- The fine screen (0.01, 129 samples) timed out at 40 minutes: the 84-unit bottom and the long weight travel inflate the grid.
- The coarse screen (0.02, 65 samples) finds the weight shell and its section faces inside the bottom block, up to 1.70. This is the intended settling and burial, and is not a defect.
- The line and knot deformers are as before.

**Checks.** `check-loop-seams`: score 0, with no jump or pop. The earlier fit reported a 79.8% jump before the hidden travel was made continuous.

**Residual.**
- The settling and burial of a 3-unit ball in the bottom are a reconstruction device to close the loop in a fixed world. They are not caption-sourced.
- The hidden carrying gear is not modelled.
- The fresh weight's route passes outside the default and 3× views, but it could be found by panning far to the side or up.
- The bottom's surface now shows at the bottom edge of Brown's default pose, although Brown draws none.

## Tests

Updated or added:
- `movement-415`: flat bar, no guide, runs past the crop.
- `movement-433`: no brace.
- `movement-435`: no spider.
- `turbine-433-435-solids`: fixed list; 434's bearing is kept.
- `movement-337` and `movement-338`: no bracket or column at pin F.
- `movement-346`: one loop in the rails' plane.
- `movement-387`: water stops at the face.
- `movement-408`: long slots.
- `movement-247` and `release-mechanism-working-parts`: fixed world, continuous weights, new timeline.
