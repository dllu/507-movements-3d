# Pass 73 lane p73-res: fresh attempts at 37, 204, 206, 269, 351, 391, 397, 398, 159

Every ID was compared with `public/engravings/mm_NNN.png` in fresh production-route captures:
the default view (`review-movement-source-views.mjs`) and a tile of four phases, ±60° about
vertical, back and top.

- Before and after tiles: `/dev/shm/p73-res/{before,after}/NNN.jpg` (plate top left);
  source views in `/dev/shm/p73-res/{before,after}/src/`.
- Overlays and phase strips: `ov206n.jpg`, `ov206n-z.png`, `ov206n-zl.png` (plate traced in red
  at the fitted wheel scale), `ph37d.jpg` (silhouette heads, 3×), `ph391.jpg`, `ph159.jpg`.

These are scratch files and are not in Git.

## 206: shared-pivot double-stroke ratchet — fixed

**The real cause.** The display pose was cycle phase 0.25: the rising stroke half done, with
the lever at its mean and the right pawl at the top of its reset swing. At that pose the
right finger stands 0.304 clear of the teeth, at wheel radius 2.68, where Brown's point is
deep in a tooth space at radius 2.17 (166 px). No band shape could fix that; it was the phase.

**Fresh approach: Brown draws the high reversal.** Both of his pawls are seated: the left has
just finished its rising stroke at his left point and the right sits in its space ready for the
falling stroke. The calibration now puts exactly that pose on Brown's lever:

- The high reversal anchor is Brown's drawn pin (338,49)→(257,66); the low anchor is the lever
  turned by twice the amplitude. The rocker's mean is Brown's angle plus the amplitude.
- The left pawl's length is set at the high anchor to Brown's left point, and its rising stroke
  is solved back to the low anchor. The right pawl is seated at the high anchor on tooth −16 and
  its falling stroke is solved to the low anchor. The strokes still sum to one pitch
  (bisection on the amplitude, closure better than 2e-14).
- The display phase is 0.5 (`initialCyclePhase`), so t = 0 is Brown's pose. Canonical times
  were renumbered (source pose = high reversal).
