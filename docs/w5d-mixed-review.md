# Wave-5 lane w5d-mixed review

Lane scope: remaining ledger residuals for 90, 91, 98, 116, 123, 150, 186, 417,
418, 443, 447, 459, 461, 467, 468, 477, 492, 496 and 500. Every changed ID was
captured before and after with `scripts/review-movement-source-views.mjs`
(render beside `public/engravings/mm_NNN.png`) and screened with
`scripts/screen-production-intersections.mjs --spacing=0.01 --samples=129`
(production route: live MuJoCo, baked or authored factory plus source
presentation). Depths below are that screen's worst non-fluid pair, before →
after.

## Changed

- **90** (live MuJoCo). Each rod is split at Brown's broken stub end
  (`source.rodTips`) into a visible stub and a coaxial `rodExtension` piece of
  the same rigid yoke that runs on to the hidden guide; presentation removes
  the extensions with the guides. Total yoke mass is unchanged. Screen 0 → 0.
  The stubs now match the plate's length.
- **91** (live MuJoCo). The stubs are split the same way. At the user's
  request, the outer yoke is no longer the wobbly traced outline. It now has
  straight top and bottom edges and one quadratic bow on each side through
  the traced corners and widest points. The opening keeps the straight rail
  edges, with gently bowed sides just outside the cam-corner sweep and small
  round corners. It contains the swept envelope exactly: the union with the
  envelope adds zero area. The traced outlines stay as
  `profiles.tracedOuter`/`tracedHole`. Screen 0.0003 → 0.0003 (liner/cam
  running contact). All 091 native tests pass.
- **98** (live MuJoCo). At the user's request, the view is from the arm side
  (`camera [0,0,1]`, no mirror). The grooved arm is in front, the disk behind
  it is now opaque, and the section view keeps the arm's cover lifted, so the
  crank pin shows in its groove. This is the native model's own frame, so
  the rotation sense is the plate's and the physics is untouched (all four
  098 native tests pass with unchanged diagnostics). The models.test block
  now expects no presentation mirror. Brown views from the disk side with
  the arm dashed; the arm-in-front view is a deliberate departure. Screen
  0.0001 → 0.0001 (pin/groove working contact).
- **150** (study-only physics; analytic playback). The shaft's viewer-side
  end now stops 0.02 ahead of the carrier hub at its forward limit, so the
  hatched section sits inside the front cam as Brown draws it. It used to
  stand about 0.8 proud and read as an oversized, offset disc. The rear end
  is unchanged. Each cam profile outline was only on the face turned away
  from the viewer, which made the stack read as blurred colour discs.
  Presentation-only copies now outline the viewer-side faces, sunk to stand
  0.008 proud and clear of the lever running in the 0.06 gap. Screen 0 → 0.
  All seven reports that fingerprint `selectable-cam-valve.js` were
  regenerated. The 150-passive-libccd, -libccd-fine, -native-fine and
  -multicontact physics summaries are essentially unchanged (penetration
  4.2e-5, 4.5e-5, 4.4e-5 and 2.8e-4; native-fine improved from 1.07e-4).
  150-passive-assembly and 150-pinned-valve-assembly have 0 failing pairs.
  150-projection-landmarks has one caveat: its "shaft section" landmark reads
  `geometry.parameters.height/2`, which is now a point 0.39 inside the
  unchanged rear end, so the lower RMS figures (16.55 → 12.81 px current
  view) are not comparable. That script should use the shaft's actual
  viewer-side end.
- **443**. The wheel is one plain solid disc in the wheel colour (it was
  ink-dark and read as a hole), with eight thin flat boards (0.56 × 0.40 ×
  0.06) behind it that stand out past the rim. They replace the thick block
  paddles. The undrawn, removed stream-bed slab is thinner so the lowest
  board clears it. Screen 0 → 0.
- **447**. There is no blue river sheet any more: the river volume stays
  hidden for the immersion checks. Each shore is now a band of ruled water
  strokes (six heavy rows at the bank, seven lighter ones toward
  mid-stream), with blank paper between, as Brown draws it. The tan bank
  boxes and their edge bars are gone. Each swivel ball turns with the line
  and has a blind bore to its centre where the rope seats; the rope used to
  run through the solid ball. Screen 0.0982 → 0.
