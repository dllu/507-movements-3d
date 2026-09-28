# Pass 90, lane p90-fd: audit fixes for 256–340

- **Reviewer:** Claude Opus 5.5, lane p90-fd. Date: 2026-09-27.
- **Input:** `docs/p90-audit-256-340.md` (high: 269, 320, 331; medium: 259, 267, 277, 278, 282, 287, 296, 308, 311, 313, 315, 316, 318, 321, 332, 333, 336; flicker: 260, 270, 285).
- **Forks:** none. The concurrent sub-agent limit was reached, so the lane ran single-threaded.
- **Captures:** everything is under `/dev/shm/p90/fd/`.
  - `after/NNN/tile.png`: the plate beside the default view, yaw +50°/pitch 20°, yaw −50°/pitch −15°, back, top and phases 0.33 and 0.66.
  - `NNN/`: the aimed zooms named in each section.
  - The before captures are the auditor's, under `/dev/shm/p90/d/dN/NNN/`.
- **Screens** (all for the 22 IDs):
  - `screen-coincident-faces`: `cf-after.json`, then `cf-after2.json` after the 260/285 follow-ups.
  - `screen-disconnected-parts`: `disc-after.json`, `disc-after2.json` and `disc-282.json`.
  - `screen-body-intersections`: `bi-after.json` and `bi-267.json`.
  - `check-loop-seams`: 22 checked, 0 seams, 0 pops, 0 errors.
- **Tests:** 45 targeted files (below). Every file listed passes.

## File claims (all p90-fd)

Primary files:
- `authored-mutilated-racks.js`, `authored-pulley-forms.js`, `authored-differential-drives.js` (not edited), `authored-friction-clutches.js`
- `authored-colt-ratchets.js`, `authored-safety-stops.js`, `authored-slotted-disk-levers.js`, `authored-lathe-heads.js`, `authored-pickering-governors.js`
- `authored-plate-escapements.js`, `authored-detached-escapements.js`, `authored-gravity-escapements.js`, `authored-free-escapements.js`
- `authored-conical-pendulums.js`, `authored-compensation-pendulums.js`, `authored-watch-regulators.js`, `authored-maintaining-power.js`, `authored-going-barrels.js`
- `authored-slotted-crosshead-engines.js` (not edited), `authored-marine-parallel-motions.js`

Helpers:
- `maintaining-clock-parts.js` (320/321)
- `baked/maintaining-clock-clicks.js`
- `differential-thread-solids.js` (260/266; the 266 branch is untouched)
- `piston-guide-329-331-parts.js` (only `correctSlottedGuide`, which only 331 uses; `correctEpicyclicGuide` for 329 is untouched)
- `free-escapement-finite-parts.js` (claimed, not edited)
- `pendulum-journal-parts.js` (315/316/317; only the conical crank-hub line changed)
- `watch-balance-parts.js` (318/319; only `correctWatchRegulator` changed)

Regenerated artifacts:
- `docs/validation/260-266-275-thread-solids.json`: 33 poses per ID, 0 penetrations.
- `src/simulation/baked/gravity-escapement-plates.js`: only the 311 input hash changed. All 309–312 plate outlines are byte-identical.
- `src/simulation/baked/maintaining-clock-clicks.js`: 320-p and 321-T/R were rebaked. The 320 signature now includes the click outline, so a changed click can no longer play back a stale path.

## High

### 269: depth-split rack teeth removed
- **Verified.** 12 of 17 teeth carried a full-outline web and backing strip behind the pinion over a relieved front tooth.
- **Change.**
  - The web and backing-strip meshes are gone. Every rack tooth is one full-depth extrusion (0.38).
  - Each relieved tooth is Brown's straight-flanked tooth with its tip cut by one straight chamfer. The chamfer is the largest that fits wholly inside the swept relief, so the in-plane clearance is unchanged. This replaces the ragged swept outline. The baked relief is still generated and checked.
- **Numbers.**
  - The reversal is prescribed mid-mesh at the three contiguous group boundaries. This is inherent, because a stationary pinion interferes with any full rack tooth within ±0.57 of its centre.
  - The six transition teeth are left 0.024–0.038 tall (of 0.20), and their six neighbours 0.109–0.164.
  - A handoff half-width sweep (0.3–1.4 pitch) left the transition teeth at 0.04–0.06 in every case.
  - The source animation also alters these teeth.
