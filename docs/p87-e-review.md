# Pass 87, lane p87-e: 319, 330, 331, 334

Reviewer: Claude Opus 5.5, lane p87-e. Date: 2026-09-27.

The user's screenshots were 48–53. Scratch files and captures are in `/dev/shm/p87/p87-e/` (outside Git):
- `before/`: default and rotated views, plus zooms on each complaint.
- `after/`: the same views after the changes. Side-by-side tiles are `after/cmp331.png`, `after/cmp334.png` and `after/cmp319-330.png`; complaint zooms are `after/z319.png`, `after/z330.png`, `after/z330e.png` and `after/z334.png`.

## 331: crown and crosshead shoes (48.png, 49.png)
- **Crown.** Brown draws the crossbeam and pediment as one piece. No line divides them, and the cloud-shaped hand hole dips below the beam's top edge.
  - **Before.** The old pediment was an arched strap. Its capsule hole's top met the strap's lower edge at y 9.0, which left the sliver gap in 48.png. It also sat as a separate 0.34 plate on a 0.58 beam box.
  - **After.** One extrusion, `crownShape`, 0.44 deep, holds the beam (source y 7..8), the pediment (base x ±5.7 rising to a rounded apex near y 10.6) and a smooth cloud hand hole (flat bottom at y 7.45, two shoulders and a dome), as engraved.
  - **Pillars.** They now rise 0.5 source units into the beam, with their faces inside the crown's faces, instead of stopping at its underside.
  - **Captures:** `after/331-top.png` (before: `before/331-top.png`).
- **Shoes.** 49.png showed each shoe as four boxes: two cheeks, a return web and a 0.045 liner strip.
  - **After.** Each shoe is one C-section extrusion running along the pillar (`correctSlottedGuide`). An inner web bears on the pillar's planed inner face with 0.002 clearance. Front and rear flanges lap 0.105 over the pillar's faces, and the front flange runs up into the yoke end.
  - **Why this shape.** It is open outward, so nothing shows beyond the yoke in front. The old cheeks stood outside the pillars as blue blocks that Brown does not draw.
  - **No coincident faces.** The shoe spans the yoke end's height less 0.01 at each end, and its flange stops 0.015 short of the yoke's end face.
  - **Captures:** `after/331-shoe-top.png`, `-side`, `-rear` and `-y60`.
- **Tests.**
  - movement-331 now asserts: a one-piece crown with one hand hole, the hole dipping into the beam, the pillars seated inside the crown, and one-mesh shoes.
  - piston-guide-329-331-solids passes; the shoe clears the pillar and stays within 0.0021 of it.
- **Screens.**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips (the 8 short-of-pin near-misses are spoke/bearing clearances, as before).
  - Intersections: worst solid 0.0000. The crossbase against a flywheel spoke was 0.0984 at phase 0.19; it was real, because the 0.88-deep crossbase (z -0.50..0.38) reached back into the flywheel plane (z -0.56..-0.38).
  - Seams: 0.
- **Crossbase follow-up.** The crossbase now spans z -0.36..0.38, stopping 0.02 in front of the flywheel's front face, so the spokes sweep behind it. Its front still carries the gland neck, and the legs and braces still seat in it. Brown's front view does not show the depth, so no part was added or moved. Captures: `after/z331cb.png` (phase 0.19, oblique and from behind).

## 334: diagonal braces and pivot F (50.png, 51.png)
- **Braces.**
  - **Before.** They were boxes whose ends only touched. The short upper strut ended inside the rim's inner circle, touching it at one corner (50.png). The diagonal ended 0.2 source units inside the beam's underside.
  - **After.** Each brace is one flat plate 0.18 deep, inside the beam's 0.25 faces. Its beam end runs about 1.8–2 source units into the beam. Its other end runs into the sector's rim band and is clipped inside the root circle and the sector's end radii.
  - **Upper strut.** Its sector end moved 1.2° further from the sector's end. This cleared a 0.023 lip that the lip screen reported.
- **Pivot F.**
  - **Before.** The boss (r 0.7) was tangent to the beam's underside. The strap's neck stopped 0.2 above the boss, and its T-head floated 0.6 above the beam top (51.png).
  - **After: bracket.** Brown's gudgeon bracket is now one plate: concave flanks flaring tangentially from the beam's underside down to a bored boss (r 0.8). It is 0.20 deep (thinner than the beam), and its top runs 1.3 units up inside the beam, so no pad shows.
  - **After: strap.** One bar from the boss, clear of the bore, up to a washer seated in the beam's top edge (y 4.45–5.05). Its back runs into both the beam and the bracket.
  - **Shaft.** The fixed shaft's front end is cut back to beamPlaneZ + 0.125, so it no longer stands proud of the thinner bracket.
