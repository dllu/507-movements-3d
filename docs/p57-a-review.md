# Pass 57, lane p57-a: movements 1-127

Reviewer: Claude Opus 5.5 (lane p57-a), 2026-09-25.

Sources: `/dev/shm/audit57/a/findings.json` and its tiles, the `visibleFlaws`
rows in `docs/movement-status.json`, and the lane briefs (p53, p54, p55 and
p57). The p57 support convention applies throughout. Where Brown draws no frame,
fixed pivots, shafts and guides are carried on a plain back bar, pillar or
bracket behind the moving parts, in frame colour, grounded on a foot.

All captures were taken from a freshly restarted, non-watching Vite server
(port 44471) on the production route. Each ID has the plate, the default view
at two phases, rotated +60 and -60, back (160 degrees, pitch 10), top (pitch 70),
bottom (pitch -70), and a 2.2x zoomed-out oblique. The final captures are
`/dev/shm/n57a/t<ID>-f.png`, with single views in `/dev/shm/n57a/raw/<ID>-f-<view>.png`.
These are scratch files and are not committed. 110 uses its own view set:
default, side, two obliques, a low view and far.

## New shared helpers

- `src/simulation/back-plate-support.js` provides the shared p57 support
  pieces: `backBar`, `backPlate`, `pinBoss`, `bearingBoss`, `footPillar`,
  `slideSleeve`, `supportMaterial` and `freezeFitBoundsWithout`. The last one
  keeps added supports out of the plate framing. Pads and bosses are closed
  turned solids.
- `src/simulation/rack-frame-guides.js` provides `addStubGuides`. It extends a
  reciprocating rack frame's broken-off end stubs whole into fixed rectangular
  guides past their reach, and adds rear bearings for the fixed shafts. The
  guides and bearings stand on floor posts, so no tie bar crosses the open
  frame window. It is used by 114, 115 and 116.

## Per-ID changes and evidence

The worst solid depth is from `scripts/screen-production-intersections.mjs`.
The spacing and sample count are given in brackets. The "before" column is the
ledger status.