- **Captures:** `269/b-*.png`, `269/c-front-nogear.png`, `269/c-obl*.png`, `after/269/tile.png`.
- **Tests.** movement-269 now asserts:
  - no web or strip meshes;
  - one polygon and one full-depth extrusion per tooth;
  - the chamfer count;
  - the baked relief still matches its generator.

  The swept-clearance test (1600 samples) passes.
- **Ledger:** assessment **minor**.
  - visibleFlaws: "Twelve of the 17 rack teeth are shortened in the plane by a straight tip chamfer, and the six either side of the three handoffs are only low stubs (0.024–0.038 of 0.20). Brown draws them full, but a pinion reversing mid-mesh at contiguous groups cannot clear full teeth."
  - Append to limits: "p90: no depth-split relief. Each tooth is one full-depth extrusion; relief is an in-plane straight chamfer inside the swept pinion envelope."

### 320: ratchet, click and arbors
- **Verified against the plate** (`320/plate-p.png`). The plate shows ten raked saw teeth. The click's eye is inside p's rim at (0.47, 0.76)R, and its toe drops into a root at the top left. The curved stroke from the upper-left eye is Brown's click spring, not the click.
- **Change.**
  - **Pivot.** It moved from (0.48, 1.03) to Brown's (0.47, 0.76), inside the rim.
  - **Ratchet.** The roots are deeper (0.74 of the tip radius, was 0.84). It keeps 10 teeth, with the steep faces along the click's swing and a 10° undercut.
  - **Click.** One flat plate:
    - an eye (radius 0.10, bored for a 0.05 stud);
    - an arm on a circular arc concentric with p, 0.85–0.95 from its centre, so it rides 0.075 clear over the tooth between the eye and the root;
    - a solid toe wedge whose working face lies on the tooth face (0.0005 off) and whose heel lies along the back of the tooth behind.
  - **Seat.** The click is seated by exact outline contact (baked, 697 knots). At the seat, the nose sits in the root from phase 0.05 to 0.5.
  - **Stud.** The long rear pin is replaced by a 0.16 stud through the eye.
  - **Arbors.** P and p get fixed arbors (radius 0.124) through their hubs, 0.02 proud each side. The clock frame stays hidden by the presentation.
  - **Weights (low).** Both weights moved forward so the hangers enter the middle of their top faces.
- **Captures:** `320/b-*.png`, `320/click2d.png`, `after/320/tile.png`.
- **Tests.** Passing: movement-320, maintaining-clock-bake and maintaining-clock-interfaces (planar click overlap ≤ 8e-13 over 64 poses).
- **Screens:**
  - body intersections: errors out of memory, as at HEAD (p88);
  - coincident faces: 0;
  - disconnected parts: 0 detached.
- **Ledger:** assessment **minor** (unchanged).
  - visibleFlaws (unchanged): "The 0.05 rad settle of p onto its click turns p alone; the chain does not show the matching take-up."
  - Append to limits: "p90: the arbors show through P and p; the click is a curved plate with its eye inside p's rim, as drawn; the ratchet is cut deeper."
  - Brown's click spring is still not modelled.

### 331: closed cylinder under the crossbase
- **Verified.** The head was a bare 1.68 × 0.24 slab below the crossbase.
- **Change** (`correctSlottedGuide`):
  - **Barrel.** A closed bored barrel (outer 0.70, inner 0.64) is centred on the rod axis. It hangs from a cover sunk 0.005 into the crossbase's underside, so no face is coplanar with it, and has a bottom cover.
  - **Piston.** The piston is now a round head (radius 0.63). Its highest point is 0.04 below the cover.
  - **Rod.** The rod runs into the head.
  - **Camera.** The barrel is excluded from the camera fit, so the default framing is unchanged.
- **Captures:** `331c/331/tile.png`, `331/z-*.png`.
- **Tests.** movement-331, piston-guide-329-331-solids and engines-326-345-clearance pass.
- **Screens.** Body intersections are clear. The one coincident pair is the pre-existing crankshaft housing/bore pair (1.7e-5, below the filter).
- **Ledger:** assessment **reasonable**, visibleFlaws empty.
  - Append to limits: "p90: the piston runs in a closed inferred cylinder under the crossbase (Brown's crossbase and gland imply it); no steam or ports are modelled."
  - Low, open: the flywheel is about 20% small.

## Medium

