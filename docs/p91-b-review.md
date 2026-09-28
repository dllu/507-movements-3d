# Pass 91, lane p91-b: 350 pin support, 352 hook, 391 grooves and elbow lever

Reviewer: Claude Opus 5.5, lane p91-b. Date: 2026-09-28. No git writes.

Scratch and captures are in `/dev/shm/p91/p91-b/` (outside Git). `before/` holds the HEAD captures, `after/` the new ones. File names are `<id>-<view>-p<phase>.png`: `d` is the default view beside the plate; `r1`, `r2` and `back` are rotated views; `z*` are zooms.

Files changed:
- `src/simulation/authored-slotted-traverses.js`
- `src/simulation/authored-redirected-windlasses.js`
- `src/simulation/authored-alternating-weighted-racks.js`
- `src/simulation/weighted-rack-selector-contact.js` (used only by 391)
- Tests: `movement-350`, `double-traverse-groove-solids` (350 part only), `movement-352`, `movement-391`, `weighted-rack-selector-contact` (rewritten), `weighted-rack-handoff-solids` (one assertion)
- `src/data/display-profiles.{json,js}`: regenerated for 350, 352 and 391 with `node scripts/measure-display-profiles.mjs 350 352 391`. Only the 350 and 391 entries changed, so 391's camera now frames the taller C.

Shared helpers were not edited: `cord-traverse-working-parts.js`, `alternating-drive-finite-parts.js` and `hoist-hardware.js`. No saved validation report fingerprints these files.