- **The chain was not touched.** It belongs to p87-c.
- **Tests.** A new movement-334 test checks each brace buried in the beam and in the rim, the brace faces inside the beam faces, and the bracket and strap seated in the beam, with the strap reaching the bracket. marine-parallel-solids and engines-326-345-clearance pass.
- **Screens.**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips.
  - Intersections: worst solid 0.0000, the working roller contact.
  - Seams: 0.

## 330: forked rod (52.png)
- **Before.** The fork was a stem box, two diagonal branch boxes and two prong boxes, meeting at corners with overhangs and gaps.
- **After.** The rod body is one flat outline in the plate's plane, with the rod axis along u and the fork spread in depth along w. It is extruded a constant 0.13 across the swing plane. The outline is:
  - the stem (0.16 wide);
  - a G1 quadratic fillet into Brown's horseshoe arch, whose outer and inner edges are concentric semicircles (r 0.41 and 0.27);
  - two straight prongs, centred on the wrist planes.
- **Joints.** The stem ends inside the crank boss and the prongs end inside the wrist bosses. Both stay 0.005–0.02 inside the boss faces, with no coincident faces, and clear of the bores.
- **Crotch position.** The arch crowns 0.27 above Brown's junction point (raster 205,164), so the crotch clears the prolonged piston rod's top by 0.10 at top of stroke.
- **Captures:** `after/z330.png` and `after/z330e.png`.
- **Tests.**
  - movement-330 now asserts: one body mesh, no branch or prong meshes, prongs centred on ±forkHalfSpacing inside the bosses, and the constant thickness.
  - piston-guide-solids passes: the fork clears the piston rod, crosshead and guide over 65 poses.
- **Screens.**
  - Disconnected parts: 0 detached, 0 slivers.
  - One lip is reported: the rod against the crank eye, 0.047. It is a false positive: the screen treats the whole fork as one rod, and its end section (0.26) includes the fillet flare. `after/z330e.png` shows the 0.16 × 0.13 stem well inside the 0.4 × 0.2 boss.
  - Intersections: 0.
  - Seams: 0.

## 319: compound bars (53.png)
- **Before.** Each bar was 42 boxes per lamina with seams between them.
  - **At t.** The laminae began at the bar axis, so the brass sat 0.0025 above the bar end and the steel only grazed its corner. The timing-screw stem began 0.115 above the bar end, floating.
  - **Past b.** The laminae stopped at b, where a separate straight 1.15 stub continued.
- **After: laminae.** Each lamina (brass outside, steel inside) is one continuous swept rectangular section, 0.105 × 0.42. Its vertices are rewritten in place each frame, so geometry identities stay stable. It runs:
  - from inside the bar head at t (parameter 0);
  - through weight b (parameter 1);
  - curving on to Brown's free end past b (parameter 1.22).

  The straight stubs are removed.
- **After: bar heads.** Each end of the main bar now has Brown's squared head (0.40 × 0.41, 0.44 deep). The bar end runs 0.25 into it, the lamina roots are buried in it, and the timing screw rises from 0.14 inside it.
- **Tests.**
  - movement-319 is updated: one lamina per layer, brass outside steel at every sampled station, and no projecting stubs.
  - A new test resamples the deforming laminae at 33 poses. The roots are buried in their heads, the stems and bar ends sit inside the heads, and the laminae never enter the weights (0.01 face clearance in the 0.44-deep passage).
  - watch-balance-interfaces drops its stale-sample 319 lamina pairs; the new test replaces them.
- **Screens.**
  - Disconnected parts: 0 detached, 0 slivers, 0 lips (near-misses went from 273 to 1).
  - Intersections: only same-body overlaps buried inside the heads (lamina roots, bar end and stem base); worst solid 0.
  - Seams: 0.

## Integrated run
The full targeted set passes, 60 of 60: movement-319/330/331/334, watch-balance-interfaces, piston-guide-solids, piston-guide-329-331-solids, marine-parallel-solids, engines-326-345-clearance and authored-loader.

## Residuals
- **319.** The free end past b is a reconstruction of Brown's extension; its mass is not included in the inertia model. The bar heads are new solids that Brown draws only as a small block.
- **330.** The arch crowns 0.27 above Brown's junction to clear the prolonged rod. Brown's slight waist in the stem is not modelled.
- **331.** The shoe's front flange shows as a recessed block behind the yoke end in oblique views. The crossbase/spoke overlap is fixed (worst solid 0).
- **334.** The braces are 0.18 deep against the beam's 0.25, so they read slightly recessed.
