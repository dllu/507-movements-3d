# Pass 54: water and flow representation (lane p54-water)

Scope: the pass-54 rule that water shows as real water (translucent blue
volumes or surfaces where water physically is, never flat sheets of hatch or
dash strokes) and that symbolic flow indicators (arrows, streamline tubes,
flow dots and particles, anything showing through opaque walls) are not
drawn. Real visible jets, spray and falling streams stay. Motion laws are
unchanged everywhere. Captures came from a private non-watching dev server
(default at two phases, rotated 60 degrees, back, top, oblique and low
views) before and after each change, plus close zooms where a detail
mattered; all were inspected.

## Shared pieces

- `src/simulation/water-volume.js` (new): `waterVolumeMaterial()` (fluid
  blue, opacity 0.4, depthWrite off so immersed parts stay visible, fog off,
  below the 0.6 opacity the clearance screens treat as fluid),
  `waterVolumeGeometry()` / `waterVolume()` for a body from its free surface
  to its bed.
- `src/simulation/mirrored-fork-pipe.js` (new): `mirroredForkWall()` builds a
  symmetric Y of round pipe as one hollow wall. The left leg runs on through
  the fork up the stem on x = 0; that pipe is cut at the symmetry plane and
  joined to its mirror image, so the legs merge into the stem with a flared
  neck, a clean crotch and no internal walls. An optional `cut` predicate
  opens a port where another pipe passes through the wall.
- `src/simulation/ruled-water-lines.js` (deleted): every user now draws
  water as a volume.

## Per movement

- **441** Persian wheel: the stream is a translucent body from the surface
  down 1.75 across the plate width and the wheel's depth (was a sheet of
  dashed strokes floating on one plane). The lowest floats and bucket dip
  into it.
- **442** Eisach pot wheel: the stream is a body under the wheel from the
  surface to the bed, running with the current (was surface strokes); role
  renamed `rightward-stream-partly-immersing-peripheral-pots`.
- **443** Archimedes screw: the river round the lower wheel is one body from
  the surface to the bed (was a field of wavy strokes). Unchanged residual
  owned elsewhere: the wheel behind the buckets is still a solid disc.
- **447** Reaction ferry: the river is a visible body between the banks,
  down to a bed below the rudder; the banks are solid earth blocks rising a
  little above the water (were flat hatch bands). Brown's feathered current
  arrow is not modelled. The anchor line is the shared laid rope (same wavy
  plan shape and exact tether length). The anchor stock now reaches the bed,
  so the fixed centre is held rather than floating on the surface.
- **461** Swinging gutter: the pool is the translucent body the working-parts
  pass already sized (the ruled override is gone), and each forward slug
  fills the gutter bore (was a thin stroke on the channel floor). The spray
  from the top outlet stays.
- **463** Self-acting weir: head and tail water are bodies across the gate
  width. The head water runs up to the closed leaves' face and rises and
  falls with the head. When the upper leaf leans downstream, a slab carried
  on its upstream face, clipped to the head level and to x >= 0 by material
  clipping planes, fills the wedge that opens between the leaves, so the
  water meets the leaves at every phase. Every piece keeps fixed geometry
  (only transforms and planes move): a first version rewrote a prism buffer
  each frame, which made the clearance screen cache a dense point set per
  frame and run out of memory. The tail water starts at the closed lower
  leaf's face. The notch overflow is a falling sheet the notch wide and the
  ordinary head deep on a parabolic nappe (was a round hose), and the scour
  flow fills the opened passage under the lower leaf. The bed plate stays.
  The clipped wedge has no lid of its own where the plane cuts it.
- **464** Heron's fountain: water in the sectioned hollows (top trough,
  right leg, jet pipe and spire, hollow foot, hung bowl) is a translucent
  section body filling each hollow from its far face to the cut plane (was
  horizontal hatch strokes); the foot and bowl bodies keep their clipping to
  the moving levels. The plume's streaks are continuous falling jets (the
  dashed tails are gone).
- **465** Balance pumps: the well between the masonry banks holds a body of
  water from the surface to the floor (was a few strokes).
- **455** Old rotary pump: the two ArrowHelper flow arrows are removed. The
  outlet duct's back wall now reaches in to the casing bore, closing the
  port cut in the ring where the background showed through.
- **456** Cary pump: both flow arrows (the inlet arrow and the arrowhead
  under the spout) are removed. The rear spider that carries drum B on its
  axle is opaque like the drum (it was a ghosted 0.22-opacity bar).
- **469** Temperature air machine: air bubbles are seen only where they rise
  free through the warm bath; inside the opaque pressure pipe they are not
  drawn, and they no longer ignore depth (they had shown through the tank
  walls and read as rivets along the pipe).
- **475** Bilge ejector: in steady running the bilge water fills B, D and C
  (translucent bodies in the bores; D follows the smooth pear section). The
  four streamline tubes, the steam core, the steam jet rod and all markers
  are not presented (source-presentation `remove`; the offline model keeps
  them for the flow tests). Pipe A is opaque.
- **476** Steam siphon: the fork is rebuilt as opaque round pipe with
  `mirroredForkWall` (it was a translucent extruded outline slab that read
  as loose sheets from above or the side). Brown dashes A where it runs
  behind B, so B is opaque. Pipe A (now opaque) enters the crotch through a
  port whose ragged edge lies inside A's own wall. Streamline tubes, steam
  core, jet and markers are not presented; the striped artefact where A
  crossed the translucent wall is gone with the translucency.
