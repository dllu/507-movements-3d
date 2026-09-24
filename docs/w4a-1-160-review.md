# Pass-51 wave-4 lane w4a-1-160 review

Scope: the second-audit items for 6–154 listed in the lane brief. Every item was
checked in a fresh production-route capture
(`scripts/review-movement-source-views.mjs`, own non-watching Vite server) before
and after the change. Intersections were screened with
`scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`. That
script builds the synchronous registry model, so for live-MuJoCo and baked IDs
its figures describe the offline model, not production playback.

## Changed

- **37**: the ledger said the stud body was a frustum, but it still read as a
  point. The conical stud gear now has 24 teeth and 20 studs (it had 12 and 10),
  keeping the same mean ratio and cone slope. The finer module shrinks the tooth
  depth, so the stud body's top radius goes from 0.152 to 0.268 and reads as
  Brown's truncated frustum. The studs are thinner and shorter (radius 0.03,
  front 0.12). They still stand proud of the body because they must engage the
  teeth; Brown draws them as flush dots. I reran the clearance cut with
  `scripts/bake-conical-stud-profile.mjs` into `src/data/conical-stud-profile.js`.
  128-pose check: stud/tooth clearance is 0.000186 and tooth/body clearance is
  0.016003. The largest working gap is 0.075, so engagement is still not
  qualified. The intersection screen is clear.
- **136**: the camera is now an exact elevation (0, 0, 15) with a 10° field of
  view, so the cam wheel is seen edge-on. The undrawn shaft pedestal, bearing,
  base rail, brace and feet are hidden but kept for the hardware checks. Added
  what the plate draws: one upright plate carrying the rod, a curved bracket, and
  a hatched ground line.
- **154** (baked, loader presentation only): the merged rear frame is hidden.
  That frame held the base rail, rear posts, pulley gallows and return stop, and
  the recorded motion still uses them. Added the plate's parts: a front disk
  pedestal with a round head, a front bell-crank post with a flared foot, pin
  ends, two thin base plates and hatched ground. The pulley's white index is
  hidden. The camera bounds were extended to include the new parts. The bake,
  bundle and provenance are unchanged.
- **73**: the hatched block was a 6×6 slab; it is now 1.0×1.1, so the full view
  shows only a small corner block. The largest projected extent (max NDC, where
  above 1 means cropped) went from 2.74 to 0.85.
- **86**: `cameraDistanceScale` 6 (the field of view is 8°). The overhead beam
  and left post now have margin. The max NDC of 1.65 comes only from the band
  runs that are clipped at the plate edge.
- **85**: `cameraDistanceScale` 6 gives the top bracket a margin (max NDC 0.92 →
  0.80).
- **106, 107** (live MuJoCo, presentation only): the ceiling header is now pale
  with clipped 45° ink hatching and an inked lower edge
  (`src/simulation/mujoco-barrel-cam/hatched-header.js`). The hatching is child
  meshes, not parts, so masses, contact and the parts count do not change.
- **116** (live MuJoCo, colour only): the front pinion is now plain orange and
  the rear pinion muted grey. Before, the gold pinion and its brass ratchet read
  as one translucent double gear.
- **135**: the undrawn guide rods, shoes, arms, base rail, A-frame supports and
  rear bearing are hidden. The brass rail liners now take the frame colour, so
  they read as the yoke's inner edges.
- **46**: the camera is lower (elevation 17° → 12°) and the ground is hidden.
- **63**: the flat spring leaf now runs just behind the drop, along the tail's
  underside, and ends behind it, so the tail rests on it as in the plate. It
  previously stopped short at the tail tip. The stop pin is Brown's small open
  circle (pale with an inked rim), not a black pellet. The screen is clear.
- **77**: the peg caps are pale with inked rims, like the plate's circles, and
  the pegs cast no shadows. The parts count is unchanged.
- **94** (live MuJoCo, presentation only): a floor ring behind the washer closes
  the through-cut groove, so dark channel shows through the slots instead of
  white gaps. It is a child mesh, not a part.
- **6**: added two sector arms along the underside of the lever. The sector now
  has four arms: two diagonals and two under the bar. The ground is hidden.
- **14, 26, 29, 30**: ground hidden.
- **48**: the feather key is now shaft-coloured and `cameraDistanceScale` is 4
  (the field of view is 11°). The pinion stays above the gear. The plate puts it
  mostly behind the gear, but moving it would change the tested mesh geometry.
- **89**: the rod is clipped in the strap's own frame a short way past the
  flanges, as Brown breaks it off. The kinematic eye and wrist stay in the model.
- **120** (live MuJoCo): the camera goes from (2, 1, 10) to (0.15, 0.1, 10),
  i.e. face-on.
- **132**: the bed below the press is now a low block about 0.42 of the column
  spacing wide, as drawn.
- **145**: the two ground ledges are now a pale ground with an inked line and
  diagonal hatching. `docs/validation/145-assembly.json` was regenerated
  (129 poses, 0 failing pairs). `144-assembly.json` was also regenerated because
  it fingerprints `authored-linkages.js`; its results did not change.
- **153** (baked, presentation only): the undrawn elbow stop (the fixed
  frame-grey mesh under the elbow pivot) is hidden.

## Checked, not changed (documented residuals)

- **31**: I tried thinning the idle flank (tip 0.20 module, lean 0 to 0.04
  module). With the tip below its current 0.34-module width, the idle flank
  crosses onto the loaded side of the section, which
  `tests/worm-drive-contact.test.mjs` rejects: the loaded flank must follow the
  hob trapezoid that cut the baked wheel. I reverted the change. Slimming the
  worm further needs a new hob pressure angle and a rebake of the worm-wheel cut,
  which movement 202 shares.
- **150**: the framing needs `cameraFov` and `cameraDistanceScale` in
  `selectable-cam-valve.js`. Ten `docs/validation/150-*` reports (native,
  libccd, assembly, projection) fingerprint that file and
  `authored-selectable-cams.js`. I tried the change, then reverted it
  byte-for-byte rather than invalidate them. The cam stack still spans the view
  edge to edge. The camera-direction entry alone does not help.
- **107**: groove shape. The caption asks for uniform motion, and the tests pin
  constant-slope flanks with short blended reversals. A sinuous groove would
  change the live motion law, so I kept the zigzag.
- **30**: rounded squares. Rolling pitch curves cannot have sharp corners (they
  would need a cusped conjugate), so the four-lobed rounding stays.
- **74**: the camera is already exactly (0, 0, 10). The top of C shows because
  its teeth sit on a bevel cone.
- **109**: the gear depth comes from source measurements and feeds the live
  masses; the camera is already face-on.
- **125**: the three gear sizes set the live MuJoCo ratios, so I left them.
- **137**: the white stripe is the slot Brown draws in the lower rod.
- **147**: Brown draws a small collar with a pin below the ramp block, so the
  collar stays.
- **87, 101**: the subject is limited by width because the plates are wide
  strips.
- **Framing mechanics**: `display-timing.js` loads the swept bounds from the
  display profiles, and authored fit boxes are intersected with them. Margin can
  therefore only be added through `cameraDistanceScale`, which scales the
  generic sphere distance, so narrow-field views need large values.
