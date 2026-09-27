# Pass 74, lane b: gasometers and gas meters 479, 480, 481, 483

Reviewer: Claude Opus 5.5, pass-74 lane p74-b. Date: 2026-09-27.

The user's requests were:
- **Gas meters and pumps generally:** "Generally all the gas meters and pumps need a closer look."
- **481:** "Each of the four compartments is drawn with a gap on the outer side."
- **483:** "not convinced it's what's drawn."
- **479, 480:** re-check them with the same rigour.

**Source animations.** The pages https://507movements.com/mm_479.html to mm_483.html all mark **Animated** as unavailable. They supply only the plate and the caption, so there was no animation to study. Every measurement below was taken from the plate (`public/engravings/mm_NNN.png`, scaled ×2 for measuring).

**Captures.** Fresh captures are in `/dev/shm/p74-b/final/`:
- `NNN-default.png` and `NNN-oblique.png`
- `phNNN/NNN-{default,left,right}-{0,0.25,0.5,0.75}.png`: four phases, straight on and rotated ±60°
- `sheet481.png` and `sheet483.png`

The before captures are in `/dev/shm/p74-b/before/`.

## 481 Wet gas meter

**How the plate works.** The case A holds water to just above the centre. The drum turns counterclockwise, following Brown's arrow at the periphery.

Each compartment B is bounded by one bent wall:
1. **Hook:** the wall starts as a hook curled round the central pipe a. The four hooks nest round a, and the free end of each hook is a chamber mouth.
2. **Leg:** a straight leg, offset from the axis, runs out from the hook.
3. **L-turn:** near the shell the leg turns along a short chord.
4. **Joggle:** a small joggle carries the wall out to the shell.
5. **Shell arc:** the wall's own stretch of shell runs on past the next wall's L-turn and stops short of that wall's joggle.

The channel between the shell arc and the next chord ends in **the gap on the outer side**. That gap is the chamber's outlet.

The cycle of one chamber:
- It fills through its mouth while that mouth is above the water in the central well.
- It rises sealed, with both mouth and gap under water.
- It discharges into the case when its gap rises out of the water on the right.
- It fills with water again as it goes down on the left.

| Element | Plate | Before | After |
|---|---|---|---|
| Drum shell | 4 arcs with 4 outer gaps (≈12° each) | Closed ring, with outlets as slots in the front head (removed by the section) | Each wall carries its own arc. There are 4 gaps, and a test casts rays round the shell to confirm them. |
| Walls | Hook, leg, L-turn, joggle, arc | Straight leg plus spiral hook, no L-turn or joggle | As drawn. The hook is an Archimedean spiral leaving the leg tangentially. Proportions: leg at 0.35R, hook 0.35R→0.26R, chord at 0.87R, joggle at 264°. |
| Drum radius / case radius | 0.88 | 0.82 | 0.87 |
| Water line | 0.2 of the drum radius above the axis | 0.09 | 0.185 (keeps at least one mouth above water at every angle) |
| Pipe a | Turned up at the centre, mouth at the water line | Mouth at 0.285 | Mouth at 0.44, above the water and inside the innermost hook (0.08 clear). The axial run, the front journal and the axle stub are now cut by the section, so a stands clear as drawn. |
| Drum heads | Not visible (section) | Front head had outlet slots | Plain discs with the journal bore |
| Drum index, rims | Not drawn | Index removed by presentation; torus rims | Both gone |

**Function.** The stage clock is aligned so that a chamber starts to discharge exactly when its gap reaches the water line (tested).

**Intersections.** The body screen (spacing 0.01, 129 samples) finds **no solid overlaps**. The only findings are "fluid": the stationary water volume is passed through by the rotating walls and heads.

**Proposed ledger text (481)**
- **assessment:** reasonable
- **visibleFlaws:** (none)
- **limits:** The water is one stationary body that the turning walls pass through. Brown's level is nearly the same in every chamber, so there are no per-chamber surfaces. The fill and discharge stages are an idealised quarter-cycle clock aligned to the gaps. Drum torque is prescribed.

## 483 Dry gas meter

**How the plate works.** Reading the plate left to right below the thick shelf:

> case wall | fixed end board | leather (V fold) | moving plate with pin-knobs top and bottom | leather (V fold) | inner board | central partition line (shelf to floor) | inner board | leather (deep V) | moving plate with brackets (flags) to a vertical rod | leather drawn out (shallow wave) | fixed end board | case wall.

So each chamber A, A′ is a **double bellows**: the moving plate divides it into an outer and an inner measuring space.

