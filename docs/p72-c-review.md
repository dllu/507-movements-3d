# Pass 72, lane p72-c: 440, 457, 458, 500, 488, 358, 351, 370

Captures are in `/dev/shm/p72-c` and are not kept in Git:
- `before/` and `after/` hold tiles (`ID.jpg`: plate, four phases, ±60°, back, top) and `rv/ID-default.png` beside the plate.
- `s/` holds the phase strips: `457d`, `457rm`, `457z`, `458d`, `458rm`, `458zz` and `rv3`.

Intersections come from `show-body-intersections ID --spacing=0.01 --samples=129`. Faces come from `scan-bad-faces`.

## 440 tipping trough meter (`authored-tipping-water-meters.js`)

- **Flaw:** in wide views the flume's upper end hung in free space. At 5.25 long it ended just past the square page crop
  (NDC 1.07). On a full-screen stage it showed inside the frame (NDC 0.80, 0.87).
- **Change:** the flume is 6.8 long, from the same lip. Its cut end now lies past the crop on the page stage (NDC 1.39)
  and on a 16:9 full-screen stage (NDC 0.93, 1.17), and in every ±60°, back and top fit (`after/440.jpg`).
  - The authored fit box is unchanged, so the framing does not change.
  - No support is added. Brown breaks the flume off, and the rules let a part past the break continue straight and end
    cleanly off the view.
- **Intersections:** solid pairs clear before and after.
- **Result:** improved. The end is visible only if the viewer zooms well out. That is a limit, not a flaw.

## 457 well sweep and 458 two-bucket pulley (`authored-counterbalanced-well-sweeps.js`, `authored-two-bucket-well-pulleys.js`, `well-bucket-working-parts.js`)

**Flaws:** the tip was brisk, with a 1.2 s and 0.75 s dwell. The spill fell back down the well or shaft.

**Shared change: `asideEmptying(u)`** replaces `tippedEmptying`. Over the top dwell, the operator:
1. draws the bucket aside (0–18 %);
2. tips it about its ears (18–66 %);
3. holds it, then rights it (72–88 %);
4. swings it back.

While it spills, the water it keeps falls smoothly from full to empty. The tip at each moment is the one at which the
tipped bucket holds exactly that much (the inverse of `bucketCapacityAtTilt`). The pour therefore lasts about 29 % of
the dwell (0.93 s for 457), where before it was a flick. The pour stream now leaves along the bucket's tipped
horizontal axis, whichever way the bucket faces. The water mesh stays visible down to a fraction of 1e-12, so the last
thin wedge shrinks away. The old 2.4 % visibility pop is gone.

**457**
- **Timing:** the cycle is 10 s. The descent, fill and ascent keep their 2.8, 1.2 and 2.8 s. The dwell grows from
  1.2 s to 3.2 s.
- **Aside and pour:** the rope swings about the rope pin at constant length, 20.8° in the beam plane, so the bucket moves
  1.0 toward the post. The pour starts 0.25 outside the kerb's outer edge (x −1.215) and lands on the ground's top
  (y 0.46) beside the well. It shows in the default view (`s/457d.jpg`, `s/457z.png`) and in the rotated views.
- **Intersections:**
  - Before: rim×bail 0.050, body×bail 0.017, rope×bail 0.015.
  - After: 0.051, 0.017, 0.015. These are the same ear-hinge and knot joints, with no new pair.
  - An intermediate version swung the rope about the eye's bottom point. It gave beam×rope 0.010 and was replaced.

**458**
- **Timing:** the cycle is 11.5 s. Each rope exchange is kept at 3 s. Each dwell grows from 0.75 s to 2.75 s. The
  official 0/.4/.5/.9 keyframes stay recorded as source data, and this change is a disclosed departure from them.
- **Bail path:** the bail is drawn out to x ±1.86 in the sheave plane. The rope leaves the sheave on the tangent, and
  the bail's height is solved so that leg plus wrap keeps the rope length.
