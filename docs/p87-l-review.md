# Pass 87, lane p87-l: 318, 349, 363, 367, 369, 379, 380, 382

Reviewer: Claude Opus 5.5, lane p87-l. Date: 2026-09-27.

Scratch and captures are in `/dev/shm/p87/p87-l/` (outside Git).
- **Before:** `before/ID-d.png` (default view) and `before/ID-r.png` (rotated).
- **After:** `after/`. `cmp-ID.png` shows the plate, the before view and the after view side by side.

Every changed ID was run through `screen-body-intersections`, `screen-disconnected-parts` and `check-loop-seams`. The results are in `bi.json`, `dp.json` and `seams.json`; 382 was re-run after its last fix (`bi382.json`, `dp382.json`).
- **Intersections:** worst solid depth is 0 for all eight IDs.
- **Seams:** 0.
- **Disconnected parts:** 0 detached and 0 slivers for all eight.

## 318: needle tip and arm
- **Cause.** `correctWatchRegulator` in `watch-balance-parts.js` rebuilt the lever arm to reach the pointer radius. The 0.16-deep triangular tip then lay inside the arm's last 0.64, with coplanar front and back faces, so the tip clipped through the arm.
- **Change.** The arm now ends at the tip's base, which is read from the tip's own geometry. The two parts abut on one face. The helper function is used only by 318; the compensation-balance helper in the same file is untouched.
- **Captures:** `after/318-z.png` (front), `after/318-zr.png` (rotated), `cmp-318.png`.
- **Test:** movement-318 asserts that the arm's end is the tip's base, to within 1e-6.

## 349 and 367: parallel links
- **Cause.** `ornamental-ruler-arm.js`, used only by 349 and 367, extruded a contour traced from the engraving. It had 33–60 points, ran off-centre by up to 0.015 of the pin distance, and was lumpy.
- **Change.** Each link is now one smooth extrusion:
  - two eye rings concentric with the pins (128-segment arcs);
  - a body whose half-width is a Catmull-Rom spline, mirrored about the pin line and about the midpoint, and sampled at 400 points;
  - creased normals, so the side walls shade smoothly.

  The profiles follow Brown's outlines. 349 is a plain swelling bar. 367 is a baluster: a neck and bead at each eye, a bulb either side, and a waist.
- **Captures:** `after/367-crop.png`, `after/349-z.png`, `cmp-349.png`, `cmp-367.png`.
- **Tests:** a new test in ruler-349-367-solids checks four things: one piece with two bores, more than 400 outline vertices, mirror symmetry about the pin line and midpoint, and eye arcs concentric with the pins. The existing pin-fit and no-penetration sweeps still pass.
- **Residual:** `ruler-arm-profiles.js` is no longer used for geometry. Only its provenance test reads it.

## 363: diagonal braces
- **Cause.** The braces were `makeBeam` boxes, square-ended. At the foot, only one corner met the base (image 44).
- **Change.** Each brace is now one flat bar in its outer plane:
  - its foot is cut level and sunk 0.01 into the base;
  - its head is cut plumb and sunk 0.01 into the fulcrum cheek column, at x = ±0.24.
- **Captures:** `after/363-zz.png` (foot and head zooms), `after/363-r.png`, `cmp-363.png`.
- **Test:** a new seesaw-finite-supports test checks the full-section seats at both ends and that each brace lies in its cheek's plane.

## 369: cheeks and bracing as one casting
- **Before.** The model had separate pieces: a crossbar box, two post boxes, six `beamBetween` brace sticks in a rear plane, and two cheek plates.
- **After.** One flat extrusion in the cheeks' plane (z 0.05–0.35) holds:
  - the crossbar, with its underside at the cusp;
  - both posts;
  - the bracket webs;
  - both cheek bands, whose lower edges are the exact cycloidal contact curves offset by the cord radius.

  Each bracket has two triangular holes placed from the plate's pixels, with a diagonal brace between them, as Brown draws. The cusp boss and anchor stud are hidden (Brown draws neither), and the cord's end bears on the crossbar at the cusp.