### 259: notch count and profile
- **Change.** 88 notches (was 48), from the plate's ~11 px spacing on a 152 px radius. They are sharp linear V cuts, half a pitch wide and 0.09 deep, with vertices at their edges, flanks and bottom (creased normals).
- **Captures:** `259/m1.png`.
- **Tests.** movement-259 is updated (88, plus float tolerances).
- **Ledger:** reasonable, no visible flaw.

### 267: block springs
- **Verified.** Bent wire stubs sat at each arm root.
- **Change.** Each spring is a short flat leaf (0.27 × 0.036 × 0.12) on a small seat on the carrier's lobe. Its free end bears on the arm's clockwise edge, solved each frame, so it swings (a stiff cantilever) as the arm retracts: 0.359 rad engaged, 0.133 fully released.
- **Captures:** `267/m1.png`, `after/267/tile.png`.
- **Tests.** movement-267 and friction-clutch pass.
- **Screens.** The leaf clears the carrier. The leaf–seat "coaxial" 0.049 is the intended hinge.
- **Low, open:** the hub plate is not rebuilt as a concave square.
- **Ledger:** reasonable.
  - Limits: "p90: return springs are flat leaves on carrier seats, bearing on the arms (kinematic contact, no force law)."

### 277: smooth hammer outline
- **Change.** The hammer and tumbler are retraced from the plate as eight runs between Brown's real corners (nose, spur root, breast notch, belly foot, tumbler notch). Each run is a centripetal Catmull-Rom spline sampled 16 per span. The walls are merged and crease-shaded, so the curves are smooth and the corners sharp.
- **Captures:** `277/m1.png`, `277/plate-pts.png`.
- **Tests.** movement-277 passes.
- **Low, open:**
  - The pivot boss is 0.23 against Brown's about 0.27.
  - The cocking notches are not cut.
  - The mainspring end is still free.
