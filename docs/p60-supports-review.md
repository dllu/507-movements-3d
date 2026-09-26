# Pass 60, lane p60-supports: pruning the added supports

Reviewer: Claude Opus 5.5 (lane p60-supports), 2026-09-25.

## Policy applied

Passes 54 to 59 read "show cut-off parts whole" too broadly. They added
stands, pillars, back bars, guides and extensions that Brown does not draw,
and some rods kinked into added stands. This pass applies the user's
correction:

- Keep a support only if Brown draws it, or if it is needed to show how a
  fixed pivot or guide is held. Keep any kept support minimal.
- Remove undrawn frames, back bars, pillars, feet, guides, hangers and
  hands.
- A rod that runs past Brown's break continues straight and ends cleanly. It
  never kinks into a stand.
- Fixed shafts without a drawn support end as plain stubs, as in the rest of
  the gear family.
- Be consistent across a family: all the 113 to 125 racks now have no
  supports, which matches 125.

Two methods were used:

- Undrawn parts built by p55 to p59 code were deleted in the factory, where
  that lane owned the code.
- Where the parts came from older authored factories, they were hidden with
  precise `remove` entries in `src/data/source-presentation.js`.

Every retained run-on is a straight coaxial extension of the moving part.

Captures come from a private Vite server (port 44513), restarted after every
batch of edits. Each capture shows the plate, the default view, rotated +60,
rotated -60, the back view and a far oblique view at 2.2x. They are in
`/dev/shm/y4/tiles/<ID>-{a,b,c,d}.png`:

- `a`: before this pass
- `b`, `c`, `d`: after this pass. Use the latest letter for each ID.

These are scratch files and are not committed. Movements 63 and 251 belong to
other lanes and were not edited.

## Per-ID decisions