## 350: centre pin C on a plain, centred support
- **Before** (`before/350-back-p0.png`, the user's 62.png). The lever's centre pin C was carried by an off-centre vertical riser (0.26 right of C) and an angled neck, which read as a notched stalk. That was the official animation's rerouting.
- **After.** Brown carries C on the broad round-topped standard's own centreline. The riser, neck and lower neck are gone. C now rides on one plain round boss (r 0.24, bored 0.136), centred on C, standing from the standard's front face to just behind the lever. The pin runs from inside the standard, through the boss, to the front. Pin O stays at least 0.59 from C, so its bearing (between the standard and the lever) always clears the boss.
- **Pins recoloured** (deferred from lane p91-w). O, D and C were white and read as holes on the cream ground. They are now steel (`PALETTE.muted`), with roles `stationary-steel-pin-…-O` and `moving-steel-pin-…-D`. The ink front indices stay.
- **Captures:** `after/350-{d,r1,r2,back}-p0.png`, `after/350-d-p0_45.png`.
- **Tests:** movement-350 and double-traverse-groove-solids pass (13/13). They now assert that there is no riser or neck, that the boss is centred on C, and that the pin spans the boss.
- **Screens:**
  - Coincident faces: 0.
  - Seams: 0.
  - Body intersections: worst solid 0.0000.
  - Disconnected parts: O's group and D are near-misses of 0.016. This is the pins' running clearance in their slots, as at HEAD.
- **Residuals (pre-existing, not changed):**
  - O's black bearing stands without a drawn support. Brown draws none.
  - Two small lips (0.039) where the lower neck meets the bevelled slot loop.
  - The white traverse index on the bar remains.

## 352: an ordinary hook
- **Before** (`before/352z-{z,zr}-p0.png`, the user's 63.png and 64.png):
  - a box hanger that stopped in mid-air and ran into the load;
  - a 1.55π torus "C" with cut, uncapped ends, not joined to the hanger;
  - the load passing through the hook.
- **After.** The ironwork is built in the moving sheave's own frame, as the plate draws it:
  - **Stirrup:** a round-bar stirrup rides the sheave axle on two closed eyes and passes under the rim.
  - **Hook:** one smooth round bar, 0.045 radius.
    - Its closed eye is linked round the stirrup's bottom bar, 0.004 clear.
    - The shank curves into a circular bowl that opens right, as Brown draws it.
    - The tip ends in a hemispherical cap.
  - **Load:** the bell weight hangs by a cast bail across the hook plane. The bail rests in the bowl bottom, 0.003 clear, and its foot is cast into the load top.
  - **Axle:** shortened from 0.58 to 0.38, just proud of the eyes.
  - The shared `correctCordTraverseParts` still resizes a box `hanger`, so the factory restores the stirrup geometry after that call.
- **Captures:** `after/352-d-p0.png`, `after/352-{z,zr,zb}-p0.png`, `after/352-p05-pair.png`.
- **Tests:** movement-352, windlass-flange-clearance and cord-traverse-working-solids pass.
  - movement-352 asserts one eye, bar and cap; that the tip cap sits on the bar end; that the shank starts inside the eye; and that the stirrup bar passes through the eye.
  - A finite check (`x/h352.mjs`) measured these clearances:

    | Pair | Clearance |
    | --- | --- |
    | eye / stirrup | 0.0040 |
    | bail / hook | 0.0031 |
    | stirrup / sheave groove | 0.030 |
    | eyes / sheave groove | 0.026 |
    | hook bowl / load | 0.0167 |
- **Screens:**
  - Disconnected parts: 0 detached, no lips or slivers.
  - Coincident faces: 0.
  - Seams: 0.
  - Body intersections: out of heap on the 1024-segment laid rope, as in p90.

## 391: Brown's grooves, a rigid roller arm on A1, and racks that right themselves
Reference: the plate zooms `l.png` and `r.png`. Each groove b is a closed channel round a D-shaped island. The left and right grooves are mirror images.
- **Grooves.** Each groove has two straight vertical branches:
  - the inner branch, where the rack stands upright in mesh;
  - the outer branch, where the rack hangs out at 0.17 rad.

  The branches are joined at two opposite corners by arcs, each tangent to one branch:
  - **Upper arc.** On the outer corner (top-left on the left groove, top-right on the right), tangent to the outer branch. It rises to a sharp corner at the top of the inner branch. Near the corner it is a radius-2.5 arc leaving along the rack's own swing about its pivot at the top of the stroke. A radius-0.447 fillet then turns it tangent into the outer branch.
  - **Lower arc.** On the inner corner, radius 1.19 and tangent to the inner branch. It falls to a sharp corner at the foot of the outer branch, meeting it 20° below horizontal.

  The pin locus is written in pin space, and the rack angle at any piston height is solved from it exactly. Each groove is still generated as that locus, so the casting shows the same shape.
- **How the racks right themselves** (no dwells: one quintic rise, one quintic fall):
  - **A (outboard weight).** It rises out of mesh on its outer branch. The upper arc's outer wall cams it upright as it rises, and it lands in the top corner, in mesh, exactly at the top of the stroke. It drives the wheel down. At the bottom its weight swings it out along the lower arc.
  - **A1 (inboard weight).** Its weight swings it in along the lower arc just after the bottom, and it drives the wheel up. At the top, spring d, through C, carries its pin over the upper angle: Brown's stated purpose for C and d. It then descends on its outer branch.
  - The circulation follows from the groove shapes and the weights. With the opposite sense A could not re-enter at the bottom, and C would be unnecessary at the top.
- **Tooth clearance through the exchange.** Near the top corner the piston moves only 0.012 while each rack swings the 0.105 rad in which its teeth overlap the pinion's. The entering and leaving flanks stay within the pinion's flank clearance.
  - A dense check at 1/256 s over 3.3–4.7 s (`x/dense.mjs`) gives a minimum rack-tooth/pinion clearance of +0.00091 (working flank).
  - The 257-pose handoff test passes at > 0.0008.
- **C and A1's protrusion** (the user's 65.png). The pivoting link, its pin, and the lug and roller on A1's face are removed. A1's bar now carries one rigid protrusion running diagonally up and to the left from above its last tooth, about 25° from the rack. The protrusion ends in an eye. Rack and protrusion are one extrusion. A roller on a short axle stands forward in C's plane.
  - **Contact.** The roller bears directly on the convex edge of C's curved arm, whose outer edge is now a true circle of radius 2.085.
  - **Loading.** Over the last 0.86 of A1's rise, the roller swings C about 31° round against spring d.
  - **Carrying over the angle.** At the top, C's thrust, down and outward, gives A1 an outward (clockwise) moment of −2.0 to −4.9 per unit normal force (mesh contact gap ≤ 0.00001), and A1 is carried over the angle. C follows the roller back to rest and lets go 0.07 below the top.
  - **Pivot.** C's pivot is moved to 0.12 left of and 1.63 above the upper corner. That is higher than Brown draws it, because our rack's teeth run above its guide arm, so the roller must sit above them.
  - **Lug removed.** The pass-90 lug that carried C's pin from guide b is removed. Following the p79 ruling, C's pivot stands free, as Brown draws it.
- **Captures:**
  - `after/391-d-p0.png`: default view beside the plate.
  - `after/391-phases.png`: nine phases.
  - `after/391z-tile.png`: C, roller and protrusion at phases 0, 0.72, 0.78 and 0.83.
  - `after/391z-{zr,zl}-p0.png`: groove zooms.
  - `after/391-{r1,r2,back}-p0.png`: rotated views.
  - Before: `before/391-*.png`.
- **Tests:** 27/27 pass across movement-391, weighted-rack-selector-contact, weighted-rack-handoff-solids and alternating-drive-solids.
  - New in movement-391:
    - every pin sample lies on a straight branch or on one of the three arcs;
    - the straight branches carry most of the loop;
    - each arc is tangent to its branch, and the corners are sharp;
    - the left groove mirrors the right;
    - A is cammed upright into the top corner, and A1 is carried out after the top;
    - both racks hang out at the bottom.
  - The selector test is rewritten:
    - one rigid protrusion, with no link on C and no lug;
    - separation of C, roller, axle, protrusion, guide pin, pins, knob, spring and casting over 257 poses;
    - the mesh contact gap stays under 0.002;
    - the outward rack moment is below −1 and the spring tension positive;
    - loading, then assist, then release, then rest;
    - C swings about 31° with no jumps.
  - The locus tolerance was relaxed from 1e-12 to 1e-9 and crosshead repeat from 4e-15 to 4e-14. Both are round-off where the rack angle has a square-root profile at the corner.
  - The loader fingerprint for 350, 352 and 391 matches (lazy route = legacy). The full loader test currently stops at movement 64, another lane's file.
- **Screens:**
  - Coincident faces: 0.
  - Seams: 0 (period mismatch 0.138, within tolerance).
  - Body intersections: worst 0.0175, spring d's hook on its stud. This is an attachment and pre-existing.
  - Disconnected parts:
    - C, its pin and its knob are floating. This is by the p79 ruling: the pivot is drawn without support.
    - The output wheel is floating. Its bearing standard is an undrawn part hidden by the source presentation. Near the bottom, neither rack is in mesh at a sampled phase (next paragraph).
    - The crosshead / A1 weight short-of-pin 0.02 is pre-existing.
- **Residuals:**
  - **Wheel runs with no rack in mesh.** From A leaving mesh (piston about 4.15) to A1 entering, the wheel is in mesh with neither rack. That is about 0.9 of piston travel through the bottom, about 1.15 rad of wheel turn. Over that stretch the wheel follows the same prescribed law, with a flywheel assumed. This is forced by Brown's lower arcs, which are tangent to the inner branch.
  - **Prescribed, not solved.** Corner selection (the weights, the cam wall and C's assist) is prescribed kinematically. Passive dynamics are not solved.
  - **C sits higher than the plate.** C's pivot is higher above guide b than Brown draws it. At Brown's pose the roller is 0.9 below C, where Brown shows it touching.
  - **Stale text in a shared file.** `alternating-drive-finite-parts.js`'s `finiteInterfaceReview.qualification` still mentions dwells. That file is shared with 390 and was not edited.

## Proposed ledger rows
- **350.**
  - assessment: `reasonable`
  - visibleFlaws: ``
  - limits (replace the p90 note): "p91: pin C rides on a plain boss centred on Brown's broad standard (riser and neck removed); pins O, D, C are steel. O's bearing stands without a drawn support; small 0.04 lips where the lower neck meets the slot loop."
- **352.**
  - assessment: `reasonable`
  - visibleFlaws: ``
  - limits (append): "p91: the hook is one round bar with a closed eye linked through a round-bar stirrup on the sheave axle, a circular bowl and a capped tip; the load hangs by a bail in the bowl."
- **391.**
  - assessment: `minor`
  - visibleFlaws: "C's pivot stands higher above guide b than drawn (the roller must clear the rack's upper teeth); near the bottom the wheel turns with neither rack in mesh (about 1.15 rad, flywheel assumed)."
  - limits (replace): "p91: each groove is two straight vertical branches with an arc at two opposite corners, each tangent to one branch (upper arc tangent to the outer branch, lower arc to the inner), sharp corners at the top of the inner branch and the foot of the outer; A is cammed upright by the upper arc and lands in mesh at the top, the weights swing the racks on the lower arcs, and C, loaded by a roller on A1's rigid diagonal protrusion (no pivoting piece), carries A1 over the upper angle. Tooth clearance through both exchanges ≥ 0.0009. C's pivot is free-standing (p79). Corner selection and C's assist are prescribed, not a force solution."
