# Pass 90, lane p90-u2: 377 plank, rail and walker; 379/380 crank handles

Reviewer: Claude Opus 5.5, lane p90-u2. Date: 2026-09-27.
Scratch and captures are in `/dev/shm/p90/u2/`, outside Git.

## 377: the diagonal plank

The user's complaint (`/dev/shm/p90/56.png`): the diagonal plank lay in an upright plane along the drum, across the boards. That is the plane x = const, perpendicular to the wheel's face. The man stood off-centre at z = -0.45, and the rail ended at the plank's face on a stub bolt.

**Change** (`src/simulation/authored-person-treadmills.js`):
- **Plank.** It is now one flat extrusion (0.26 wide, 0.10 thick) in the plane of the wheel's face, at z = 2.50. That puts it in front of the spur wheel (z ≤ 1.50) and the bearing standard (z 1.51–1.69).
  - It leans 36° from upright, rising up and to the left from its level-cut foot on the ground (y = -2.08). In the default view that reads as about 22°, which is Brown's apparent slant.
  - Its top stands 0.6 above the hole. This is Brown's hole, about a seventh of the way down.
  - `userData.plane` records the plane, lean, hole, top and foot.
- **Rail.** The rail the man holds is a rod along the drum's axis. It passes through a 0.055-radius bore in the plank, and its end stands 0.03 proud of the plank's front face. Its 32 facets meet the plank's 64-sided bore at their vertices, so nothing is coplanar. The stub bolt is gone.
- **Man.** He is centred across the drum's width (hip z = 0). His fists are unchanged and closed round the rail axis (`fin-377-hands.png`).
- **Why z = 2.50.** The plank is 1.0 in front of the gear. In the default view, that depth shift puts the man clear to the right of the plank, as Brown draws him. With the plank closer, it crosses his legs.

**Captures:**
- `b377-tile.png`: before, in the default, rotated, front and top views.
- `g377-tile.png`: after, in the default, yaw -10°, side, top and back views, plus a zoom on the rod through the hole.
- `h377-tile.png`: after, at phases 0, 0.025, 0.05 and 0.5 beside the plate.

**Camera and framing, outside this lane's files:**
- **Framing.** `src/data/display-profiles.json` still holds 377's old motion bounds (max z 1.83). The fit therefore crops the plank's foot in the default view. Regenerate them with `node scripts/measure-display-profiles.mjs 377 380`.
  - **Checked in the scratch tree.** With the profiles regenerated there, the default view frames the whole plank (`wt377-tile.png`). The new 377 motion-bounds maximum is (4.75, 2.51, 2.58). The sustained visible rate moves from 8.88 to 8.01.
  - **camera-catalog.** Before regeneration it fails on 377 ("vertex outside the camera"), as expected. After regeneration, camera-catalog plus movement-377, 379 and 380 pass: 26 pass, 0 fail.
- **Camera (optional).** A camera about 10° nearer the wheel face matches the plate better (`d377-tile.png`, first panel). That means changing `camera` in `src/data/source-presentation.js` 377 from `[1, 0.02, 0.62]` to about `[0.74, 0.02, 0.67]`.

**Screens:**
- Coincident faces: 0 flagged.
- Disconnected parts:
  - 0 detached and 0 lips. The rail and plank touch, so they are not reported as a near-miss.
  - One sliver, jacket/head, which is the existing figure neck.
  - Near-misses: the cap and head to the rail (0.025/0.036), as before.
- Body intersections: 0.
- Loop seams: 0.

**Tests:**
- movement-377 has a new ninth test: the plank has one z plane, stands in front of the gear and standard, and has its hole on the rail axis; the rail stands 0.03 proud; the hole radius equals the rod's; the man is centred; both fists lie on the rail axis.
- treadmill-gait-solids and treadwheel-working-solids pass unchanged.

## 379 and 380: crank handle and knob lip

- **Before.**
  - 380's handle was a plain cylinder.
  - On both movements the crank bar was a box whose bottom edge ran 0.015 (379) or 0.010 (380) below the knob's foot. That was p87-l's lip.
- **After** (`src/simulation/authored-cramp-drills.js`). There are two shared builders:
  - `crankArmGeometry`: one flat extrusion, 0.11 thick. Its plan is the hull of a circle concentric with the handle axis and a 0.12 circle buried in the spindle hub. The far end is therefore a circular arc about the handle.
  - `turnedHandleGeometry`: one smooth centripetal spline from the flared foot through the neck to the bulb, closed by an elliptical dome and lathed with 40 segments.
  - **Foot and lip.** The foot is sunk 0.012 into the bar top and lies inside the bar-end arc (foot 0.10 or 0.116, against an end radius of 0.15 or 0.20). No bar edge overhangs it, so there is no lip.
- **379.** It keeps its handle's stations (foot 0.10, neck 0.075, bulb 0.175 at 0.74 of its height) at 0.47 tall, 1.60 from the spindle. The bar runs 0.15 past the handle; Brown draws about 0.16.
- **380.** It gets the same treatment, with proportions from plate 380 at 0.0077 units per pixel:
  - The handle is 0.43 tall above the bar.
  - Foot 0.116, neck 0.062 at 0.43 of its height, bulb 0.112 at 0.76. The neck and bulb are 0.004 fuller than measured, because Brown's strokes eat into them.
  - The axis is 1.45 from the spindle (was 1.68), and the bar runs 0.20 past the handle.
- **Also, 380 flicker.** The sleeve's annular end rings lay in the feed thread's flat end faces (2 flagged pairs). They are now set 0.004 inside the sleeve ends, within the necks.

**Captures:**
- `b38-tile.png`: before, beside both plates.
- `a38-tile.png`: after, default and zoom beside both plates.
- `fin-38-tile.png`: after, default and rotated at phases 0.3 and 0.6.

**Screens:**
- Disconnected parts: 379 and 380 now report 0 lips (were 1 each) and 0 slivers.
- Coincident faces: 0 flagged on both (380 was 2).
- Body intersections: 0 on both. The open meshes listed by p87 remain; both are hidden inside other parts: 379's feed-handle arm tubes and 380's annular rings.
- Loop seams: 0.

**Tests:** drill-feed-solids has a new test. For both IDs it checks:
- the handle is lathed and on its axis, at its height;
- the bar is 0.11 thick;
- every bar vertex beyond the handle lies on the end arc;
- the foot lies inside the end and is sunk 0.012.

movement-379 and movement-380 pass unchanged.

## Test runs

- **Why a scratch tree.** Other lanes' in-progress edits currently break the registry import in the live tree (`JDROP`, `rebuildGuernseyAnchor`). Tests were therefore run in a `git archive HEAD` copy with only this lane's four files overlaid (`/dev/shm/p90/u2/wt`).
- **Result.** movement-377, 379, 380, drill-feed-solids, treadmill-gait-solids and treadwheel-working-solids: 45 pass, 1 fail.
- **The failure** is drill-feed-solids' 366 test "feed rods have finite bores". Another lane has edited that test in the live tree, and the overlay copies the live test file while keeping HEAD's 366 source. It is not related to 379 or 380.

## Residuals

- **377, seated gait.** The gait still reads somewhat seated. This is the p84 forced limit and is unchanged.
- **377, plank support.** The plank stands 1.0 in front of the gear, alone on the ground. It is joined to the machine only through the rail. Brown draws no other support.
- **380, simplified parts.** The crank bar has no raised boss at the hub end: the black hub cylinder stands in for Brown's boss. The bar also stops at the hub, where Brown runs it 0.28 past the axis. Both predate this pass.