- **Colour.** The whole casting is now orange, the cheek colour.
- **Captures:** `after/pair-369.png` (default, cusp, rotated, back), `cmp-369.png`.
- **Tests:**
  - movement-369 asserts one piece with four holes, symmetric, and no visible boss.
  - pendulum-instrument-solids checks that the cord clears the casting over a full swing.

## 379: consistent frame thickness
- **Before.** The lower arm was 0.34 × 0.62, against 0.32 × 0.52 for the back and upper arm. The three boxes also overlapped at the corners with coplanar faces.
- **After.** The C-frame is one extrusion, 0.32 thick throughout and 0.52 deep.
  - Each arm ends inside the wall of its journal, clear of the bore.
  - The feed nut's radius went from 0.31 to 0.34, to match the drill housing, so the arm end can be fully buried.
- **Captures:** `cmp-379.png`, `after/379-r.png`.

## 380: C-clamp as one extrusion
- **Before.** Three boxes of different depths overlapped with coplanar faces, and a wider work rest made a lip (image 41).
- **After.**
  - **Frame:** one 0.34-thick extrusion, 0.54 deep. As Brown draws, the lower arm's inner face is flush with the rest's top, and the underside is chamfered up to the rest.
  - **Work rest:** now as deep as the arm (0.54, was 0.76).
  - **Upper arm:** buried in the nut wall. The nut's radius went from 0.39 to 0.44 so the arm can reach it without cutting the 0.331 bore.
- **Captures:** `after/pair-380.png` (default, rotated, zoom on the rest), `cmp-380.png`.
- **Tests:** a new drill-feed-solids test checks that for 379 and 380 the frame is one extrusion with the same section thickness everywhere, and that each arm-end corner lies inside its journal while clearing the bore. The thread-clearance sweep now runs against the one frame.

## 382: mirror back, set screw and turned neck
- **Mirror back.**
  - **Frame:** one moulded solid swept round the rounded rectangle: a rounded outer edge, a bold bead, a cove and a small inner bead. It is sampled from a spline and has creased normals.
  - **Back board:** symmetric, with two equal recessed panels either side of a plain central rib. The hinge neck is sunk 0.01 into the rib.
  - **Removed:** the old asymmetric D panel and left pocket.
  - **Glass and board:** let 0.005 into the frame, so no faces coincide.
- **Set screw.** The open sector collar and radial boss are gone. The pillar is now one turned solid (128 columns) made of three sections:
  - the vase;
  - a straight bored neck with a real round radial hole;
  - a round bead collar and a socket cap.

  The screw enters the neck just under the bead, as the plate shows. Its point bears on the stem with a 0.001 gap, which removes the old 0.015 near-miss. The solid is watertight.
- **Captures:**
  - `after/pair-382.png` (default, rotated, hinge/back, phase 0.5);
  - `after/382-holes.png` (the neck hole with the screw hidden, and with it shown);
  - `cmp-382.png`.
- **Tests:** a new movement-382 test checks:
  - the screw axis is the hole axis, at the hole's height;
  - the tapped hole fits the thread;
  - there is no boss;
  - rays along the axis pass through the neck wall;
  - the back panels mirror each other;
  - the moulded bead stands proud.

  adjustment-contact-solids now targets the one pillar.

## Tests
A single run of 17 files passed 105/105 (`/dev/shm/p87/p87-l/tests.log`). The files were:
- movement-318, 349, 363, 367, 369, 379, 380 and 382;
- watch-balance-interfaces, ruler-349-367-solids, drawing-ruler-solids, seesaw-finite-supports, pendulum-instrument-solids, drill-feed-solids and adjustment-contact-solids;
- authored-loader and camera-catalog.

382 was re-run after its final watertightness fix (13/13).

## Seen but not fixed
- **379 and 380, crank knobs:** the disconnected-parts screen reports a small lip (0.01–0.015) where each crank arm enters its knob.
- **379 and 380, open meshes:** the intersection screen flags an open mesh in each: 379's feed-handle arms and 380's annular end faces. None of these is part of this pass's complaints.
- **380, other parts:** the model keeps parts that Brown's plate simplifies: the tall cylindrical nut on the upper arm and the stacked sleeve collars.
- **382:** the set screw still projects further than Brown's.
