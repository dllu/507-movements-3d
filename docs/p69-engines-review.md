# Pass 69 — steam engines 421, 422, 423, 426, 428 (lane p69-engines)

User feedback: "Generally, all the engines need a lot of work." Each engine
must work as a steam engine: steam admitted through real ports into the right
space at the right time, pushing the piston or vane, exhausting on the return;
spaces properly separated; pistons closed; no walls that block function.

All five engines now show steam as clean translucent volumes in the section
(no arrows, tints or marker spheres). Live steam is pale and dense; exhausting
steam is faint. The volumes are the actual spaces, recomputed every frame from
the part positions. They are shared through the new
`src/simulation/steam-section-kit.js`, which also provides section plates:
casting plates cut on z = 0 with the plain cut-face shade.

Captures (outside Git): `/dev/shm/p69-engines/before/*` (before),
`/dev/shm/p69-engines/after/*-default.png`, `*-oblique.png` (after, beside the
plate), `/dev/shm/p69-engines/v5/t4NN.png` (after: phases 0, ¼, ½, ¾, then ±60°,
top and back views).

## 421 Trunk engine

- **Piston closed under the pin.** Piston and trunk are now one turned
  casting, sectioned on the camera plane. The pitman pin lies in a round
  socket at the foot of the trunk. The body runs 0.55 below the pin and is
  solid underneath, with Brown's annular core pockets inside. The trunk is
  widened to Brown's proportions (outer 0.65, inner 0.53); the stuffing box
  and the head opening follow it. The trunk is lengthened to 1.72 so that it
  always stands through the gland.
- **Steam.** A port through the head and a port through the bottom lie on
  the section plane (Brown draws no valve gear or pipes, so none is built).
  Back-half steam volumes fill the annulus above the piston and the space
  below it:
  - down-stroke: high-pressure steam above; the space below is exhausted;
  - up-stroke: the same steam passes below and works expansively. Both
    spaces show the same falling pressure, isothermal from bottom dead
    centre.
  - Valve events are softened over ±12° of crank.
- The white pin markers are now dark pins.
- Removed the stale `remove` list from source-presentation. The cutaway spec
  no longer re-cuts the piston, which is built already sectioned.

## 422 Oscillating piston engine (rebuilt; studied from the official animation)

The old model had separate walled chambers. It is now one sector chamber A
on rock shaft C, divided only by vane B.
- A curved tongue closes the top of the chamber. The two passages from the
  valve face run over the tongue and turn down round its rounded ends into
  the chamber corners, as in Brown's arrows and the official canvas.
- B's tip always stays under the tongue: it swings from 67° to 113°, and the
  tongue spans 64.7° to 115.3°.
- D slide valve: zero lap, a quarter cycle ahead of B. It uncovers the port
  behind B to chest steam. Its hollow joins the port ahead of B to the centre
  exhaust port, which leaves through the back of the casting (Brown's small
  oval under D) and turns down in a short pipe.
- The valve rod runs through a bored chest wall and a gland.
- Brown's pose: B upright, with steam entering by the right passage (his
  right arrow).
- The undrawn output crank and ball, the white index, the foundation and the
  loose tube passages are gone.
- The model is built in the official trace's units and shown at scale 0.46,
  about the old size.

## 423 Root's double-quadrant engine (rebuilt from Brown's plate)

- **No dividing walls.** One open cavity holds both pistons B, with the
  common crank D between them. Each B works on its outer side in a quadrant
  closed by its curved wall and an end wall. The space between the pistons
  is the common exhaust and is not walled off.
- **Openings:**
  - top passage: over the curved wall of the upper quadrant, turning down
    round its end into the corner;
  - bottom passage: down the right side round the right pivot boss, then
    behind the lower end wall into the bottom corner;
  - exhaust port: between Brown's hatched wedge and block under valve a,
    opening into the space between the pistons;
  - exhaust outlet: through the back, with a short down-turned pipe.
- **Valve a** is a rocking plug with two hollows.
  - Upper hollow: joins the inlet to one passage, or to both at mid-travel
    (open centre, 7°).
  - Lower hollow: joins the idle passage to the exhaust port.
  - Lands: a port width plus 1° lap.
- **Timing.** Plug angle = 18°·sin(i − 196°). Each B takes steam through its
  working stroke, which is 59% of the turn (Brown: "about two-thirds"). Both
  take steam during the 18% overlap, so there is no dead point.
  - The steam pieces are the real connected spaces after the pistons and
    plug divide the cavity. Inlet and exhaust are never joined.
  - Valve timing matches the power strokes in over 90% of frames. The
    mismatches are a few degrees of lead and lag at the reversals.
