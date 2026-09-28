# Pass 90, lane p90-u3: 423, 433, 436 and 464

Reviewer: Claude Opus 5.5, lane p90-u3. Date: 2026-09-27.

Scratch and captures are in `/dev/shm/p90/u3/` (outside Git).
- **Before:** `before/tile-ID.png` (plate, phases 0/0.25/0.5/0.75, four rotated views, top view) and `before/z423t.png`.
- **After:** `after/tile-ID.png` and `after/zoom-ID.png`, with the same views.

Every ID was run through these checks:
- `screen-coincident-faces`
- `screen-disconnected-parts`
- `screen-body-intersections`
- `check-loop-seams`

No validation report fingerprints the files changed here.

## 464: Hero's fountain (rebuilt)

**Reading of the plate and caption.** Brown sections one hollow casting. The ruled regions are water and the white hollows are air:
- The trough on top is open. Its water stands below the rim, which is a single line with no lid.
- The trough floor opens into the right leg. This leg is a tube, ruled full of water, that runs down into the foot and ends 14 px above the foot floor, under the foot water.
- The foot is the lower vessel. It holds water under an air space.
- The left leg is hollow and unruled, so it carries air. At the top it opens into the space over the bowl; its inner wall stops at the bowl's rim.
- The bowl is the intermediate vessel. It hangs between the leg walls and is ruled full to its rim.
- The jet pipe rises from low in the bowl, through the air space and the trough water, to the pointed spire.
- The large window under the bowl is open air, outside the casting.

The caption's working follows from this:
- Water poured into the trough runs down the right tube and compresses the foot's air.
- That air presses through the left leg onto the bowl water.
- The bowl water is driven up the pipe as the jet, which falls back into the trough.

**Before.** The old model showed a flat back half with these faults:
- a lidded trough;
- a rectangular "chamber" filling the whole window, with the bowl hung inside it on hangers;
- a right leg that stopped at the foot's ceiling;
- a foot drawn as if all water;
- a port nub on the left leg;
- a thin-walled bowl stepped against the chamber (the kink in image 57);
- water slabs laid on the section and clipped by planes.

**After.** New `src/simulation/herons-fountain-casting.js`; `authored-herons-fountains.js` is rewritten.
- **Scale and outlines.** All outlines are measured from the plate at 70 px per unit.
- **Casting.** One closed hollow casting, 1.4 deep, cut on Brown's plane (the back half with cut faces), built from one outline set:
  - The outer outline has Brown's shoulders. Each is an ogee of two equal tangent arcs, and the inside follows the parallel offset curves.
  - The window's top is the bowl's outer circle, tangent to the leg walls, with a short web 0.3 below the rim so the bowl joins the walls solidly.
  - The trough is open at the top.
  - The tube walls dip to 0.27, which is under the foot water at 0.50.
  - The left leg opens into the chamber above the rim.
- **Floor slab.** The trough floor round the pipe is a separate bored slab. Its bore uses the pipe lathe's own vertices, so the two surfaces coincide exactly.
- **Watertightness.** Both meshes are watertight, with 0 open edges. T-junctions between stacked layers are closed.
- **Jet pipe.** A turned tube (back half) with Brown's pointed spire.
- **Feet.** Two turned bun feet under the foot stand in for the claws.
- **Water.** Two closed bodies, each 0.004 off every wall and behind the cut plane:
  1. **Trough, tube and foot.** The trough drains into the tube, whose column joins the foot water under the tube walls. The trough water is bored round the pipe.
  2. **Bowl and pipe.** This body wraps the pipe wall below the level and fills the bore up to the spire tip.
- **Air.** Nothing is drawn for the air.
- **Jet.** Six ballistic streams leave the spire tip. They rise 0.6, as Brown draws, and land on the trough water.
- **Hydrostatics** (in `userData.geometry`):
  - The air's gauge head is the tube column, trough level minus foot level (4.36).
  - The ideal jet head is that column less the lift from the bowl to the tip: 2.51 above the tip.
  - The drawn 0.6 rise implies pipe and orifice losses. These are disclosed as one efficiency factor.