- The right source anchor was re-measured: Brown's right point is (389,195), 39° and 166 px
  from the wheel centre (p72-a's measurement); the old (408,193) was the tip circle.

**Result** (`ov206n.jpg`, `after/206.jpg`). The lever lies on Brown's lever. The right band
now overlaps Brown's band along its whole length, its square end and nose sit in the tooth
space where his do, and the right finger bears at 40.3° (Brown 39°). The left pawl ends on
Brown's left point. Amplitude 5.47° (was 5.21°); rising advance 2.40°, falling 4.39°.

- **Intersections.** Before (p72-a): the two designed 0.0001 nose/tooth contacts. After: see
  Checks.
- **Tests.** `movement-206` rewritten where it pinned the old design: amplitude and advance
  ranges, the left pawl length (now from the high anchor), the right anchor, the source pose
  equal to the high reversal, the bounds width (4.95–5.3; the right pawl no longer swings out
  at t = 0). The exhaustive no-penetration test is unchanged and passes.

**Remaining.** Teeth are 0.33 deep, about twice Brown's (unchanged limit). The left band's
square end stands a little outside Brown's (about 0.1).

## 204: skew hyperboloid rollers — improved (unequal axodes)

**Fresh approach.** Earlier lanes kept equal hyperboloids and traded ellipse width for length.
Re-measuring the plate (2× zoom) shows Brown's two rollers are not equal:

| | Brown | before | after |
|---|---|---|---|
| upper (back) end ellipse width/height | 0.42 | 0.36 | 0.38 |
| lower (front) end ellipse | 0.43–0.49 | 0.36 | 0.43 |
| upper projected length / end diameter | 2.08 | 1.71 | 1.95 |
| lower projected length / end diameter | 1.53 | 1.71 | 1.45 |
| lower / upper end diameter | 1.27 | 1.00 | 1.30 |

Unequal axodes do this exactly. Tangency along the common generator requires
a1/a2 = tan α1/tan α2 and transverse rolling gives |ω2/ω1| = sin α1/sin α2. With equal body
lengths the waist ratios are equal. `authored-gears-core.js` (204 only) now uses α1 = 22.5°
(upper, driver) and α2 = 28.58° from an exact 4:5 speed ratio (shaft angle 51.08°, throats 0.777
and 1.023, end radii 1.537 and 2.022). The common generator spans the driver's end planes.
The loop closes after 2.5 driver turns (2 driven turns), where the half-turn-symmetric
quadrant cue repeats; `minimumDisplayCycleSeconds` equals that period so the rollers keep
their old speed. The camera turns 1.5° toward the driver's end (x 0.35) to balance the ellipses.

- **Why the upper ellipse cannot reach 0.42 too.** The sum of the two axis angles is fixed by
  the ellipse widths (e1 + e2 needs α1 + α2 = asin e1 + asin e2), and each length ratio is
  cos α·√(1−w²)/tan α. The upper roller's 2.08 needs α1 ≈ 18°, the lower's 1.53 needs
  α2 ≈ 28°; α1 = 22.5° splits the upper roller's error between width (−10%) and length (−6%).
- **Tests.** `movement-204` rewritten for unequal axodes: per-axode angles, throat ratio,
  diameter ratio 1.25–1.35, sampled no-common-interior check, exact 4:5 ratio (round-off
  bounds), sliding speed ω1·c·sin α1, closure after five driver turns and the 2.5-turn loop.
  `skew-friction-working-solids` uses the driven speed and the new sliding speed (facet gap
  0.0013, opposition 0.998).
- **Display profile.** The motion bounds in `display-profiles` are stale (the lower roller is
  larger): 204 needs re-measuring.

## 37: conical stud gear — improved

**Fresh approach.** Brown's own silhouette stud (`z37p.png`) is a full circle straddling the
cone's outline, standing about 7 plate px (3.3% of the cone height) beyond it. Ours stood
about 2.3% proud, but as flat-faced side-on blocks, two or three stacked at the outline.

The stud heads are now round buttons: a shallow crown (`conicalStudCrownSag` 0.03 at the rim,
in `conical-stud-geometry.js`) highest on the stud's axis, applied as the minimum with the baked
clearance cut, so it only removes material. At the silhouette the heads read as rounded bumps
like Brown's straddling circle; on the face they read as clean round dots (the cut facets are
gone) (`ph37d.jpg`). The bake key is unchanged (the crown is not a cut parameter).

- **Residual.** Two heads, not one, show at the outline in most phases (stud spacing there is
  smaller than the angle at which a head drops out of view).

## 391: lever C lowered — improved slightly

`ELBOW_PIVOT_RISE` (authored-alternating-weighted-racks.js) sets C's pivot above A1's upper
guide corner; spring d's anchor moves with it. It is now 1.05 (was 1.36): C and d stand 21 px
lower. Brown's pivot is 47 px above the guide top against our 79 px (was 100 px).

Fresh attempts that failed:
- **Brown's proportions for C** (arc radius 2.5, link pin 1.72 below the pivot, link 0.93,
  pivot 0.59 above the corner): the curved arm runs into the lug roller, and at the
  corner the strut pushes A1 *inward* (rack torque −1.66), so the assist fails.
- **Shorter link with the pivot lowered by the same amount** (0.3–0.5): the assist window
  shrinks to 25–30 samples and the spring never loads before the corner.
- **Lower pivot alone:** 1.05 is the lowest at which the spring loads before the corner
  (0.95 fails) and C's swing stays continuous; C now swings about 45° (was 33°).

`weighted-rack-selector-contact` test: the swing range is now 42–48° and the per-sample link
step bound 0.0054 (measured 0.00513; a branch jump would be far larger).

**Residual.** C's pivot still stands about 32 px (0.46) higher than Brown's; lower breaks the
two-force strut's loading and outward push.

## Forced, re-examined

