# Pass 71 lane e1: cylinders, parallel motions and engine linkages

IDs: 326, 328, 329, 330, 332, 337, 338, 339, 340, 341, 342, 343, 344, 345,
346, 347, 362.

Each ID was checked in three ways:

- against its plate and caption;
- in fresh captures: default phases 0, ¼, ½ and ¾, plus ±60°, top and back
  views;
- numerically: link closure and straightness of the guided point over 200
  samples, loop seams, the body-intersection screen and the bad-face scan.

Captures are kept outside Git:

- `/dev/shm/p71-e1/before/`: `T<id>.png` is the plate followed by phases 0,
  ¼, ½ and ¾, then the left, right, top and back views; `P<id>-0.png` is the
  default view beside the plate.
- `/dev/shm/p71-e1/after/`: `<id>-default.png` and `<id>-oblique.png` for all
  17 IDs, from `scripts/review-movement-source-views.mjs`.
- `/dev/shm/p71-e1/v1`–`v4`: the same tiles after each fix. The final ones
  are `v1/T328`, `v1/T329`, `v1/T346`, `v2/T362`, `v2/P362-0` and
  `v4/S347.png` (347 at eight phases, plus the right and back views).

## Straightness and closure (all parallel motions)

The guided point is the point Brown's parallel motion is meant to keep on a
straight line. The residual is the largest link-length closure error.

| ID  | Guided point | Lateral drift / stroke   | Closure residual |
|-----|--------------|--------------------------|------------------|
| 332 | E            | 0.0002 / 1.09            | 2e-4 (E dev.)    |
| 337 | C            | 0.008 / 1.95             | analytic         |
| 338 | L            | 0.008 / 1.92             | analytic         |
| 339 | C            | 0 (exact Scott Russell)  | 2e-16            |
| 340 | C            | 0.023 / 3.30             | 9e-16            |
| 341 | L            | 0.0002 / 2.16            | 5e-15            |
| 343 | C            | 0.016 / 1.61             | 6e-15            |

All the linkages close exactly and keep the rod as straight as Brown's
geometry allows. None needed a kinematic fix.

## 326 Slide guide in a planed slot

**How it works.** The crank on the flywheel shaft drives a connecting rod down
inside the hollow standard to slide A. A runs in the planed vertical slot, and
the piston rod hangs from A.

**Review.**

- Default pose: crank to the right, as on the plate.
- The rod runs inside the hollow standard's front skin, as Brown dots it.
- The slot guides A on both faces.

**Changes.** None.

**Intersections.** Unchanged: sampled-clear (sliding shoe contact only).

## 328 Cartwright's parallel motion

**How it works.** The flywheel pinion drives the right wheel C, which meshes
with the equal left wheel C. The equal cranks A turn in opposite directions,
so the two equal rods keep the crosshead level and piston rod B straight.
Measured on the plate: gear spacing is 2 R, crank 0.77 R and rod 2.67 R. The
model uses 0.7 R and 3 R from the official canvas.

**What was wrong.**

- The view framed the whole cylinder.
- To hold it up, the model had three supports Brown does not draw: a bed
  plate, two standards carrying the bed, and a hanger in front of the pinion
  holding the flywheel-shaft end.

**Changes** (`authored-cartwright-parallel-motions.js`).

- The bed plate, standards and hanger are removed. The flywheel shaft keeps
  its own length.
- `cameraFitBounds` now follows Brown's crop: from the bed's left end to the
  flywheel rim, and from the tops of the wheels C down to the cylinder cover.
  The whole cylinder runs on below the crop and ends at its foot.

**Tests.** `tests/movement-328.test.mjs` and
`tests/piston-guide-solids.test.mjs` pinned the old whole-cylinder framing.
They are rewritten to require Brown's crop and the absence of the three
supports.

**Captures.** `v1/P328-0.png` and `v1/T328.png`.

**Intersections** (129 samples, spacing 0.01): 0 pairs.

## 329 Epicyclic piston-rod guide (Tusi couple)

**How it works.** B, half the diameter of the fixed internal gear D, rolls
inside D on a crank-pin carried by plate C. B's wrist runs on D's vertical
diameter, so rod A moves straight.

**What was wrong.** Plate C was a small hub with a box "replacement crank
arm". Brown draws C as a round plate about half D's outer diameter.

**Changes** (`authored-epicyclic-piston-guides.js`).

- C is now a 4.6-unit disk (0.97 in the model) fast on the shaft. It carries
  B's pin near its rim.
- The replacement arm is removed.

**Tests.** `tests/movement-329.test.mjs` now asserts that there is no arm and
that the disk encloses the crank pin.

**Captures.** `v1/T329.png` and `after/329-default.png`.

**Intersections** (129 samples): 0 pairs.

## 330 Forked connecting rod with prolonged piston rod

**How it works.**