- **Levels.** Held in steady play: the drain equals the jet.

**Captures.**
- `after/tile-464.png`
- `after/zoom-464.png`: bottom left and right with the tube foot under the foot water; the top left and right joints; and oblique views of the open trough and the pipe bore.

**Screens.**

| Screen | Result |
|---|---|
| Coincident faces | 0 flagged, 0 seams |
| Disconnected parts | 0 detached, 0 near-misses, 0 slivers |
| Body intersections | worst solid 0, 0 open meshes |
| Loop seams | 0 |

**Tests.**
- `movement-464` is rewritten with 5 tests:
  - passage topology by point sampling: open trough with no lid, tube, air leg, chamber, bowl, foot and window;
  - hydrostatic ordering: sealed tube foot, submerged pipe foot, positive head;
  - water bodies bounded, off the walls and behind the plane;
  - jets from the tip to the trough water;
  - registry bounds.
- `fountain-balance-interfaces` now checks the 464 water against the casting, slab and pipe.
- `movement-465` passes unchanged.
- The dead `correctFountain`, `sectionFountain` and `fountainBowlLevel` were removed from `fountain-balance-working-parts.js`. 465's code there is untouched.

**Residuals.**
- The bowl does not visibly fall, nor the foot rise, over the loop; levels are held in steady play.
- The jet's loss factor is engineered.
- The casting's depth and its rectangular section front to back are assumed.
- The feet are turned buns, not claws.
- The jet streams are illustrative ballistic paths, not a fluid solution.

## 433: horizontal overshot wheel (discharge made live)

**Before.** Three fixed spill sheets and three droplet emitters hung at fixed world points below the rim. They did not move with the runner and started 0.06 off the boards.

**After.** The fixed spills are replaced by one sheet per board (16 in all). Each sheet is the streakline of water leaving that board's outer end over the last 0.62 s:
- **Release.** Each drop leaves the end at the board's rim velocity, plus a 0.45 run-off outward and 0.25 downward, then falls freely.
- **Wetting.** The water a board carries is a smooth bump over the sector from 0.08 to 1.45 rad past the strike. It is zero outside the sector.
- **Attachment.** Every sheet starts on its board's end edge, with its width along that edge. It sweeps round with the runner and thins away as the board leaves the sector.
- **Dry samples.** They fold onto the wet end, so no hairline remains.
- **Periodicity.** The loop is exact, because the paths use the unwrapped runner angle and one cycle is one turn.

**Captures.**
- `after/tile-433.png`
- `after/zoom-433.png`: phases 0, 0.015, 0.03 and 0.045, which are sub-pitch steps, plus two rotated views.

**Screens.**

| Screen | Result |
|---|---|
| Coincident faces | 0 flagged. 1 seam: the existing impact-splash droplet instances. |
| Disconnected parts | 0 detached. The 50 near-misses are the existing working clearances (board/bearing, board/shaft, board/board). |
| Body intersections | worst 0, 0 open meshes |
| Loop seams | 0, no pops |

**Tests.** `movement-433` has one new test, and all 11 pass. The new test checks that:
- sheets start on their boards' ends and only fall;
- water drops more than 1 below the runner;
- the sheets repeat exactly after one cycle.

**Residuals.**
- The film that would run across the board from the strike to its end is not drawn. The jet ends on the struck board and the sheets appear at its end.
- The strike is near the outer radius. Brown's jet lands nearer the hub. This predates the pass.
- The impact-splash droplets still come from one fixed point.

## 436: Jonval turbine (supply pipe sealed)

**Before.**
- The chute was an open floor/roof pair with one side wall.
- It started 0.05 outside the trunk's outer surface.
- Its straight end met the curved trunk only at the centre plane.
- The trunk had a rectangular mouth taller and wider than the pipe, so gaps and leaks showed in rotated and back views.
- The water sheet ran through the gap and ended under the trunk water.