Brown's pose shows the two plates a quarter turn apart:
- The left plate is at mid-stroke: 196 px, halfway between its boards.
- The right plate is at the end of its stroke: its inner leather is closed up and its outer leather is drawn out.

That quarter-turn offset is the signature of a two-diaphragm meter. Above the shelf Brown draws:
- the sectioned cup B on the seat;
- a C-bracket whose two jaws hold B's vertical spindle;
- a bar at the top running to the pin of the vertical rod on the right (dashed behind a box);
- the tall outlet column on the left;
- a plain box at the upper right.

| Element | Plate | Before | After |
|---|---|---|---|
| Bellows | Two double bellows fixed to the end boards and inner boards, each with a mid plate | Two single bellows on the outer boards, plates facing an open gap at the centre | As drawn. There are 4 leather segments, each with a V fold of constant leather length (deep closed, shallow drawn out, matching Brown's three fold depths). |
| Central partition | Line from shelf to floor between two inner boards | Transparent box | Board from floor to shelf, with the two inner boards |
| Plate A | Mid-stroke, pin-knobs top and bottom | Blue plate moving with a common crosshead | Plate with top and bottom pins (Brown's knobs). Flag links run back to a flag rod behind chamber A. At t = 0 the plate is at x = −1.24 (plate −1.32). |
| Plate A′ | End of stroke, brackets to a vertical rod in front | Yellow plate, crosshead | Plate at x = 0.90 at t = 0 (plate 0.86). The flag arm and link at top and bottom run to the rocking flag rod in front at x = 1.95 (plate 1.9). |
| Valve B | Inverted cup with stepped foot, centred on a vertical spindle | Orange box sliding under an over-centre coil spring and a rocker | D-shaped cup (stepped foot) turning continuously on a seat. The seat has 4 ports a quarter turn apart round a central exhaust. The cavity exhausts each space for exactly the half turn in which it closes (tested); the uncovered ports admit case gas. |
| C bracket | Back on the shelf, two jaws bored for the spindle | Absent | As drawn (measured) |
| Top bar | Bar at the top from the spindle to the rod's pin | Rocker and slot | Link from the A′ rod's top arm to a crank pin on a disc at the spindle top, plus an eccentric rod from A's rod to an eccentric sheave below it. In front view the links read as Brown's bar. |
| Outlet | Tall left column on the shelf | Column | Column from the shelf through the roof, fed through a passage cored in the shelf from B's central port |
| Box upper right | Plain box, rod dashed behind it | Removed dial housing with dials | Plain dial-work case; the A′ rod passes behind it |
| Coil spring, crosshead, dials, gas beads | Not drawn | Present | Removed |

**Why the linkage is designed this way.** Each flag rod drives the spindle through a crank-rocker. The rocker is made symmetric (d² = l² + a² − r²), so its dead points are exactly half a turn apart. As a result each measuring space closes during exactly half a turn, which is the half turn that B's half-round cavity exhausts it. The two crank throws are 85° apart, which puts the plates' dead points a quarter turn apart (tested).

**Parts that are inferred, not drawn:**
- **Left flag rod:** it stands behind chamber A, at x = −1.9, z = −1.35. It is seen above the bellows and through the V notches.
- **Eccentric under the crank disc:** it is needed so that neither link sweeps across the other's pin or the spindle axis.
- **Four port ducts:** they drop under the shelf and run behind the back panel. Their levels and depths were chosen by an exhaustive search so every pair stays 0.02 clear.
- **Inlet:** it enters through the back of the case, behind the dial box.

**Intersections.**
- **Before:** the pass-49 screen reported a 0.062 unclassified overlap.
- **After:** the screen (spacing 0.01, 129 samples) finds only the leather-to-plate attachment ("deforming", depth 0).
- **Iterations during the pass:** the pin/link joints overlapped until the links were given eyes. The links swept across the crank pins until the eccentric was added. The duct and pin overlapped until the ducts were rerouted. All are now clear.

**Proposed ledger text (483)**
- **assessment:** reasonable
- **visibleFlaws:** The left flag rod, which Brown does not draw, shows as a thin rod behind chamber A above the bellows and through the V notches. The spindle's crank disc and eccentric at the top are also inferred; Brown shows only the bar and a knob.
- **limits:** Plate forces from the gas pressure are not solved: the crank turns uniformly and the plates follow the linkage exactly. The ducts, cored exhaust passage and inlet are inferred, since Brown's elevation omits them. The bellows section is a rounded rectangle.

## 479 Gasometer (counterweighted)

| Element | Plate (2× px) | Before | After |
|---|---|---|---|
| Tank B | Masonry pit sunk in the ground: coping at 525, floor at 945, pit radius 232; pipes run out in a channel under the floor | Free-standing thin tank with a rim above ground; pipes bent out below a floating floor | A solid ground block containing a round pit and a floor, with a channel under the floor for the pipes (cut in section) |
| Bell A | Skirt 465 tall × 420 wide, crown rise 65, rim 50 under the water in Brown's pose | Skirt 2.3 × 4.0 (squat) | Skirt 4.42 × 4.0, crown rise 0.62 (spherical cap). Brown's pose is the top of the stroke; the stroke is 1.7. |
| Pulleys | Plain discs with an axle hole, no supports | Grooved pulleys, posts removed by presentation | Plain flanged discs with a quadrant cue on short axle stubs, at Brown's centres and radius |
| Suspension | Heavy bands from the bell's shoulder over the pulleys to the balls | Bands with lugs on the bell | Flat bands meeting the crown just inside the shoulder; no lugs. Tested for constant length and rolling. |
| Weights C | Balls just above the ground | Balls | Balls, radius 0.55, just above the ground in Brown's pose. They never touch the ground or the pulleys (tested). |
| Pipes | Tops just above the water; left pipe is the inlet, right is the outlet | Same, at ±0.48 | Same, at ±0.35, bent out into the channel |
| Water | One level in the pit | Connected body | Outer annulus, inner column and a ring under the rim that follows it. The inner level is 0.12 below the outer, which is the gas head. |

**Intersections.**
- **Before:** the pass-49 screen found a 0.0897 overlap between the rope lug and the band.
- **After:** the screen (spacing 0.01, 129 samples) finds only contact joins: the band end resting on the crown, the band against the ball top, and the band lap on the pulley. Water-to-water joins are at depth 0.
- **Tests:** the following interfaces are all clear:
- bell against the ground and the pipes;
- pipes against the ground;
- weights against the ground and the bell;
- bands against the bell;
- axles against the wheels.

**Proposed ledger text (479)**
- **assessment:** reasonable
- **visibleFlaws:** (none)
- **limits:** The inner water stands 0.12 below the outer (the gas head); Brown draws the levels equal. The ground is a finite square block. The fill cycle is prescribed and the pressure is quasi-static.

## 480 Gasometer (centre-guided)

| Element | Plate (2× px) | Before | After |
|---|---|---|---|
| Tank B | Masonry pit (coping 495, floor 900, radius 285), pipe channel, ground below | Free-standing tank | Ground block with a pit and a channel, as for 479 |
| Bell A | Skirt 450 × 485, crown rising to 150 at sleeve a | Skirt 2.2 × 3.96 | Skirt 4.28 × 4.61. The spherical crown passes through the shoulder and meets the sleeve at the measured height. |
| Sleeve a | Walls 430–445 / 520–535, from the crown down to the rim level | Short tube with rims | Sleeve 0.50/0.36 from the crown to the rim level, fixed in A |
| Tube b | 455–520, from above A down through the floor to feet at 1000 | Rose from the floor to 3.5 | Tube from the ground's underside, on its flanged foot (Brown's ⊥), up to 5.05. It always stands above a; clearance 0.047 (tested). |
| Pipes | Tops at 510, bent out under the floor; left is the outlet, right is the inlet | Straight stubs ending below the floor | Bent out along the channel |
| Water | One level | Connected body | Outer, inner (depressed 0.11), under-rim ring, a–b gap at the free level, and a ring under a |

**Intersections.** The screen finds **no solid overlaps**, only water-to-water joins at depth 0. The earlier pass had "sampled-clear, selected interfaces".

**Proposed ledger text (480)**
- **assessment:** reasonable
- **visibleFlaws:** (none)
- **limits:** The inner water stands 0.11 below the outer (the gas head); Brown draws the levels equal. The ground is a finite square block. The fill cycle is prescribed and the pressure is quasi-static.

## Checks

- `scripts/check-loop-seams.mjs --ids=479,480,481,483`: 0 seams, 0 pops.
- `scripts/scan-bad-faces.mjs --ids=479,480,481,483`:
  - no inward faces and no shading faults;
  - 481's `sectionCover` on the rear drum head (the water's clip plane) predates this pass;
  - the same-look coplanar faces lie inside merged ground layers, and at the rod-top / arm-top faces in 483.
