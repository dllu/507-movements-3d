# Pass-53 lane p53-fix-d review (audit fixes 382–507)

Source: the rotated-view audit `/dev/shm/audit53/d/findings.json`. For each ID the
default, +60°, −70°, behind and top views were captured at several phases on a
private non-watching dev server. Captures are under `/dev/shm/q4/final`, and the
earlier before/after sets under `/dev/shm/q4/{before,after,A,B,C,D}`. Intersections
come from `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
Other lanes' concerns (dashed lines, crops, black rims, rope style, 63/305/277)
were not touched.

## Stone lifting (493, 494)

- **494 tongs.** The stone now rests on a plain flat bed while the tongs open and
  close. It lifts clear only while both tips bite its sides: phases 0.2–0.7, with
  the tips exactly on the bite points. The fixed hoist eye was raised from y 6.25
  to 6.75, because the shackle ring passed through it at full lift. Worst
  intersection went from 0.0785 (ring through eye) to 0.060. The residuals are
  the white bite markers half-sunk at the bite points and the rope ends in the
  eye and ring. Brown draws no ground, so the bed is a reconstruction support.
- **493 lewis.** The mortise is now a blind pocket, open only at the top and at
  the front section face (Brown's section plane). The lining, floor and back wall
  were shortened to the pocket depth. The pocket stays straight-sided, as the
  plate and the canvas both draw it. The white wall-contact indices, which Brown
  does not draw, were removed. Worst intersection went from 0.0596 to 0.0000.

## Gears, racks and cocks (382, 391, 395, 414)

- **414.** A solid face web now runs from the hub (r 0.34) out to r 2.235 behind
  the spiral band, so both turns sit on a wheel face. `docs/validation/219-224-414-contact.json`
  was regenerated. Intersections: 0.0001 before and after (the existing
  shaft/pinion graze).
- **391.** Brown's short link was added to C. The contact solver
  (`weighted-rack-selector-contact.js`) now uses both C's arc and the link, with
  a monotone scan plus bisection. The rack's top roller lifts C from −0.10 to
  −0.37 rad between phases 0.26 and 0.45. The spring returns C, and the link
  carries the roller over the upper corner. Intersections: clear before and
  after. Residual: our pivot is lower and further left than Brown's, so the link
  hangs down-left and reads as a fork.
- **395.** Four hollow port pipes per figure now run out past each circle. The
  plug is cut on both faces around a mid-plane web, so its back shows the
  channels. The test block in `tests/cock-ferry-working-solids.test.mjs` was
  updated for this design. Intersections: clear before and after.
- **382.** The mirror glass and frame no longer receive shadows. The stair-step
  patch was shadow-map aliasing from the hinge bracket; tighter shadow extents
  and bias did not remove it. Intersections: clear.

## Engines (421, 423, 425, 470, 475)

- **421.** The casing is now one round cast barrel with a single clean front
  section window, and the head halves are matching annular sectors. The piston is
  cut by the same section, so its flange no longer shows through open sides.
  Intersections: clear, and the barrel is now closed.
- **423.** The casing is now a thick sectioned casting with a back wall. The
  quadrant walls are solid bands that continue into the casing and the foot, so
  they no longer end in mid-air. The end walls are full depth, and pistons B are
  tapered plates (0.07 to 0.30 wide). The undrawn admission and exhaust tubes are
  gone. Intersections: clear, now checked with the walls as solids.
- **425.** Brown's pear-shaped outer casing was added, with filleted feet and two
  flanged necks. Each port is a walled passage from its own window in the bore.
  Shaft B now rides in the rotor, which removes the two coaxial overlaps (0.348
  and 0.299). Intersections are now clear. The tests pin the new parent and
  exempt the two port windows.
- **470.** The steam pipe now enters from the left, and the black stack above the
  valve chest is no longer shown. The fluid overlaps with the lever, spool and
  stack are gone; what remains is fluid or translucent only.
- **475.** Chamber D's meridian is now a Catmull-Rom spline through Brown's
  seven section points, sampled at 61 levels, so the bulb is smooth.

## Water motors (434, 435, 436, 438, 443, 463)

- **434.** The long shaft and the bridge on two posts under the base were
  replaced by a short shaft running in a bored bush on the foundation's
  underside. Nothing ends in mid-air in side or under views.
- **435.** The stray bridge was replaced by a four-armed step-bearing spider.
  Each arm runs from the bearing collar to the foundation, outside the central
  discharge. Checked from below at 8:−1.5:3.
- **436.** The flow-path tubes that read as stiff blue rods are hidden. They are
  kept as data for the drifting flow markers.
- **438.** The floating pale sliver was the shaft rotation marker, which Brown
  does not draw. It is now removed through `source-presentation`.
- **443.** The gooseneck wire was replaced by a flat strap bracket from a bored
  boss on the shaft stub, carried on a saddle across the trough walls. The wheel
  now has 12 open box buckets standing out past the disc edge (before: 8 solid
  boxes). The bearing posts moved outside the bucket sweep, and the ground was
  lowered.
- **463.** The ruled water lines now lie on the channel's far face, 0.06 behind
  the leaves, so no stroke cuts through a leaf in rotated views. The stray
  sediment disc became a low deposit bank across the channel bed; it shrinks as
  the scour clears it. Screen: no solid pairs (the bank seated on the bed, 0.0000).

## Pumps, meters and mills (451, 465, 466, 479, 482, 485)

- **451.** The air vessel is now a smooth bulb: a rounded bottom rising from the
  neck, then an elliptical dome up to the dip tube, sampled densely. The water
  and air contents follow the same profile inset by 0.077, and the volume law is
  unchanged. The side outlet is now an S: it leaves the neck, dips under the
  bulb and rises beside it. Intersections before: sampled-clear. After: only
  fluid overlaps and seated check disks (0.0000).
- **465.** Brown's operator was added. He stands astride the pivot, shoes fixed
  on the beam, with an upright body that sways toward the falling end. His legs
  and arms are closed by two-link IK to the beam and to a hand-bar. The hand-bar
  runs parallel to the beam on two stanchions and rocks with it. He is built in
  the manner of 377's walker: a lathe jacket, trousers, a round-crowned hat and
  a skin head. The limb ends meet the shoes and grips exactly (gap 0.0000). The
  arm poles and grips were tuned so the arms clear the bar except at the wrist
  grip (screen: 0.036 forearm into bar at the grip). Intersections: the only solid pairs are the figure's own joint
  overlaps (thigh/seat, knee, elbow, wrist/hand), which are intended joints, and
  the hand on the bar.
- **466.** The pump cistern now stands on the press's ground. Its three walls
  continue down to the foot of the press columns, a floor was added, and the
  water fills it from that floor. The stray orange tab was the relief-return
  valve, which Brown does not draw. It and its return water are removed through
  `source-presentation`. The relief law still lowers the ram, and the test was
  updated. Intersections: only the seated check disks, 0.0000.
- **479.** The guide posts moved 0.07 outboard and back to z −0.50, clear of the
  rim flange and the hanging weights. Each pulley axle was lengthened back into
  its post. The post, flange and ball pairs are gone. The only solid pair left is
  the existing rope end in its lug on A (0.0897), which is an intended
  attachment.
- **482.** The full-depth fin is now a small turned boss on the crown, bored for
  the rod. Only a square rod passage is cut through the lid; the rest is unbroken
  across its depth. The lid is built from closed slabs.
- **485.** The tail vane is now a filled sheet in Brown's loop outline.

Intersection screens after the changes: 434, 435, 436, 438, 443, 482 and 485 have no solid pairs.

## Remaining limitations

- The display profiles are stale for the IDs whose bounds changed. For example,
  465's default view crops the operator's head until the profile is re-measured.
  Re-measure: 395, 414, 421, 423, 425, 434, 435, 443, 451, 465, 466, 470, 479,
  494.
- `tests/source-presentation.test.mjs` currently fails inside another lane's
  `selectable-cam-valve.js`, not in these IDs.