- **486** Pivoted-sail windmill: the remaining wind arrow and the thin
  reference circle through the sail pivots are not presented. Both are
  notation (the wind and the sail track); a real hoop at that radius would
  foul the pivoting sails.

Found in the sweep beyond the assigned list:

- **430** Overshot wheel: the feed off the flume is a sheet the width of the
  flume water (was a round hose); the droplet beads riding it are not
  presented.
- **432** Breast wheel: the feed into the cells is a sheet, and the tailwater
  is a shallow body on the race floor the width of the floats (both were
  round hoses).
- **434, 435** Fourneyron and Warren turbines: streamline tubes, flow
  particles and the hose-like torus of discharge/supply water at the rim are
  not presented.
- **436, 437** Jonval turbine and volute wheel: flow particles (and 436's
  hidden paths) are not presented; 437's volute water body stays.
- **438** Barker's mill: each arm throws one continuous jet that leaves
  tangentially and falls away, turning with the runner (it was only a trail
  of beads); the inlet beads are not presented.
- **439, 440** Bucket reciprocator and tipping meter: no beads in the falling
  stream.
- **444** Hydraulic ram: air-charge markers are not presented (the jet spray
  droplets stay).
- **448, 450, 451** Lift and force pumps: flow tracer beads are not presented
  (450's showed in the delivery pipe on the downstroke).
- **459** Well lift: the well water is a body from the surface where the low
  bucket dips down to the shaft floor (was a thin plate).
- **460** Bailing scoop: the basin water fills the trapezoidal section
  between the sloped banks from the surface to the floor (was a thin sheet).
- **462** Chain pump: Brown rules water round the lower wheel; the pump now
  stands in a body of water that submerges the return wheel and chain intake
  (the reservoir had been hidden).
- **387** Tide ladder: the tide is a body from its moving surface to the bed
  at the wharf foot (was a thin sheet).
- **478** Expansion trap: the condensate guide lines are not presented.
- **481, 483** Gas meters: gas-flow beads are not presented.

Kept as real visible streams: 433's jet and the spray under its scoops, 438
and 461's jets, 439 and 440's falling streams, 444's fountain spray, 464's
plume, 475/476 have no visible free stream.

Tried and reverted: 395's orange and blue passage cores are colour-coded
steam, but with them hidden the white plug and body leave the passages
barely readable, so they stay until the plug is given a contrasting
material (reported for review).

Left for others (not water): 267's direction arrow (marks lane removed it);
the translucent shells of 450/451 (glass-style barrels), 459's well shaft,
475's chamber D and 478's pipe and sphere, which are section/cutaway styling
rather than flow notation.

## Tests

Updated only where a removed or rebuilt part was pinned:
`tests/movement-447.test.mjs` (no arrow role), `movement-463.test.mjs`
(render bounds use exact vertex bounds, since the leaning wedge slab's
rotated box overestimates them), `movement-475.test.mjs`,
`movement-476.test.mjs` (flow notation not presented; water fill present),
`movement-434/435/436.test.mjs` (flow notation not presented),
`ejector-trap-working-solids.test.mjs` (476: no fork back plate; the steam
core must clear the rebuilt fork wall and its port by 0.02).

Run: the per-ID tests for 387, 430-451, 455, 456, 459-465, 469, 475, 476,
477-481, 483, 486, 395, the family solids tests (water-lifting 441-443,
water-mechanism 439/440/444, water-wheel 430-432, turbine 433-435,
fluid-rotor 436-438, rotary-pump 455/456, old-pump-455 contact, temperature
air 469, thermal steam 469/474, ejector-trap, chain-weir, well-scoop-gutter,
cock-ferry, flexible-pump 452-454), `source-presentation` and
`authored-loader`: all pass.

## Intersections

Relative-motion screen, 0.01 spacing, 129 samples (solid pairs only; water
bodies are fluid by role and opacity):

| ID | Result |
| --- | --- |
| 387 | no solid pairs |
| 430 | no solid pairs |
| 432 | no new pairs; pre-existing coaxial 0.220 hub and spokes x main shaft (shaft body separate from the wheel) |
| 438 | no solid pairs |
| 441 | no solid pairs |
| 442 | no solid pairs |
| 443 | no solid pairs |
| 447 | coaxial 0.0000 rope seated in both swivel bores; no solid pairs |
| 455 | pre-existing intended coaxial 0.087 valve hinge pins in the rotor; no solid pairs |
| 456 | solid 0.0000 cam x piston (rolling contact); no penetration |
| 459 | pre-existing solid 0.0071 worm x star wheels, deforming 0.0127 laid rope x bucket bails (rope lane). The screen now needs a heap above 4 GB for 459: the per-frame laid rope (178k dense points per version) dominates; the static well water adds 0.3M points once |
| 460 | no solid pairs |
| 461 | no solid pairs |
| 462 | no solid pairs |
| 463 | coaxial 0.0000 deposit seated on the bed; no solid pairs |
| 464 | no solid pairs |
| 465 | pre-existing operator-figure limb overlaps (up to 0.117) and seated check disks (0.0000); nothing from the water |
| 469 | no solid pairs |
| 475 | no solid pairs |
| 476 | no solid pairs (A passes the fork wall through its port) |
| 486 | no solid pairs |