- **459**. The tappet bar is bored for its fixed pivot. The selector arm's
  crank point is now above the pivot and the arm ends on the step's lower
  face; it used to run down through the pivot axle (0.118). The wind-wheel
  shaft turns with the wheel and ends on the coupling block. The lower worm
  shaft starts below the coupling and stops at the worm, with a short stub
  below it in the step's bore. The step ring lies wholly below the worm. The
  white tread index patches on the rope pulleys are removed; Brown draws
  none, and the ropes ran over them. The star pins are shorter (tip +0.040)
  and slimmer (±0.035), so the thread crest no longer grazes them. Screen
  solid 0.1181 → 0.0089 (thread/pin flank, prescribed non-conjugate mesh),
  coaxial 0.1600 → 0.0232 (rope tied to the bucket bail).
- **461**. The serpentine path is sheared by 0.30 across per unit of rise:
  the stages stay horizontal while the elbow columns lean left going up, as
  in the plate. The motion is still the same rigid swing. The back spine is
  sheared to match and still passes through the pivot. Screen 0 → 0.
  The top-left outlet now reaches further left, and the transient jet leaves
  the frame by 7% (maxNdc 1.07), so the display profile needs re-measuring.
- **468**. Both figures now carry Brown's X-marked square cross-tie ends on
  the logs' outer faces and three bolt heads along each log top (the plan's
  holes). Hatching is still not drawn. Screen 0 → 0.
- **477**. Valve D is reshaped to Brown's section: a slender closed stem,
  the collar a a on the unchanged seat cone, a narrow waist at D and a dished
  foot flaring to the diaphragm flange. The broad bell is gone. The
  diaphragm thins to its clamped edge, which sits flush under D's flange,
  and a flat clamp ring replaces the torus rim that overlapped it. The
  working-liquid reservoir is resized to fit the new cavity. Screen coaxial
  0.0724 → 0.0010 (clamped seat).
- **492**. The rope loop through the lower eye is sampled 24 times instead
  of 9, so adjacent straight pieces meet at shallow bends (true corner
  overlap at most r·sinθ ≈ 0.008). The spare hidden pieces are gone. The eye
  graze fell from 0.0101 to 0.0065. The screen's 0.033 "self-overlap" is an
  artefact: it pairs consecutive pieces of one rope and measures depth in
  each piece's unscaled local frame. Direct measurement gives at most 0.0007.
- **500**. The section's cut case walls are drawn light with fine diagonal
  ink hatching, as Brown draws them. The coaxial 0.0648 (ball joint seated
  in its socket) is unchanged and pre-existing.

## Unchanged, with findings

- **116**: square teeth were tried by giving the conjugate rack cutter a 10°
  or 15° flank instead of 20°. The native uniformity test failed both times
  (output speed deviation 0.055 and 0.045 against the 0.04 bound; baseline
  0.03), so the change was reverted.
- **123** (baked): the sector webs are already pierced, with two openings
  between three spokes, so the ledger's "solid webs" is stale. Brown's
  openings reach nearer the rim; enlarging them needs a rebake. The rack
  still leaves the frame at its stroke ends; this is a deliberate plate-size
  crop.
- **186**: handed to the new gab-disengager lane, which owns
  `authored-gab-disengagers.js`. This lane made no edits. The rocker
  shoulder overhang comes from the toe's sampled travel (−1.044 along the
  shoulder), and the thin spring tang needs notch a reshaped.
- **417, 418, 467**: not changed. Rod B's slant follows from the
  offset-journal kinematics; the plate pose would need a different concept or
  a head above the axis. The arc slot droop is exact kinematics. The wider
  base houses the pump.
- **496**: the yarn/package 0.023 is where the live yarn joins the same
  strand wound on the package at the take-up point. The take-up law pins the
  contact to the winding radius, so this is intended continuity. The yarn
  "self" pair is the same consecutive-piece screen artefact as in 492.
