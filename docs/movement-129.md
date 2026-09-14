# 129 — differential windlass reconstruction

The [source engraving](https://507movements.com/mm_129.html) shows two
unequal coaxial barrels, one rope and a movable pulley. The caption specifies
lift per shaft revolution as half the difference of the barrel circumferences.
The original site has no 2D animation for this movement.

The first correction removes a definite hardware interference. Previously,
both rope exits lay in the axial midplanes of flanges extending beyond the
rope pitch radii. Thus each flange cut through its rope, despite passing the
existing pitch-line velocity and length equations. The replacement has three
flanges, including the engraved central flange, and bare barrel between that
flange and each rope exit. The winding and lift equations are unchanged.

The full raise/lower cycle is now six seconds, with an explicit display minimum
so the generic timing heuristic cannot accelerate it. The scene ground is
disabled; the authored support frame and base remain. The finite-difference
velocity test uses a smaller time step, and its roundoff tolerance scales
with speed instead of assuming the previous slower input.

Validation: a finite rope/flange test samples 121 cycle poses and 1,001 rope
points per pose, using signed distance to capped cylinders minus rope radius.
All three flanges clear the rope; the original exit-flange placement fails the
same check. The existing lift, material-motion and continuity regression passes.
Desktop source and moving views were inspected, and the production build passes.

## Lower hardware and winding correction

The lower sheave now renders as one grooved solid with a real axle bore,
flat face normals and smooth circumferential normals. This replaces a solid
tread overlapping an open pulley's spokes and decorative parts. The front
hanger clears the rotating face. Its length is reduced from 1.95 to 1.4 units,
its width follows the engraved plate, and a traced J-shaped hook replaces
the circular torus. The fixed front boss and axle end are restored.

The previous global cubic easing squeezed neighbouring rope turns together
near each end; at 6.6 turns their centerlines could be closer than the rope
diameter. Easing now occupies only a quarter-turn at each end. Winding spans
are constant, so both rope ends retain fixed coordinates on the rotating
shaft instead of sliding axially. Coils redistribute within those spans;
this is an idealized geometric winding model, not frictional rope dynamics.

The winding test samples 61 shaft poses and 601 points on each winding,
checking nonlocal coil distances as well as fixed anchors. The previous
easing fails its clearance control. The finite rope section clears the new
sheave groove, and all flat face triangles have planar normals. Existing
motion and flange-clearance regressions also pass.

`node scripts/audit-windlass-rope.mjs` measures the actual visible winding
length rather than trusting the nominal stored length. With the revised
barrel and rope dimensions below, at 10,000 and 20,000 segments per winding
over 61 shaft poses, the maximum correction omitted by the ideal lift formula
is 0.03683 and 0.03690 source pixels, respectively.
Thus the retained ideal differential lift law has a measured subpixel
geometric approximation; it is not exact finite-helix length conservation.

## Upper frame and proportions

The shaft height now follows y=115 and the lower pulley y=319 in the raster;
the base follows y=430. Winding centerline radii are 50/31 pixels with a
four-pixel rope radius. The winding spans fill the available barrels while
retaining a 0.02-unit clearance allowance beyond rope radius at the flanges.
Posts follow x=94/430 and extend above the shaft as drawn.
Large and small flange radii are approximately 68 and 46 source pixels.

The old posts sat behind the bearings without touching them. Bored extruded
posts now meet the bearing sleeves, with feet spanning back to the base rail.
The bore clears the shaft, and the shaft ends just outside its bearings.
The unengraved crank and diagnostic markers are hidden. A near-frontal camera
makes the source proportions easier to compare.

The remaining fidelity qualification concerns the source projection and its
unstated depth arrangement, particularly the lower sheave's apparent shape.
The current sheave tilt makes the two opposite-side rope exits geometrically
compatible in 3D, but the engraving does not establish that depth arrangement.
Do not treat algebraic pitch-line checks as proof of those remaining details.

The updated production build, four focused geometry/clearance tests, the
existing 129 motion regression and packaged desktop/mobile playback test pass.
Final packaged desktop and mobile views were visually inspected.
