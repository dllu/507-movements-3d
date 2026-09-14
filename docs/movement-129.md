# 129 — windlass review in progress

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

This is a targeted correction, not a completed fidelity review. The winding
helix's length and anchoring, transitions onto the free legs, lower-sheave
shading, hanger/hook proportions and source projection still need review.
The current sheave tilt makes the two opposite-side rope exits geometrically
compatible in 3D, but the engraving does not establish that depth arrangement.
Do not treat algebraic pitch-line checks as proof of those remaining details.