- **Linkage** is measured from Brown's plate (44.4 px/unit): crank 1.3, rods
  3.58, wrist radius 4.3, and B leads its wrist pin by 8.5°. It reproduces
  Brown's pose, with the bottom B at the end of its stroke and the rods and
  crank in line. The top B sits at 42° (Brown 41°).
- Brown's cast frame is the back plate of the casting.

## 426 Rotary engine with two abutments (rebuilt)

- **Two channels on each side**, one either side of each abutment D, as the
  user asked ("two valves on each side"):
  - left neck: the upper channel runs straight into the upper chamber above
    D (eduction); the lower channel bends round D into the lower chamber
    (induction);
  - right neck: point-symmetric.
  - The casing and neck outline follow the official trace of Brown's plate.
- Pistons A slide in radial grooves in hub C. Their round ends follow the
  cylinder wall; the cam is sampled from the wall so the ends clear it by
  0.01. C turns anticlockwise, as Brown's arrows show.
- **Steam.** Each chamber is split by its piston. Behind the piston, joined
  to an induction channel, the space is live and grows. Ahead of it the space
  is blown down and swept to the eduction channel. Both pistons are driven at
  once. While both pistons cross the abutments (about 23° of each 180°) the
  chambers are open from inlet to exhaust. This is the engine's dead point;
  the steam volumes stay continuous through it.
- Built in trace units and shown at scale 0.48.

## 428 India-rubber rotary engine (rebuilt; no official animation)

- **Deforming rubber lining E.** A mesh of 360 samples round the bore,
  rebuilt every frame from the rotor position. It is clamped into the middle
  of each neck (Brown's V), dividing the steam space behind it into halves.
  Each neck has two channels: the left upper and the right lower admit; the
  others exhaust. Brown's two arrows both run clockwise, away from the
  admitting necks.
- **Behind the leading roller of each half**, steam presses the rubber in,
  taut, against the rollers: it takes the outward face of the convex hull of
  its clamp and the rollers it rests on. The rollers pinch it on the bore, so
  the space is sealed and grows as the arms B turn clockwise: the steam
  expands and drives the rollers.
- **After a roller passes the far channel**, the space behind it opens to
  the exhaust and the rubber falls back to the bore over 10° of rotation.
- **Rollers** roll on the rubber without slip, turning the other way at
  5.25 turns per turn of B, so their quadrant cue is seamless.
  - Roller radius, path and bore: 0.459, 2.411 and 3.0; rubber 0.13 thick.
- Brown's pose matches: the upper-left space is bulged in from the left
  clamp to the top roller, the lower-right space from the right clamp to the
  bottom roller, and the rubber lies on the bore elsewhere.
- `src/data/rotation-indicators.js` 428 now names the new roller role.

## Checks

- **Intersections** (`show-body-intersections` logic, spacing 0.01; fluid
  and steam meshes are skipped through a scratch copy of the screen, because
  re-sampling the deforming steam at every sample exhausts memory):
  - 421, 422, 423, 426 at 129 samples: 0 pairs of any kind. For 423 this is
    after the back plate got bores for the spindles and a sliver wall was
    removed; its casing is watertight.
  - 428 at 33 samples, to keep within memory: only 0.0001 deforming contact
    between the rubber and the rollers (they pinch it by design).
  - Before: all five were sampled-clear in the ledger.
- **Loop seams** (`check-loop-seams`):
  - 421, 422, 423, 426: no seam. 423 shows a 1.6% steam reshape when a port
    switches.
  - 428: 0.48% steam-mesh "jump" and a 5% reshape. Both are artefacts of
    handing a thin live-steam band between two per-roller volumes; the union
    is continuous and there is no motion seam.
- **Bad faces** (`scan-bad-faces`): no inward or shading faces.
  - "mixed" edges occur only in translucent steam triangulations.
  - The 428 arm/pin z-fight was fixed by starting the pins inside the arms.
  - "sectionCover" flags the whole moving parts: hub C, vane B and the
    rubber, whose front faces lie at the section plane by design.
- **Tests** (all pass):
  - `tests/movement-421/422/423/426/428.test.mjs`, rewritten for the working
    steam engines;
  - `tests/steam-engine-working-solids.test.mjs`;
  - the 426 parts of `tests/piston-engine-solids.test.mjs`;
  - the 428 parts of `tests/rotary-engine-427-429-solids.test.mjs`;
  - `tests/rotation-indicator.test.mjs`.

## Residual limits (invisible)

- Steam pressure is shown from port connectivity and a prescribed blowdown
  or expansion law. It is not a flow solution; forces, leakage and friction
  are not modelled.
- Brown draws no valve gear for 421 and no pipes for any engine. The
  exhaust outlets of 422 and 423 are short down-turned stubs at the back.
- 426: what keeps the pistons out against the wall is not modelled.
- 428: rubber elasticity and stretch are not modelled. The taut-hull law and
  the 10° blowdown are engineered.