- Brown's crank turns about the horizontal shaft, so it is seen edge-on.
- The forked rod straddles guide A. The prolonged piston rod runs up through
  A.
- The flywheel is seen edge-on on the shaft.

**Review.** Matches the plate. The fork, guide A, crosshead and cylinder
cover work through the full stroke.

**Changes.** None.

## 332 Side-lever marine parallel motion

**How it works.** The side lever pivots at A. Link D–C rises from the
lever's middle pin, and radius bar C–F holds C. Parallel bar D–E keeps
crosshead E straight: its lateral drift is 0.0002. The side rod runs from E to
the lever end, in front of the cylinder, as drawn.

**Changes.** None.

## 337 and 338 Vibrating-rod parallel motions

**How it works.**

- 337: the beam end holds the top of the short vibrating rod. The piston rod
  is at its middle, and the radius rod at its foot.
- 338: the radius bar is above the beam. The order along the vibrating rod is
  radius bar, beam end, piston rod.

Both drift about 0.4% of the stroke. The poses match the plates.

**Changes.** None.

## 339 Scott Russell direct-action parallel motion

**How it works.** B slides in the short fixed slot D, level with the fixed
pivot F. A is the midpoint of B–C, with FA = AB = AC, so C runs exactly on the
vertical through F. An overhead crank drives C through the connecting rod.
Brown's pose is bottom dead centre with B at the slot's end, and the model
reproduces it.

**Changes.** None.

## 340 Joggling-pillar parallel motion

**How it works.** The pillar B–F rocks about F. Radius bar E–A, with E level
with B, holds A on the beam. C drifts 0.023 over a 3.3 stroke.

**Changes.** None. The existing residuals stand.

## 341 Grasshopper beam engine

**How it works.**

- The beam is carried on rocking pillar A. The connecting rod runs to the
  crank beside the cylinder.
- Radius bar B holds the piston end straight: drift 0.0002.
- The fish-bellied beam has a kink on both edges, as the plate shows.

**Changes.** None.

## 342 Atmospheric beam pumping engine

**How it works.** Low-pressure steam and the pump-rod weight raise the piston.
Condensation lets the atmosphere drive it down, and the chain on the arch head
lifts the pump rod. The chain stays in tension both ways.

The cylinder is open at the top and Brown draws only its outside, so no
cutaway is built.

**Changes.** None.

## 343 Upright-engine parallel motion

**How it works.** This is a Watt linkage. The two radius rods A run to the
framing and the vibrating piece sits on the piston-rod top; C drifts 1% of the
stroke.

Brown's crank (96 px) is longer than his rods allow (about 90 px), so the
model keeps its feasible, shorter crank.

**Changes.** None.

## 344 and 345 Oscillating and pendulum engines

**How it works.** The cylinder swings on its trunnions, so the rod follows the
crank directly. The barrel is closed and the piston is hidden, as on the
plate. The poses and tilts match: 11° and −9°.

**Changes.** None.

## 346 Table engine

**How it works.**

- The crosshead runs in the slotted arch.
- Two side rods drive two parallel cranks under the table.
- The piston works in the fixed cylinder.

**What was wrong.** The cylinder was a box of two wall slabs, flat front and
back plates and rectangular covers. Brown draws a round turned cylinder.

**Changes** (`authored-table-engines.js`).

- The cylinder is one turned casting (`LatheGeometry`): barrel, bottom and top
  covers with flanges, the bore, and a rod bore through the top cover.
- The gland collars are round.
- The guide foot has a round rod hole on the axis.
- The piston head is round and fits the bore (radius 0.438 against 0.45).
- The piston rod is round and runs on the cylinder axis.

**Tests.** `tests/movement-346.test.mjs` is updated: it requires one turned
casting and asserts that the piston fits the bore.

**Captures.** `v1/T346.png` and `after/346-default.png`.

**Bad faces.** The inward winding was fixed by reversing the profile. The
remaining coplanar contacts (cylinder on table, guide foot on cover) are
flagged "same look".

**Intersections** (129 samples): 0 pairs.

## 347 Disk engine (steam in the section)

**How it works.** The disk nutates on the ball between two cones, and its rim
runs on the spherical zone. Each face of the disk bears against one cone along
a line, the pinch, which travels round the axis with the crank.

A fixed radial diaphragm (the rear horizontal half-plane) passes through the
disk's slot. It cuts each side's space into two cells:

- **Behind the pinch:** this cell grows. It takes live steam through a port
  just above the diaphragm.
- **Ahead of the pinch:** this cell is swept out through a port just below
  the diaphragm.

The two sides' pinches are half a turn apart, so there is no dead point:
"steam is admitted alternately on either side of piston".

**What was wrong.**

- No steam was shown in Brown's section.
- There were no ports, so steam had no way in or out.

