# Pass 59: user fixes and rotated-view audit items (lane p59-fixes)

Captures: fresh, from a restarted non-watching server (port 44502), under
`/dev/shm/x2` (`after/`, `a1/`, `acue/`, `cand2/`, zooms `z*.png`). Movement
70 was handed to the p59-hidden lane (63, 67, 70, 71, 73, 76 not edited).

## 39: spoked flywheel on the sun shaft

The grey wheel behind the sun gear was a fixed ring of four segments (a disk
with slits). It is now the fly-wheel the caption says the sun is keyed to: a
rim, four thin radial spokes (0.11 wide, Brown's paired radial lines) and a
bored hub seated behind the sun's flange, open between the spokes. It turns
with the sun (`flywheel.rotation.z = sunAngle`). The fixed spacer that tied the
ring to the pillar is gone; the hub turns on the sun shaft, which is carried
by the existing bearing and pillar. Captures `after/39-default.png`,
`a1/39-def5.png` (spokes turned), `a1/39-rot60.png`, `a1/39-back.png`.
Intersections: clear (5 bodies, no pairs). Tests: `sun-planet-contact` (new
flywheel test: spokes, open web, bored hub, turns with sun, orbiting parts in
front), `models.test` movement 39.

## Display timing for fine teeth (24, 25, 26, 41, 42, 43, 44, 53)

New `scripts/inventory-rotating-parts.mjs` measures, per rigid body, the tooth
count (angular outer-radius profile in nine axial slices, confirmed by
mid-line crossings) and the tooth-passing frequency. A general cap at 6
teeth/s would have changed 69 movements, stretching escapements, indexing
trains and long clockwork cycles to minutes (57 to ~45 min, 260 to 148 s,
414 to 162 s) and catching false positives (pawls, threads). Restricted to
movements at the 2 s default loop it would still have changed 34, 37, 40, 48,
49, 120, 122, 123, 125, 173, 269, 283, 366, 411 and 506 as well.

Choice: the principle lives in `display-timing.js`
(`MAX_DISPLAY_TOOTH_PASSING_RATE` = 6 teeth/s at the pitch circle) but is
opt-in through `FINE_TOOTH_PASSING_RATES` (authored rates checked against the
factories' tooth counts). Display periods that change (all were 2.00 s):

| ID | wheel | display cycle |
|---|---|---|
| 24 | 30 t | 5.00 s |
| 25 | 36 t | 6.00 s |
| 26 | 28 t spur | 4.67 s |
| 41 | 28 t | 4.67 s |
| 42 | 40 t | 6.67 s |
| 43 | 44 t | 7.33 s |
| 44 | 36 t rows | 6.00 s |
| 53 | 40 t | 6.67 s |

No other ID's period changes. Candidates for the same treatment (review):
40 (the pair of 41, 14 teeth/s), 34, 37, 48, 49, 120, 122, 123, 125, 269, 366,
506. Tests: new `display-tooth-passing.test.mjs`; `models.test` 41/42/44 pins.

## Rotation cue

Given the cue (data list `src/data/rotation-indicators.js` unless noted):
28 (facing recoloured from black to the disk's blue, so the cue is the
standard subtle tone), 47 (factory: both turned clutch members, about rotor
Z), 56, 58 (loose and input pulleys), 61, 62 (fast, loose and side pulleys),
89, 90 (eccentric sheaves turn their cue about the shaft axis), 95 (disk,
bell hub, collar, roller), 262, 263 (cone B and boss), 272 (cam body and
working band, axis X), 281, 282, 291, 296, 314, 320 (both roughened
pulleys), 352 (barrels and sheaves), 354, 361 (hand wheel and both belt
pulleys), 362 (the turning lower cylinder: the upper drum only traverses, so
it takes no cue), 373 (wagon wheels; the large wheel shows its spokes). 358
already carried it (carriage wheels; seen in zoom `z358.png`).

Detection: the inventory script also lists featureless rigid bodies and plain
turned meshes inside featured bodies (discs carrying a pin or groove) that
lack the cue. Its full run was reviewed by eye (`cand1-3.png`); clear plain
discs added: 68, 131, 142, 146, 153, 156, 157, 158, 159 (flywheel disk), 166,
230, 360 (flywheel), 401, 416, 426, 471 (production names for baked models).
Captures `cand-after.png`. Left for review (unnamed meshes need a factory
change, or production is MuJoCo): 29, 52, 65, 92-94, 98, 121; most other
listed items are hubs, shafts, balls, worms or rims of spoked wheels.

Captures for the listed IDs: `acue-*.png` (default, +60, back), zooms
`z3.png`, `z4.png`.

## Other audit items

- **277**: the stirrup link and mainspring were present but hidden behind a
  large lock-plate hull. The lock plate is now a boss round the tumbler arbor
  with three narrow arms (to spring c's block, the cylinder-arbor lug and the
  mainspring root block), face area under 3; the stirrup and mainspring show
  from the front and back (`a277.png`). New test pins the link on the hammer
  pin and in the mainspring eye at five phases, visible from the front, not
  covered by the plate from behind, and the plate small. Intersections clear
  (6 bodies). Residual: the arm to the mainspring root shows below the leaf.
- **86**: the two runs are one endless three-strand laid rope (`laid-rope.js`)
  in round-bottomed grooves of the rear sheave and the remote sheave; the lay
  travels with the sheaves. The study candidate now reuses the production
  rear drive. Intersections: only zero-depth working contacts (worker run with
  12 GB; the default launcher runs out of memory on the rope). `z86*.png`.
- **272**: the disk keeps Brown's proportions; its rim vertices were shared
  between face, rim land, bevel and rear face, so blended normals shaded it as
  a lens. Normals are now creased (flat rear face, crisp land and bevel;
  `z272.png`), and it carries the cue. Closure test welds by position.
- **315**: the smooth cone is a 14-tooth bevel pinion (large end up, just
  under the bar); a plain back pillar joins the bearing bar to the foot,
  hidden behind the spindle in the default view (`z315*.png`). New test.
- **288**: the pallets are the anchor's steel and joined to the arm ends by
  webs in the anchor's front layer (in front of the wheel face, so no tooth
  can meet them); the thin strap is gone (`z288d/e.png`).
- **323**: the white axle collar is removed (Brown's C is a letter).
- **334**: the wear strip on rack B is the rack's colour.
- **346**: the table top edge and gland collar are the frame colour.
- **348**: cap normals of disk A are set flat; sliver triangles from the
  hole bridge had noisy normals (the seam). Back view clean.
- **282**: the hub stands 0.04 proud of the disk and axle faces (the hub was
  flush with both and z-fought); zoom `z4.png`.
- **361**: the hand wheel's flat faces end in their own ring before the
  rounded rim (flat shading; `z4.png`).

Intersections (0.01, 65 poses) after: 39, 277, 288, 28, 348, 361 clear; 315
only its intended flexure seats; 282 only the cord-eye ties; 334 zero-depth
roller contact; 272 and 346 open-mesh notes unchanged; 47 section-cap pairs
unchanged (material-only change).

## Validation reports

Regenerated: `200-226-bevel-solids.json`, `202-264-worm-solids.json`
(POSES=33; results identical, fingerprints updated). Still stale through
other lanes' files as well: `191-196-201-contact.json`
(`irregular-gear-family.js`, `primitives.js`) and `205-208-209-contact.json`
(`variable-drive-205-209-parts.js`, `primitives.js`); my `authored-gears-core`
hunks touch only 28 and 39.