- **Ledger:** minor (unchanged, for dog a's reach).
  - Append: "p90: hammer outline from splines between the drawn corners."

### 278: continuous leaf spring c
- **Change.**
  - Spring c is one flat leaf (0.09 thick, 0.24 wide): two swept bands and a flat slotted middle. The bands leave the middle level, with no kink.
  - Pin b (0.12 × 0.16) passes through a 0.15 × 0.20 slot. The middle rests on the seat collar.
  - The spring plane moved to the pin's plane (z 0.44).
- **Captures:** `278/m3.png`, `278/v0.png`.
- **Tests.** movement-278 passes.
- **Screens.** Coincident faces went from 6 to 0.
- **Ledger:** reasonable.
  - Limits: "p90: spring c is one flat slotted leaf bearing on pin b's seat."

### 282: rack guides, tooth profiles, hub bore
- **Change.**
  - **Guides.** Each rack guide is one C-section extrusion enclosing its frame post's foot, bridging under the rack (0.03 running clearance) and rising in front of it. The screen now reports 0 detached (was 1, gap 0.074).
  - **Teeth.** Sector and rack share one 20° profile with stub teeth (addendum 0.8 module): involute sector, flat-topped trapezoid rack. They replace the 25° full-height teeth, which were pointed on the rack and petal-like on the sector.
  - **Bores.** The sheave and flanges are bored 0.003 over the hub.
- **Captures:** `282/m1.png`, `282/sector.png`.
- **Tests.** movement-282 passes.
- **Screens:**
  - Coincident faces went from 3 to 0.
  - Slivers went from 2 to 1 and lips stay at 3. All are pre-existing frame-strut joints, outside this finding.
- **Ledger:** reasonable.

### 287: sleeve-stack flicker
- **Change** (in `authored-pickering-governors.js`, after the shared clamp correction, which is owned by p90-fc and was not edited).
  - Each keyed bore steps 0.003 out from the part it overlaps: neck and thrust rings 0.003, keeper and flange 0.006.
  - The neck's outer wall is 0.003 inside the body's.
- **Screens.** Coincident faces went from 5 to 0.
- **Tests.** movement-287 and clamp-working-solids pass.
- **Low, open:** the band springs are round wires, and a clip corner and the finial remain.
- **Ledger:** reasonable.

### 296: arbor through D
- **Cause.** The balance arbor was built at the escape wheel's centre, coincident with its arbor, which left D's bore empty.
- **Change.** The arbor is placed at D's centre. The roller is given its own accent colour.
- **Captures:** `c/296/tile.png`.
- **Tests.** plate-escapements passes.
- **Screen.** It still lists the free-standing balance (roller, pin and arbor) as a near-miss group (gap 0.05). Its fixed arbor stub has no drawn frame, as for the family's other arbors.
- **Ledger:** reasonable.

### 308: Q stud lug
- **Change.** A minimal lug in the cock's plane (capsule radius 11 px plus a 15 px boss) runs from the cock's right edge to Q's stud. The stud's foot is buried 0.03 in the lug.
- **Screen.** The stud is now in the cock group. The remaining "floating" group is the whole fixed cock against the pendulum, which has no drawn frame (pre-existing).
- **Captures:** `c/308/tile.png`.
- **Tests.** movement-308 passes.
- **Ledger:** reasonable.

### 311: FLY
- **Change.**
  - The fly is one long plain blade: 0.07 in the plane, 0.42 along the arbor (edge-on from the front, as Brown's single line). Its half-span is 4.39, the mean of Brown's two reaches from the arbor. A 0.13 boss sits on the arbor.
  - There are no vanes and no white witness.
  - At t = 0 the blade lies on Brown's FLY line (72.5°, from upper right to lower left).
- **Bake.** The gravity plates were regenerated: the 311 outlines are unchanged, only the hash.
- **Captures:** `c/311/tile.png`.
- **Tests.** movement-311 asserts the blade, its span and the t = 0 angle. gravity-escapement-working-solids passes.
- **Open:**
  - The rod/eye lip (low).
  - 310's fly is not changed, because Brown's reading there is uncertain.
- **Ledger:** reasonable.
  - Limits: "p90: the fly is Brown's single long blade, phased to his line."

### 313: impulse roller and pose
- **Change.**
  - The roller is now one plain disc in the impulse plane, carrying P at its edge. Its radius is 0.035 inside the escape wheel's tip circle, so only P reaches the teeth. Brown's notch is set 69° back from P.
  - The disc is see-through (the shared style), because Brown shows the discharging roller V inside it. P's separate arm is hidden, and the old backdrop disc is replaced.
  - Display time starts at Brown's pose: balance at its plate angle, P at the lower left at tooth A, a quarter-cycle (0.125 s) into the analytic cycle. `displayTimeOffset` is exposed.
- **Captures:** `313/m1.png`.
- **Tests.** free-escapement-solids and movement-313 use `displayTimeOffset` when they pair `update` with `stateAtTime`. Both pass.
- **Screen.** The balance assembly is now a near-miss group (0.10), with no frame drawn.
- **Open (low):** the rim seam.
- **Ledger:** reasonable.

### 315: crank hub
- **Change.** The hub is solid and fast on the spindle. The arm now starts at x = 0.2, inside the hub wall, so no stub runs past the hub.
- **Screens:**
  - Coincident faces went from 1 to 0.
  - The coaxial 0.228 is the pre-existing flexure wire.
- **Tests.** movement-315 and pendulum-journals pass.
- **Open (low):** the square bracket slabs.
- **Ledger:** reasonable.

### 316: mercury and thread
- **Change.**
  - The mercury is a full column: the cutaway section is dropped.
  - The adjustment thread is a clean 14-turn helical ridge, sampled 32 points per turn, 40 tube segments per turn. It is sunk 0.008 into the rod (it used to float 0.013 off it).
- **Captures:** `316/m2.png`, `c/316/tile.png`.
- **Screen.** The thread and rod pass through the adjuster block, as they did before: the nut is not modelled as bored.
- **Open (low):** the cap bar.
- **Tests.** movement-316 passes.
- **Ledger:** reasonable.
  - Replace the limit "mercury half-cylinder section" with: "p90: the mercury is a full column; the rod's lower end is hidden in it."

### 318: back bar and rim
- **Change.**
  - The back bar is removed. It read as a second fixed lever through the balance whenever the regulator moved.
  - The rim is a flat rectangular-section ring (3.16–3.54 × 0.30). The spokes run 0.1 into it.
- **Captures:** `c/318/tile.png`.
- **Screen.** The scale plate now stands free (near-miss 0.106), as drawn.
- **Tests.** movement-318 and watch-balance-interfaces pass.
- **Open (low):** the graduations and the taper of the lever.
- **Ledger:** reasonable.
  - Limits: "p90: no back bar; the scale and the staff's rear bearing stand as drawn."

### 321: clicks and cord
- **Change.**
  - Clicks T and R are the seated flat clicks, 0.22 wide (were 0.14/0.15). This is the same builder, rebaked.
  - The rope drum is on B's arbor behind the wheels (z −1.0). The arbor runs back through it.
  - The cord leaves the drum's tangent and hangs behind the wheels to the weight, whose plane moved to z −1.0.
  - The duplicate wrap tube stays hidden.
- **Captures:** `c/321/tile.png`, `321/m1.png`.
- **Tests.** movement-321 and the maintaining-clock bake and interfaces pass.
- **Screen:** 0 detached.
- **Residual.** The drum stays at radius 0.2, because a drum of Brown's barrel radius (about 0.87) would multiply the weight's travel by 4.35. So the cord hangs at x = −0.2, not at Brown's −0.87.
- **Ledger:** reasonable.
  - Append: "p90: the cord leaves a drum behind the wheels; its x is 0.67 right of Brown's."

### 332: crosshead E
- **Change.** E is Brown's capped block only link-deep (z 0–0.29). A slim 0.5s × 0.5s arm runs back to the rod on the vessel axis. The vessel must stay behind the right link, which crosses its front, so the axis cannot move into the link plane.
- **Captures:** `c/332/tile.png`.
- **Tests.** movement-332 and marine-parallel-solids pass.
- **Ledger:** reasonable.

### 333: rod P and pedestal O (not fixed; forced)
- **Tried:** the rod was moved in front of O.
- **Result.** The body screen then found pin P crossing O's pin, lug and bracket (0.058). P's straight line runs right through O's position, and pin P itself comes down past O.
- **Reverted.** The rod and pin stay behind O. A test now asserts that pin P stays behind O's pin, lug and bracket.
- **Why it is forced.** Brown hides this by breaking the rod off above O. Moving O changes the linkage.
- **Ledger:** assessment **minor**.
  - visibleFlaws: "In the default view the P rod passes behind pedestal O and seems to pierce it; P's straight line runs through O's position, which Brown hides by breaking the rod off above O."

### 336: side lever
- **Change.**
  - The lever is one double-armed extrusion. The left arm mirrors the right (straps and slot) out to the hidden driving station at −10 units, with a round end. The round boss is on shaft O.
  - The shaft's cut end stands 0.07 proud.
- **Captures:** `c/336/tile.png`.
- **Tests.** movement-336 and marine-parallel-solids pass.
- **Open (low):** the diagonal member's end cap.
- **Ledger:** reasonable.

## Flicker
- **260.** The nut journal is 0.005 inside the nut's outer wall and bored 0.011 over the nut bore (0.009 over wheel E's). Visible pairs went from 2 to 1; the remaining pair (3.8e-6) is the old thread pair, below the filter. The report is regenerated (33 poses, 0 penetrations).
- **285.** The quill bearing lands' key notches are 0.003 wider than the key guide's slot. The nut's rear face is 0.015 inside the sleeve's end. Pairs went from 5 to 2; both remaining are end-ring pairs of 2–4e-5, below the filter.
- **270: deferred.** The file is owned by p90-fc (`authored-bearings.js`, `bearing-working-parts.js`).

## Deferred
- **Owned by another lane.**
  - 270, by p90-fc: rear plate gap, pin-end speckle and lower pulleys.
  - The shared `clamp-working-parts.js` (p90-fc) is untouched; 287 is fixed in its own file.
  - `source-presentation.js` (p90-fe) is untouched.
- **Not attempted (low):**
  - 261, 264, 265, 266, 272–276, 280, 281, 283, 284, 286, 289, 290, 294, 297, 299, 302–306, 309, 310, 312, 314, 317, 323–326, 328, 329, 335, 338;
  - the low items within 277, 287, 311, 313, 315, 316, 318 and 336 listed above.
- **Forced:** 333 (above).

## Test run
- **Command:** `node --test` over:
  - differential-thread-solids, detached-chronometer-working, engines-326-345-clearance, free-escapement-solids, friction-clutch, gravity-escapement-working-solids, lathe-gear-engagement;
  - maintaining-clock-bake, maintaining-clock-interfaces, marine-parallel-solids;
  - movement-259/260/266/267/269/277/278/282/285/287/308–313/315–321/329/331/332/333/336;
  - pendulum-journals, piston-guide-329-331-solids, plate-escapements, watch-balance-interfaces, clamp-working-solids, authored-loader, loop-seams.
- **Logs:** `/dev/shm/p90/fd/tests/run3.log`. **Result: 320 pass, 0 fail.**