**Changes** (`authored-disk-engines.js`). All use the shared steam colours
and opacities from `steam-section-kit.js`; its defaults are unchanged.

- **Steam volumes.** One translucent volume per side of the disk, rebuilt
  every frame from the disk normal. Only the rear half is shown.
  - It is bounded by the ball, the sphere, the offset cone surfaces, the
    disk face and the diaphragm.
  - Admission and eduction are coloured per vertex: live steam is dense. The
    eduction cell holds full pressure at release and blows down over 24° of
    crank.
  - When a pinch crosses the diaphragm, the live space becomes the eduction
    cell with no change of shape. There is no seam and no pop.
- **Ports.** Each conical head has two rectangular ports through its shell:
  admission above the diaphragm and eduction below, from 4.5° to 19° off the
  diaphragm, at radii 1.30 to 1.72. Each cone's ports serve the disk side
  that bears on that cone.
- **Chests.** The hollow behind each head is divided on the diaphragm plane.
  The upper half is the admission chest and the lower half the eduction
  chest. Both are shown with steam: live above, exhaust below.
- **Sleeve.** A sleeve carries the rod's conical passage through each chest,
  so the chest never opens to the rod.
- **Watertight heads.** A new helper, `revolvedRegionIntervalsGeometry`,
  revolves a region that changes along the half-turn. It closes each step
  with flat faces, and every ring is conformed to the shared vertex set, so
  the heads stay watertight.

**Captures.** `v4/S347.png`, plus `after/347-default.png` and
`after/347-oblique.png`.

**Intersections.** The standard screen runs out of memory re-sampling the
deforming steam, as in pass 69. A scratch copy that skips fluid meshes was run
at 129 samples, spacing 0.01, and found 0 pairs. Both heads are closed; the
only open mesh is the existing disk rim-seal tube.

**Seams.** None. There is a 1.5% steam reshape at phase 0.745, where a pinch
crosses the diaphragm band.

**Bad faces.** The steam volumes report degenerate triangles, which come from
the unused dynamic buffer and from pinched quads. The chest volumes report 6
mixed edges each. The socket's degenerate triangles are older.

**Tests.** The 347 tests are unchanged and all pass.

## 362 Oblique-groove traverse

**How it works.** The lower cylinder turns. A pin on the end of the upper
shaft works in its oblique (plane) groove, so the upper shaft and drum
traverse to and fro.

**What was wrong.** The pin met the groove 40° round toward the viewer, so the
pin was a bent hook. In the default view the groove showed as a curve.

**Changes** (`authored-grooved-cylinder-traverses.js`).

- The contact is now at the top: `contactWorldAngle = 0`.
- The pin is one straight bar through the shaft end, standing 0.42 above the
  shaft. The bridge arm is hidden.
- At Brown's pose the pin sits at the groove's left extreme. The groove is
  seen edgewise as his single straight diagonal.

**Captures.** `v2/P362-0.png` and `v2/T362.png`.

**Intersections** (129 samples): 0 pairs.

## Proposed ledger text

### 326

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** The rod clears the side walls by about 0.011. The rendered
  piston rod is shorter than in the official stroke geometry.

### 328

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:**
  - Brown's crop: the cylinder is cropped below its cover.
  - Brown draws no standards, bed plate or flywheel-shaft bearing, so the bed
    and the flywheel shaft are shown without supports.
  - Crank and rod ratios follow the official canvas (0.7 R and 3 R) rather
    than the plate (0.77 R and 2.67 R).
  - The default pose keeps the official phase.

### 329

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Rigid piston and link constraints are prescribed. Pressure,
  sealing, friction and inertia are not validated.

### 330

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 332

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 337

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged. Measured straightness is 0.4% of the stroke.

### 338

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged. Measured straightness is 0.4% of the stroke.

### 339

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 340

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 341

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged. Brown's radius bar B appears to join at the
  connecting-rod pin; the model keeps the official animation's separate
  joint M.

### 342

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 343

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged. Brown's crank is longer than his radius rods allow,
  so a feasible shorter crank is used.

### 344

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 345

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Unchanged.

### 346

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:**
  - The guide arches are open tube meshes.
  - The slot rails run down onto the guide foot as one U.
  - A small rod bore through the bottom cover is closed by the table top.
  - Pressure sealing, steam forces, friction and bearing loads are not
    validated.

### 347

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:**
  - The ports, chest dividers and rod sleeves are reconstructed; Brown shows
    none of them.
  - The chests' supply and exhaust connections are taken to lie in the
    removed front half.
  - The steam is kinematic: a live cell behind each pinch and a 24° blow-down
    after release, with no expansion model.
  - The steam volumes are skipped by the intersection screen.
  - The shaft standard and base are cropped by the frame, as in the plate's
    section.

### 362

- **Assessment:** reasonable
- **Visible flaws:** none
- **Limits:** Follower preload, backlash and friction are prescribed.