- **Pour:** the bucket passes over the kerb wall (top y 0.10) and pours onto the ground block between the kerb wall and
  the post (y −0.51), in front of the post (`s/458d.jpg`, `s/458zz.png`, `s/458rm.jpg`).
- **Changes that make it fit:**
  - The buckets hang turned half round. This cannot be seen upright. Each bucket therefore tips away from the viewer, and
    its body swings forward, clear of the post and shelf behind it.
  - Both bails hang 0.08 higher, so the bucket clears the kerb top as it passes. The water stands 0.12 higher (top
    −1.97), so the low bucket still fills.
  - The posts are 0.21 deep, at z −0.71 to −0.50, still under the roof boards. The shelf stands 0.05 proud of the post
    instead of 0.15. The camera looks along the depth axis, so neither change shows in the default view.
- **Rejected option:** leaning the rope 0.9 toward the viewer put the rope through the sheave flange (0.050). Any lean
  steeper than about 0.03 in 1 crosses the flange lip. The motion is therefore kept in the sheave plane.
- **Intersections:**
  - Before: rim×bail 0.045, body×bail 0.017, rope×bail 0.015.
  - After: 0.046, 0.017, 0.015. These are the same joints, with no new pair.
  - The 458 screen needs `NODE_OPTIONS=--max-old-space-size=12000`, because the deforming rope makes it run out of heap
    at the default size.
- **Faces:** the post-back and roof-board coplanarity from the first try is removed. One same-look roof pair and the
  water buffer's unused degenerate triangles are pre-existing.

**Result:** both fixed.

## 488 screw propeller (`authored-screw-propellers.js`, `source-presentation.js` 488)

**Fresh reading of the plate: Brown draws four blades.**
- Two broad blades face up and down.
- One blade is seen edge-on, crossing in front of the hub from lower left to upper right.
- The two spikes at the upper left and lower right are the tips of the fourth blade, behind the hub, on the mirrored
  diagonal.

The old "cannot show both faces" residual came from reading the plate as two blades at a low pitch. On a constant-lead
helicoid, a face-on blade's apparent width is its axial extent, `pitch × span / 2π`. The pitch can be measured from the
edge-on blade. In a 1050 px enlargement it spans 240 px axially over ±190 px at a 470 px tip radius. That is a helix arc
of about 48° and a pitch of about 1.93 diameters.

**Changes:**
- **Blades:** four at quarter turns.
- **Pitch:** 6.95 m on the 3.60 m screw (was 3.75 m).
- **Blade edges:** set by helix angle, measured from Brown's face-on blade:
  - the leading edge runs from −0.12 to −0.31 rad;
  - the trailing edge runs from 0.28 to 0.58 rad;
  - each blade spans at most 51°, leaving at least 39° between neighbours.

  The face-on widths match his to within a few pixels: 70 against 67 px near the root, 115 against 118 px at 0.7 R.
- **Handedness:** the presentation mirrors the model in depth, so the screw is left-handed as Brown draws it. The
  recorded kinematics and thrust are those of the unmirrored model.
- **Physics text:** the representative physics keeps J=0.75, K_T and K_Q, so the axial slip is now 0.61. The text is
  disclosed.

`after/rv/488-default.png` shows the edge-on front blade rising to the right and the back blade's tips peeping out.

- **Intersections:** a single rigid body. By construction the blades stand clear of each other, the collar and the
  sleeve.
- **Faces:** clean.
- **Result:** fixed.

**Note for integration:** the rotor and hub role names now say "four". `display-profiles` still names the old
`single-rigid-two-blade-…` part and should be re-measured. The catalog archetype string is unchanged.

## 351 gravity stamp (`authored-stamps.js`)

- **Change:** the top collar now overhangs the pinion side by 0.30 of the rod's width, out to the rack teeth's tips. The
  plain side keeps 0.6. Brown overhangs 0.6 and 0.78.
