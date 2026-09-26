# Pass 65 lane p65-a: 37, 204, 216, 206, 225, 236

I compared each movement with `public/engravings/mm_NNN.png` in fresh production-route
captures. Each tile shows the default view at four phases, ±60° about vertical, back and top.

- Before and after tiles: `/dev/shm/p65-a/{before,after}/NNN.jpg`.
- Official default and oblique captures: `/dev/shm/p65-a/review/`. The side-by-side sheet is
  `defaults.jpg`.
- Pawl outline plots for 206: `/dev/shm/p65-a/p206.png` and `p206z.png`.

These captures are scratch files and are not in Git.

## 37: conical stud gear

- The toothed cone now has stub teeth. Addendum is 0.45 module, set by the new
  `toothAddendumFactor` parameter through `rackGeneratedOutline`.
- The stud body sits just outside the stub tips, with relief 0.012 (was 0.016).
- The studs are round heads, radius 0.055 (was 0.045), that stand 0.03 past the pitch cone
  (was 0.06). They still enter the tooth spaces, reaching 0.03 inside the toothed pitch
  cone. The clearance cut was rebaked (`scripts/bake-conical-stud-profile.mjs`).
- Measured proudness of the stud heads above the body: mean 0.079 and maximum 0.105.
  Before, it was about 0.15 on average and up to about 0.2 near the narrow end.
- In the default view the studs now read as a row of dots on the cone. Only the one or two
  at the silhouette show as short, low buttons.
- Intersections: none before and none after (2 bodies, 47 meshes).
- **Residual:** at the silhouette the heads stand about 0.08 to 0.1 proud as low buttons,
  where Brown draws dots flush. This is forced: a flush dot cannot enter a tooth space. The
  radial engagement is now about 0.07.

## 204: skew hyperboloid rollers

- Brown's end faces are ellipses about half as wide as they are tall (about 0.45 to 0.55).
- The old 40° crossing, seen through a 36° lens, gave about 0.15, because perspective turned
  the far ends almost edge-on.
- The new geometry and view:
  - shaft angle 50°, so each axis is 25° out of the picture plane;
  - axis offset 1.8 (was 1.3), which keeps the waist about half the end radius;
  - body half-length 3.2;
  - a long lens (`cameraFov` 8);
  - a lower eye point, camera (0, 2.3, 13.2).
- The end-face ratio now measures about 0.37 to 0.38 on both the upper-right and lower-left
  ends.
- Removed the undrawn floating grey bearing rings
  (`(driver|driven)-shaft-stationary-bearing-ring`) through `source-presentation`.
- Tests: the pinned 40° values, the sliding speed (now 0.8216) and the round-off tolerances
  were updated. The facet normal-velocity bound is now 2% of the larger sliding speed.
- Intersections: none before and none after (2 bodies, 12 meshes).
- **Residual:** the ellipses are still a little narrower than Brown's (0.38 against about 0.5),
  and the rollers are a little stubbier.
  - For equal hyperboloid axodes, the projected-length-to-diameter ratio cannot exceed
    cos²α/sin α. At the 30° half-angle that a 0.5 ellipse needs, that limit is 1.5, but Brown
    draws about 1.9.
  - So Brown's proportions are not all consistent with a true hyperboloid pair. The 25° setting
    splits the difference.

## 216: mutilated external/internal gear reverser

- Teeth are now square with parallel flanks.
  - The pinion and the central sector share a constant-width tooth, 0.15 at every radius.
  - The internal ring's tooth is near-parallel: 0.155 at the tip and 0.175 at the root. Before,
    it was 0.084 at the tip and 0.296 at the root.
- Each straight flank uses only its root and tip stations. Collinear intermediate stations had
  left degenerate triangles.
- The four handoff teeth keep the source's lopsided outlines, narrowed to 0.8 of their angular
  width (`transitionWidthScale`).
- The sampled pinion/sector polygon test (`solidInterferenceAtInputAngle`) is clean at 4097
  samples. Wider teeth interfere:
  - with a 0.16 pinion tooth, the central handoff teeth (c0 and c7) interfere;
  - with a ring tip wider than about 0.16, the 3:1 internal mesh interferes;
  - shortening the tooth depth did not help.
- The rear web now uses a paler tint of the member's colour: driver orange blended halfway to
  paper. The orange external sector and the ring teeth now stand out against it.
- The test now checks the square tooth widths. The built transition offsets include the 0.8
  scale.