### 269: frame length
The model lays Brown's groups on one contiguous 17-pitch line because upper and lower teeth at
the same frame position would both mesh. Reaching 0.6 pitch into the lower-two group needs the
gear's 3.54-pitch tip radius plus 0.05 running clearance past the stroke end, so the closed end
sits 2.32 pitches past the last tooth (Brown 0.25).
- Ending the stroke inside the upper-seven group (leaving Brown's lower two teeth idle) saves
  only 1.2 pitches (frame about 5% shorter) and drops one of Brown's four alternations.
- A 22-tooth gear would shorten the frame about 7% but adds to the tooth-count error (Brown 18).
- The gear cannot pass the closed end in depth (no depth offsets; the rod leaves the closed end
  in one outline, as drawn).

### 351: pinion-side collar overhang
At the lowered rest the top collar spans y 0.04–0.68 about the pinion axis (0.30). Brown's 0.78
overhang reaches x 0.82, where the pinion's root-radius blank (1.194 about (1.58, 0.30)) spans
y −0.62…1.22. Clearing it needs the collar 1.18 higher (2.6 rack pitches: three idle teeth or
a blank rod length under the collar, where Brown's teeth run up to it), or a blank cut to radius
0.76 (36% under Brown's). Reading the collars as fixed guides was checked and rejected: Brown's
rod ends only 38 px above the top block, so a fixed guide would lose the rod at rest.

### 397: slot upper end
The pin's farthest distance from the rocker pivot is D + r = 173.6 + 93.6 = 267 px; Brown's
slot stops at 238 px. The slot must reach the pin. Closing the 29 px gap needs the crank 31%
shorter (r 64) or its centre 30 px nearer the pivot, each a larger visible change than the
slot end. The slot is concentric with the crank circle for the near-rest, so it must span
the full 180° from D − r to D + r; Brown's 120° slot is inconsistent with his crank.

### 398: crank throw and direction
The roller's stroke equals 2r and the groove's radial range, 0.39–0.77 of the cam radius,
gives r = 0.19 R. Brown's crank is 30 px on an 80 px cam (0.375 R), which would need a groove
range of 0.75 R (valley down near the bore). Brown's roller sits at a lobe tip (maximum d), so
the crank must point away from the cam (32° here); pointing it straight up (half-way to his
135°) turns the cam lobes about 12°, and his 135° about 24°.

### 159: slack cord
Unchanged. A taut cord needs 146 px of cord travel from the treadle eye, 133 px from its pivot:
the treadle would have to swing about 67°, putting the foot 133 px below the floor. The slack
therefore collects as a sag in the diagonal run for about a third of the turn (`ph159.jpg`).
Observation: in the taut part of the turn (phases 0.6–0.8) the lifted treadle's free end rises
across the lower right of the disc, in front of it. This follows from the same geometry
and was not changed.

## Checks

- **Intersections** (`show-body-intersections`, spacing 0.01, 129 samples), after:
  - 37: none (before, p72-a: none).
  - 204: none (before: none).
  - 206: the designed nose/tooth contacts only, ratchet × right pawl 0.0001 and ratchet × left
    pawl 0.0000 (before: the same two 0.0001 contacts).
  - 391: spring d's hooks on their stud and anchor only, 0.0171 / 0.0163 (before 0.017 / 0.016).
  - 269, 351, 397, 398 and 159 were not changed.
- **Faces** (`scan-bad-faces --ids=37,204,206,391`): all four clean.
- **Loop seams** (`check-loop-seams --ids=37,204,206,391,63,71,211,225,235,236,240`): 0 seams,
  0 pops, 0 errors.
- **Source views**: all framed (maximum NDC 37 0.85, 204 0.87, 206 0.95, 391 0.89), no page errors.
- **Tests** (all pass): movement-204, skew-friction-working-solids, movement-206,
  conical-stud-clearance, models.test (movement 37), movement-202 (runtime queue through 204),
  movement-391, weighted-rack-handoff-solids, weighted-rack-selector-contact; shared-file
  checks alternating-pawl-236-contact, carrier-pawl-225-contact, ratchet-stop-240-working-parts,
  movement-063, 071, 195, 201, 202, 203, 205, 207, 208, 211, 215, 216, 225, 235, 236, 240;
  bevel-200-226-solids, irregular-gear-family, special-worm-solids, feed-worm-assembly,
  feed-worm-wheel.
- **Regenerated fingerprinted reports** (authored-gears-core.js changed):
  `review-200-226-bevel-solids` (POSES=33), `review-special-worm-solids` (POSES=33),
  `review-irregular-gear-contact` (JS then Python). Results unchanged apart from hashes.
- **Framing or geometry changed:** 204 (geometry, camera, loop period; display profile's motion
  bounds need re-measuring), 206 (display pose, calibration), 37 (stud heads), 391 (C and d
  lower; camera bounds unchanged).