**After.** New `src/simulation/jonval-inlet-geometry.js`.
- **Pipe.** A closed rectangular pipe: bore 1.16–3.16 by ±1.0, 0.14 floor and roof, 0.10 sides. Its walls end exactly on the trunk's outer cylinder; the end strips are sampled at the trunk's own vertices.
- **Trunk.** Rebuilt as one watertight shell, pierced by exactly the pipe's bore. The hole's floor, roof and sides lie on the pipe's inner planes, so the pipe's inner faces run on through the wall.
- **Watertightness.** The pipe and trunk each have 0 open edges.
- **Cutaway.** Both are cut by the existing cutaway spec (`cutaway-presentations.js`, unchanged).
- **Water.** The water sheet runs down the pipe floor, over the bore's lip on the trunk's inner face, and falls onto the trunk water. That water now stands at 0.98, just under the lip, and the sheet ends at its surface, so the two neither overlap nor part.

**Captures.**
- `after/tile-436.png`
- `after/zoom-436.png`: the front, both obliques, the back, the side and the top of the joint.

**Screens.**

| Screen | Result |
|---|---|
| Coincident faces | 0 flagged, 0 seams |
| Disconnected parts | 0 detached. The near-misses are the existing runner and drum clearances, plus the pipe roof 0.12 under the top cover's overhang (the two do not touch). |
| Body intersections | worst 0, 0 open meshes |
| Loop seams | 0 |

**Tests.**
- `movement-436` has a new test for:
  - pipe and trunk watertight;
  - the pipe meeting the trunk surface to 1e-5;
  - no trunk wall inside the bore;
  - the stream ending on the trunk water below the lip.
- `fluid-rotor-436-438-solids`, `movement-437` and `movement-438` pass.

**Residuals.**
- The sheet enters at the pipe's far end, which Brown breaks off. The headrace beyond is not modelled.
- The trunk runs part-full below the pipe floor. That is a presentation choice; a working Jonval trunk runs full.

## 423: Root's double-quadrant engine (top passage rebuilt)

**Before** (image 54, `before/z423t.png`).
- The passage over the top quadrant ended in a radial pocket at 26.7°.
- From 28° to 30° it left that pocket in a zig-zag polyline, down to (1.45, 2.66), up to the port and back down, before reaching valve a.
- The outer wall had a V notch at the joint and was thin there.

**After.**
- **Channel.** The passage is one smooth channel of constant width (0.30). It follows the arc between the bar and the outer wall down to 36°, then a tangent-continuous cubic into valve a's top port, entering along the port's radius.
- **Quadrant.** Below 36° the quadrant ends at its own curved wall. The casting between the channel and the quadrant is solid, which is Brown's hatched wedge.
- **Wall.** The outer outline carries a band of constant wall thickness (0.28) round the whole channel, so the joint is sealed and smooth.
- **Valve and timing.** The port angles, valve hollows and timing are unchanged.

**Captures.**
- `after/tile-423.png`
- `after/zoom-423.png`: front, close-up, both obliques, whole view and top view.

**Screens.**

| Screen | Result |
|---|---|
| Coincident faces | 0 flagged, 0 seams |
| Disconnected parts | 0 detached. The 1 near-miss is the existing rod/rod pass. |
| Body intersections | worst 0. The 4 open meshes are the existing steam volumes. |
| Loop seams | 0 |

**Tests.** `movement-423` has one new test, and all 3 pass. The new test checks that:
- the centre line never turns more than 8° per step;
- it ends on the port;
- the channel is open along its whole length;
- it is walled on both sides along its whole length.

`steam-engine-working-solids` and `movement-424` pass.

**Residual.** The channel's run into the port is a smooth S, slightly flatter than Brown's hand-drawn bend.

## Shared checks

- **Camera catalog.** The 507-model test passes for 423, 433, 436 and 464 when run alone. The full run currently fails on 377, which belongs to another lane.
- **Not run.** The full `models.test` was not run in this lane.