- **Why the pinion side stops there:** at the lowered rest the collar is level with the pinion's blank root disk, not
  with its teeth. Screened overhangs:

  | Overhang (rod widths) | Result |
  |---|---|
  | 0.30 | clear |
  | 0.34 | root disk × collar 0.017 |
  | 0.40 | root disk × collar 0.074 |
  | 0.78 (Brown's) | root disk × collar 0.25 |

  The new test samples 1025 poses. The collar clears the root disk at every pose. No pinion tooth vertex enters it.
- **353:** its tests still pass.
- **Result:** improved. The pinion-side overhang is shorter than Brown's.

## Forced, unchanged

- **500 (rotation overlap).**
  - **Extents:** the face gauge spans x ±3.45 and z −1.15 to 0.82. The half-gauge section spans x 5.31 to 8.91 and z
    −3.38 to 0.52.
  - **Why no placement works:** for rotations of +60° and −60°, the two projected clearances add to the default-view
    separation. Clearing both therefore needs a centre separation at least the sum of both figures' projected widths.
    - For the half-gauge section, that is a gap of about 7.3. The gap is now 1.86, and the plate's is about 0.2.
    - Even a zero-depth section slice would have to lie entirely within z −0.26 to −0.075 at the present gap.
    - A slab section about 1.6 deep, with a gap of about 3.4, would clear both. It would read as a cut sheet in rotated
      views, and it would clip the pointer twice, so it was not adopted.
  - **Camera:** moving the camera or shifting the section in depth only trades overlap from one side to the other.
- **358 (lower bar and band).**
  - **Lower bar:** at Brown's lower-bar offset (0.60–0.83, with a fusee large radius of 0.86), the fusee reaches 0.62
    below the axis. The wheel-frame bars that carry the side bars end 0.50 below it.
    - Clearing the fusee would detach the bar from the frame, needing an undrawn spacer.
    - Clearing the crank's 1.3 sweep would put its top 1.17 below the axis, under the wheels' rolling plane at 1.02.
  - **Band:** both cords share one groove turn of pitch 0.152, and the groove floor is 0.136 wide. The cord radius is
    therefore capped near 0.034. The present value is 0.030, against Brown's about 0.054.
  - A double-start groove would double the lead and spoil the 10-turn traverse.
- **370 (mirror height).**
  - **Axle travel:** the axle travels 1.44 vertically, from −1.25 to 0.19. That is twice the 0.72 crank radius, which is
    Brown's 84 px.
  - **Brown's inconsistency:** in his pose the axle is 2.03 below the upper rail's centre and 0.61 above the lower rail's
    top. At the bottom of the stroke his own axle would therefore pass about 0.9 through the lower rail.
  - **Alternatives:**
    - Putting the rail behind the mirror would make the guide pins limit the mirror's bottom edge instead of its axle.
      That is worse.
    - Any split between mirror height and rail height leaves the same error, shared between the two.

## Checks

- **Tests:** 106 pass and 0 fail. The files run were:
  - `movement-440`, `water-mechanism-439-440-444-solids`, `reviewed-cycle-timing`;
  - `movement-457`, `movement-458`, `well-bucket-interfaces`;
  - `movement-488`, `marine-rotor-working-solids`, `marine-parallel-solids`;
  - `movement-351`, `stamp-trip-working-parts`, `movement-353`, `source-presentation`.
- **Tests rewritten** because they pinned the old design:
  - 457: the vertical-rope and phase tests, and the tipped-wedge height bound.
  - 458: the phase fractions, the cycle period, the tangent x, and the finite-difference angles moved onto the rope
    strokes.
  - 488: two blades.
  - 351: the swept tip-circle test is replaced by a time-resolved root-disk and tooth test.
- **New tests:** the aside-draw clearances and landing outside the kerb (457), the rope-length conservation while drawn
  aside (458), and the blade gap and pitch ratio (488).
- **Loop seams:** `check-loop-seams --ids=440,457,458,500,488,358,351,370` reports 0 seams and 0 mid-cycle pops.
- **Faces:** 488 is clean. 457, 458 and 440 carry only pre-existing same-look pairs.