- Intersections: none before and none after (2 bodies, 54 meshes).
- **Residual:** the teeth are square but slimmer than Brown's, about 38 to 42% of the pitch
  against his roughly 50%. This limit comes from interference in the 3:1 internal mesh and at
  the handoff teeth.

## 206: shared-pivot double-stroke ratchet

- **Root cause:** the model's wheel was about 16% too large for the drawing. It used a tip
  radius of 211 px about (261, 303). The drawn tooth tips span x 77 to 443 and y 121 to 476,
  which gives a tip radius of about 182 about (260, 299). The pawl pin and lever were therefore
  pulled in onto the teeth.
- The source frame is now fitted to the tips: centre (260, 299), radius 182. The lever, the
  common pin and both pawls re-derive from Brown's pixel anchors. The lever swing is 5.2° each
  way (was 6.7°), and each vibration still advances one tooth.
- Each band now rises smoothly from its working end to the pin. The centreline radius follows a
  sine ease, with no kink near the eye, and the bands bow well clear of the teeth as Brown's
  do. The gap at the top is about 0.4.
- The inner edge runs into the nose along a smooth curve instead of a notch, so each end reads
  as the band's own obliquely cut end, not a separate wedge.
- Whole-outline probe (both directions, 400 samples per cycle): the only contacts are the
  designed nose contacts, clearance 0.
- Tests:
  - updated the source-fit constants (182 px, (260, 299)), the amplitude (5.1° to 5.3°), the
    rising and falling advances, the handle travel, the reset step (< 0.0055) and the model size;
  - the right contact sector now matches within 2° (was 0.36°), because the wheel centre moved.
- Intersections: the same two 0.0001 designed nose/tooth contacts before and after (5 bodies).
- **Residual:** the right end is an oblique cut whose inner corner is the rounded nose. It tapers
  a little more than Brown's full-width square end.

## 225: vibrating carrier with one hinged pawl

- The pawl is now one plain circular arc from its hinge to the rounded nose, with sagitta 0.44
  over length 2.64 (`pawlBarSagitta`, `pawlBarArcRadius`). The old Catmull curve dropped into a
  hook near its end.
- The drive law and the nose-riding return law are unchanged.
- Whole-outline probe (4096 samples per cycle): the minimum clearance is 0.00020, the designed
  running gap.
- Other sagittas:
  - an arc of 0.40 or less hits the tooth behind the nose during the return;
  - a 0.36 arc clears only if the return lift is solved on the whole outline, but that cost
    about 50 ms per frame, so I dropped it.
- The plate test now follows the arc and requires the sagitta to stay under 20% of the length,
  so a hook cannot return.
- Intersections: clean before and after (5 bodies, 10 meshes).
- **Residual:** the bar is bowed more than Brown's (sagitta about 17% of the chord against about
  5%), so it meets the wheel more steeply than his nearly straight bar. This is forced: a flatter
  plain bar hits the tooth behind the nose while the pawl drags back.

## 236: alternating pawls b and c

- Removed the grey fixed stud bosses and flanges behind fulcrum a and the wheel arbor.
- Shortened both plain pins to the parts they carry:
  - fulcrum a, z 0.66 to 1.00, through the lever's joint eye;
  - the arbor, z 0.08 to 0.64, through the wheel hub.
- Nothing now reaches back behind the mechanism in rotated, back or top views.
- The test now asserts that no fixed studs remain and that the depth is 0.85 to 1.0.
- Intersections: none before and none after (5 bodies, 14 meshes).

## Checks

- Loop seams (`check-loop-seams.mjs --ids=37,204,206,216,225,236`): 0 seams and 0 pops.
- The source-view review shows all six framed (maximum NDC 0.94) with no page errors.
- Regenerated the fingerprinted reports for `authored-gears-core.js`:
  - 200-226 bevel solids;
  - special worm solids (POSES=33);
  - irregular gear contact (JS and Python);
  - variable-face contact, plus its saved report.
- Face scan (`scan-bad-faces.mjs`):
  - 37, 206 and 225 are clean.
  - 204 has 4 small coplanar overlaps between the end face and the shaft hub (area 0.01, about
    0.009% of the surface). They are unchanged in form from before.
  - 216 has 48 same-look overlaps where the teeth run 0.04 into their root bodies (the pass-64
    design) and where the hub bosses meet the root disks. No degenerate triangles remain.
  - 236 has 3 same-look overlaps, which were already there.