| ID | Decision | What changed / reason | Capture |
|---|---|---|---|
| 13–22 | keep | The hauling hands pull the ropes. The ropes need a real end, and Brown's plate 12 draws a hand. They stay past the crop. | a |
| 23 | remove | Removed the guide-pulley back bar, the pillars and the driver bearing and pillar. The pulleys and driver turn on plain axle stubs, like the rest of the belt family. The frame fit is unchanged. | 23-d |
| 39 | remove | Removed the sun-shaft bearing, pad and pillar, and the crosshead and its guide, back plate and pillar. The rod ends cleanly at its upper wrist pin above the plate's crop, and the sun shaft ends in a stub. | 39-d |
| 48 | minimize | The operating rod now runs 2.1 straight and ends cleanly past the crop. It no longer runs on to a hand. The small fulcrum flange stays. | 48-b |
| 52 | remove | Removed the floor column under the fulcrum flange. The flange reads as bolted to framing, as in 48 and 53. | 52-b |
| 53 | minimize | The hanging rod ends cleanly just past the crop, with no hand. | 53-b |
| 64 | remove | Removed the back bar, the fulcrum and wheel bosses and the worm bearings (`wallGuide`). Brown's hatched spring clamp is restored to its own block. | 64-b |
| 75 | remove | Removed the back bar, the axle and pawl-pin bosses and the pillar and foot. | 75-b |
| 76 | minimize | Removed the axle pad, pillar and foot. The fixed bracket plate stays, because it carries both fixed pivots and sits between the wheels. | 76-b |
| 77 | remove | Removed the pads, the lever-pivot boss and the two pillars and feet. | 77-b |
| 80 | remove | Removed the back bar, the fulcrum boss, the stem guide channel and the foot. | 80-b |
| 81 | remove | Removed the back bar, the axle arm, the webs, the bosses and the foot. The rack guide and spring seat are drawn by Brown and stay. | 81-b |
| 83 | remove | Now hidden by presentation: the rockshaft sleeve bearing, the standard, the floor plate, the input guide rails and the guide posts with their feet. The upright-shaft collar bearing stays. | 83-b |
| 95 | minimize | Removed the rod guide and post. The rod runs on straight and ends 0.25 above the crop. | 95-b |
| 104 | remove | Removed the worm bearings, standards and feet. The journals are back to 0.10 stubs. | 104-b |
| 106, 107 | remove | Removed the shaft hangers and bearings. The shaft ends at Brown's break. | 106-b |
| 113 | remove | Removed the roller back bar, the bearings and the pillar. The rollers show plain axle stubs. Visual only; the motion is unchanged. This is a bake-tool pilot ID. | 113-b |
| 114, 116 | minimize | Removed the stub guides, the posts, the shaft pillars and the bearings (`rack-frame-guides.js` is now `addStubRunOns`). The end stubs keep straight run-ons past the crop. 116 keeps its output shaft's rear stub, because the native inertia needs it. | 114-b, 116-b |
| 115 | remove | Removed the run-ons, guides and pillars. Brown draws the short end tabs whole. | 115-b |
| 118 | remove | Removed the tail rod, the tail guide, the post and foot, and the upper-rack clips and posts. | 118-b |
| 122 | remove | Removed the kinked output-bar extension, the guide sleeve, the post and the foot. The bar ends at Brown's rounded end. | 122-b |
| 123 | remove | Removed the rod run-ons, the guides, the upright bar and foot, the shaft bearing bar and the run-on shaft tails. Visual only; the baked motion is unchanged. | 123-b |
| 125 | keep (none) | This was the reference: it has no added supports. | a |
| 127 | minimize | Removed the upper rack run-ons, the guides, the uprights, the tie and the rear bearing, and shortened the pinion shaft. Brown's caption requires the pumps, so the pump barrels and their feet stay. | 127-b |
| 142 | keep | The bracket is small and holds the stud and the guide, both of which Brown's text calls for. | a |
| 146 | minimize | Removed the stem guides, webs and flanges. The stems run straight and end past the framed view at every point of the stroke. | 146-b |
| 149 | keep | A first removal made the whole rear bearing frame vanish, which left the lever pivot and cam shaft floating. It was reverted. The frame lies behind the mechanism and carries the fixed pivots. | 149-b |
| 150 | remove | Hidden: the output guide, its bracket, the fulcrum standoff and the valve slide. | 150-c |
| 153 | remove | Hidden: the back bar and pillar. The axles are stubs. | 153-d |
| 154 | remove | Hidden: the rear post under the pulley. Brown draws the front standards, and they stay. | 154-b |
| 157 | keep | Hiding the crosshead would drop Brown's slider pin, so the entry was reverted. The p55 guide channel stays. | 157-c |
| 165 | remove | Hidden: the output guide box and the fulcrum bracket. | 165-b |
| 172 | remove | Hidden: the slider, the guide frame, the back bar, the posts and the flanges. The rod ends at the right. | 172-c |
| 178 | remove | Hidden: the tool-slide rails, the end stop and the slide past the plate. | 178-c |
| 181, 182 | remove | Hidden: the engine frame, stays and rod guides. The piston rod runs straight past the plate. | 181-c |
| 183, 184 | remove | Hidden: the back bar, the rod guide, the cylinder and the foot. The back weights stay, because they are real rod ends. | 183-c |
| 186–189 | remove | Hidden: the columns, beams, hangers, bearings and the 189 stud bracket. The eccentric rod runs straight to its sheave. | 186-c, 187-c, 189-c |
| 192–194 | remove | Hidden: the input-bearing column and arm, the wheel standard and the feet. The Hooke-jointed shaft ends at the input yoke. | 192-c |
| 197 | minimize | Hidden: the front shaft rail, the carriage, the channel post and the foot. The rear channel stays hidden behind the plate. | 197-c |
| 201 | remove | Hidden: the rod-A guides and the back bar with its foot. Rod A runs straight below. | 201-d |
| 219 | remove | Hidden: the pinion-shaft standard and the arbor footstep. | 219-c |
| 234 | remove | Hidden: the U-frame, cocks and foot bearing. The verge and arbor match Brown's free drawing. | 234-c |
| 236, 244 | keep | 244: Brown draws the C/C′ stops, and the foot is small. 236 has no added frame. | a |
| 252 | minimize | Hidden: the guide bush and arm on the standard. Brown's broken standard, continued down, stays. | 252-c |
| 253, 270 | keep | The return sheave standards sit below the crop. They show only in far views, and the rope needs them. | a |
| 262, 263 | remove | Hidden: the inferred head and tail standards and bushes. Brown's standard E carries the nut. The roller C post stays, because it holds the roller. | 262-c, 263-c |
| 272, 278, 286, 305, 318, 321 | keep | Small, and either needed for fixed pivots or drawn by Brown (278's floor sill is minimal). Not changed in this pass. | a |
| 327–329 | keep | Brown draws the bed, the standards and the framing (see the plates). | a |
| 333 | keep | Brown draws the grounded blocks. | a |
| 335, 337, 338 | remove | Hidden: the floor column under radius pin F. The flange reads as bolted to engine framing. | 335-c, 337-c, 338-c |
| 336 | remove | Hidden: the undrawn bed bar, column and pedestal. The diagonal member's bolting flange past the plate stays. | 336-c |
| 340, 351, 353, 354 | keep | 340 and 351: Brown draws the frame and guides. 353: a minimal fulcrum post. 354: a rear frame is needed to hold both stem guides. | a |
| 373, 376, 377 | keep | Brown draws the frame. 373's pulley standard sits beyond the crop. | a |
| 382–393 | keep | Brown draws or implies these supports: 385 the door and wall, 388 and 390 one rear upright, 392 the table, 393 the table and pillar. | a |
| 394 | remove | Hidden: the back bar, the pinion boss, the rod guide, the pillar and the foot. | 394-c |
| 396, 397 | keep | Minimal staff arm (396) and grounded sill (397), both for fixed pivots. | a |
| 398 | keep | The rear frame plate is hidden behind the discs and carries both shafts and the crosshead guide. | 398-c |
| 400 | minimize | Hidden: the back-bar pillar and foot, and the camshaft pedestals and feet. The bar and C-guides behind carrier A stay, because they hold the sliding carrier. | 400-c |
| 401 | remove | Hidden: the faceplate standard, the treadle pedestal and the feet. | 401-c |
| 405, 406 | keep | The drawing board is Brown's drawing plane. | a |
| 414–436 | keep | The casings, bells, cutaway heads and pedestals are drawn by Brown or needed for the shafts. | a |
| 440 | remove | Hidden: the flume post and sill. In the default view the flume runs off the plate edge as Brown draws it. | 440-c |
| 441, 458, 462, 478, 490, 491 | keep | Brown draws the standards, the well house, the frame, the deck and the ground line. | a |
| 498 | keep | The boiler head and saddle standards support a large body past the crop. Removing them would leave the boiler floating. | a |

## Kinks

Kinks are fixed by construction:

- 122's bar extension and 123's run-ons were the kinked cases, and both are
  removed.
- Every remaining run-on is a straight coaxial extension of the moving part:
  114 and 116 stubs, 127 piston rods, 146 stems, 95 rod, 48 and 53 rods,
  181 and 182 piston rod, 186 to 189 eccentric rods.

## Remaining flaws (honest)

- 440: in far and rotated views the flume's upper end hangs free. It is a
  fixed trough that Brown breaks off.
- 23 and 39: the ground shadow now shows under the default view, because the
  pillars that stood on the ground plane are gone.
- 52 and 335 to 338: the fixed-pin flanges read as small plates on unmodelled
  framing when the view is rotated.
- 104, 106 and 107: the screw and drum shafts end at Brown's break with no
  bearing.
- 192 to 194: the input yoke ends in free space when rotated.
- 189: the bell-crank stud has no bracket.
- These keep-or-minimize judgments are pending coordinator review: 149, 157,
  398, 400 and 498.
- 63 and 251 belong to other lanes and were not reviewed or edited.

## Files

Factories:

- `src/simulation/rack-frame-guides.js`
- `mujoco-{variable-traverse,double-rack,equal-racks,rack-rectifier,rack-pinion,stroke-doubler,inclined-disk,barrel-cam,serpentine-cam,worm-saddle}/geometry.js`
- `baked/sector-handoff.js`
- `authored-belts.js`
- `authored-gears-core.js` (39 only)
- `pin-clutch.js`, `jaw-clutch.js`, `reversing-clutch.js`
- `spring-jump-cam.js`, `reciprocating-pawl.js`, `jointed-tappet.js`,
  `alternating-peg-pawl.js`
- `crossed-rack.js`, `spring-rack.js`
- `opposed-pump-racks.js`
- `framed-yoke.js`

Presentation: `src/data/source-presentation.js`, entries for 83, 150, 153,
154, 165, 172, 178, 181 to 184, 186 to 189, 192 to 194, 197, 201, 219, 234,
252, 262, 263, 335 to 338, 394, 400, 401 and 440.

Tests:

- `mujoco-{double-rack,equal-racks,rack-pinion,rack-rectifier,stroke-doubler,variable-traverse}`:
  part counts reduced, and each now also asserts that no guide or pillar parts
  exist.
- `mujoco-inclined-disk`: the guide assertions are replaced by a clean-end
  assertion and a no-guide assertion.
- `mujoco-barrel-cam`, `mujoco-serpentine-cam` and `mujoco-worm-saddle`:
  part counts.
- `framed-yoke`: the stems stay past the framed view, with no guides.
- `movement-183` and `movement-184`: the supports are absent.

Validation reports rerun:

- `191-196-201-contact`
- `202-264-worm-solids`
- `200-226-bevel-solids`
- `146-assembly` (0 failing pairs)