| ID | Change | Capture showing the fix | Worst solid after |
|---|---|---|---|
| 13 | The hauling fall now ends in plate 12's hauling hand (`makeHaulingHand`) just past Brown's crop, on a constant-length rope. The camera fits the swept silhouette including the hand. | def0, r60, far | 0 (0.025/65) |
| 23 | The guide pulleys B turn on axles that run back to a plain back bar, standing on a pillar and foot behind the counterweight. The fixed driver's keyed shaft runs in a bearing boss on its own pillar. | r60, back, top, far | 0 (0.025/65) |
| 39 | The fixed ring is now Brown's open four-part ring. It has a continuous rim and four separate quarter segments. The open gaps are 0.14 wide (Brown's width, about 11% of R) with filleted mouths. The segments are recessed behind the rim face and stop just inside the sun's tooth roots, so the middle is open round the sun shaft. The ring is fixed: it no longer turns with the sun, and a spacer carries it on the sun-shaft pillar. The rod's upper wrist pin works in a crosshead that slides between guide bars on a back bar, grounded on a pillar. The sun shaft runs in a rear bearing on its own pillar. Framing is frozen without the supports. | def0 (open gaps; the ring does not turn in def5), back (open ring, sun visible through the middle), r60, far | 0 (0.01/65); an earlier 0.06 coaxial shaft-in-pad overlap was fixed by ending the shaft at the pad face |
| 47 | The quarter-cut section's horizontal cut faces were single-sided and faced downward, which left hairline shells from above. They now render double-sided, so both cut planes read as solid faces from above and below. The shifting lever's arm ends in a turned grip, and its pivot pin stands on a bracket post with a foot. | top and top2 in `t47-z.png` (solid horizontal cut faces), bot and bot2 (solid), def0 | 0 (0.01/129). The coaxial cap-in-body pair (0.0896) is the intended section cap. The pin-in-bore pair (0.0016) is unchanged. |
| 52 | The handle now ends in a turned round grip (closed lathe). The fulcrum flange stands on a plain column with a foot on the floor below the disks. | def0, r-60, back | 0 (0.01/129) |
| 61 | Brown's text says the curb is "weighted at the end". Both friction-band legs now run down into one hanging weight below the crop. Neither leg ends in mid-air. | def0, back, far | 0 (0.025/65) |
| 64 | The spring clamp (Brown's hatched fixed block) runs back to a plain back bar hidden behind the lever and the wheel. The bar carries the follower fulcrum boss, the wheel shaft's bearing boss and both worm-shaft bearings (`wallGuide`). | top, back, r60 | 0 (0.025/65) |
| 75 | The holding-pawl pin and the wheel axle are carried on bosses on a narrow back bar behind the wheel, grounded by a pillar and foot. | r60, top, back | 0 (0.01/129) |
| 76 | A fixed bracket plate is clamped on the common fixed axle, in the gap between the count wheel and the driver. It carries both fixed pivots, C and the holding pawl's pin. The axle runs back past the driver onto a pillar and foot below the large wheel. | r60, r-60, top | 0 (0.01/129) |
| 77 | Lever A's fixed pin and the wheel axle each run back into a boss on a plain pillar and foot, behind the lever and the wheel. | r60, r-60, top | 0 (0.01/129); pin/pawl pairs are working contact |
| 80 | Bar A's stem, already modelled whole, slides in a closed guide channel below Brown's crop. The channel always holds the square end. The fixed fulcrum's boss is on a back bar hidden behind the rack, standing on a foot below the channel. | far, back, bot | 0 (0.01/129); hook/rack pairs are working contact |
| 81 | The spring seat and the lower rack guide have webs to a back bar hidden behind the rack. The bar also carries the gear-axle boss and the travel-stop boss, and stands on a foot below the rack's lowest reach. | back, r-60, top, far | 0 (0.01/129) |
| 83 | The presented model now keeps the rod A slider, its guide rails and its two guide posts. The rockshaft runs in one long sleeve bearing on a plain standard hidden behind the crown wheel. Small floor plates replace the full base, and the outboard rockshaft standards stay removed. The camera box is unchanged, so the slider guide stands at the right edge. | def0, r60, r-60, back | 0.0009 (0.01/129), frontSector x wheelTooth: native working contact, supports clear |
| 84 | Brown's two bearing posts stand on a sill, and each end-rod guide stands on a plain post and foot. They are flagged `beyondPlateCrop`. | far, r60, r-60 | 0 (0.01/129) |
| 99 | Brown's two frame uprights run past his crop to feet on the floor, with a stronger crossbar and spine. They are flagged `beyondPlateCrop`. | far, back, r-60 | 0 (0.01/65) |
| 101 | Brown's hatched ceiling is now a solid beam, not a knife-thin sheet. Each guide is bolted to a narrow strap hanging from it. | r60, top, back | 0 (0.01/65) |
| 104 | Each screw journal (lengthened) turns in a bored boss on a plain standard and foot just past the bed ends. The wheel shaft is now dark steel with a retaining collar, so it reads through the pedestal bore instead of showing the wheel through the hole. | def0, far, r60 | 0.0001 (0.01/65), worm/wheel working mesh |
| 106, 107 | Both drum shaft ends run on into bored bearing bosses on plain hangers dropped from Brown's ceiling beam, behind the follower rod's plane. The helper is shared (`addShaftHangers` in mujoco-barrel-cam/geometry.js). | def0, back, r60 | 0 (0.01/65) |
| 110 | Brown's plate is a plan view. The model now lies flat: presentation rotate [-pi/2, 0, 0], camera from above, fov 14. With gravity down, the near half-nut rides on top of the roller and the far one under it, as the caption says. The frames are the tops of end standards running down to feet. Physics is unchanged, and its gravity is still normal to the plate. | def0 (plan matches Brown), side (one nut over, one under the roller), obl, obl2, low | 0 (0.01/65) |
| 113 | Each support roller turns on its own axle in a bearing on a back bar behind the rack. The bar also carries the pinion shaft's rear bearing and stands on a pillar below the pinion. | back, r60, r-60 | 0 (0.01/65) |
| 114, 115, 116 | The frame's end stubs run on whole, as one piece with the frame, into fixed guides past their reach (`addStubGuides`). The guides and the pinion shaft rear bearings stand on floor posts, so the open window stays clear. The camera box is unchanged. | def0, r60, r-60, top | 0 (0.01/65) each |
| 118 | The pitman's end pin carries a tail rod that slides in a fixed guide on a floor post past the bed end, so the pitman no longer ends at a bare eye. The upper rack runs in two fixed clips on posts rising from the bed behind the racks. | def0, r60, back | 0 (0.01/65) |
| 122 | The output bar runs on whole along its slide axis into a fixed guide on a floor post just past its reach. | def0, back, far | 0.0003 (0.01/65), gear mesh |
| 123 | The rack's rods run on whole into fixed guides above and below. The guides hang on an upright bar behind the gears, on a foot. The bar also carries the three shafts' rear bearings through a cross bar. Only fixed parts and rack-rigid run-ons were added, so the baked motion is unchanged. | r60, r-60, back, far | 0.0004 (0.01/65), spur mesh |
| 127 | Each rack runs on above into a fixed guide, and "attached to the pistons of two pumps" below: a piston rod into a closed pump barrel on a foot. Two uprights and a narrow tie behind carry the guides and the pinion shaft's rear bearing. | far, r60, back, bot | 0 (0.01/65) |

Addendum: 13, 23, 61 and 64 were screened at 0.025/65, because 61 and 64 time
out at 0.01/129 and 13 runs out of memory. None of the four has a solid pair. 23
first showed a 0.025 coaxial pair: the driver's keyed shaft ran into its rear
pad. The shaft was shortened to end inside the bearing boss, and a rescreen
gives 0. The only other pair is the deforming 13/23 rope against the anchor eye.

## Tests

The tests were run and all passed. Pinned values were updated only where the
fixes changed them legitimately:

- Part counts: 076 (24 to 26), 083 topology (84 to 89), 104 (10 to 17), 106 and
  107 (11 to 15), 110 (20 to 22), 113 (7 to 20), 114 (4 to 23), 115 (7 to 29),
  116 (14 to 33), 118 (11 to 21), 122 (19 to 25).
- 039: `sun-planet-contact` and the `models.test` block now check a fixed,
  non-rotating open four-part ring in place of the slit flywheel web.
- 084, 099, 101 and 104 camera-bounds loops skip parts flagged `beyondPlateCrop`
  (floor supports past the crop). 127 checks the toothed rack solids, not their
  run-ons.

Files run: friction-clutch, friction-family-working-solids,
one-way-clutch-working-solids, pin-clutch, held-side-differential,
spring-jump-cam, reciprocating-pawl, jointed-tappet, alternating-peg,
crossed-rack, spring-rack, selector-rack, opposed-pump-racks,
sun-planet-contact, movable-belt-drive, hoist-hardware, mujoco-spring-sector,
mujoco-spiral-feed, mujoco-slotted-bar, mujoco-worm-saddle, mujoco-barrel-cam,
mujoco-serpentine-cam, mujoco-half-nut-candidate, mujoco-rack-pinion,
mujoco-double-rack, mujoco-equal-racks, mujoco-rack-rectifier,
mujoco-stroke-doubler, mujoco-variable-traverse, mujoco-sector-handoff, and the
models.test blocks for 13, 23, 39, 47 and 84.

`source-presentation.test.mjs` fails on 374 (`white-face-spin-index`), which
belongs to another lane. The entries for 83 and 110 validate.

## Residuals (honest)

- 39: Brown's segments and rim read as one casting. In the default view the ring
  still looks like Brown's segment face with four open gaps, because Brown draws
  it that way. The difference is now visible from the back and in oblique views
  (open middle, separate segments), and in motion (the ring stays still). The
  crosshead guide is a tall plain bar at the top of the default view, where the
  rod runs to its real attachment.
- 23, 39, 47, 52: the support pillars and feet are visible in the default view
  below the mechanism. They are plain and small.
- 64: the back bar's horizontal run at the fulcrum height shows above the wheel
  when the lever drops.
- 83: the rod A slider guide and its posts stand at the right edge of the default
  view. The camera box is unchanged because the tests pin it.
- 110: the plan view's end standards read as Brown's frame rectangles only from
  above. The selector is still driven automatically.
- 114, 115, 116: in the default view the guide posts show just past the frame
  ends and the shaft pillars below the frame.
- 127: the pump barrels and the rack run-ons show at the top and bottom edges of
  the default view.
- 75 (not in the findings): rod C still ends at Brown's crop.
