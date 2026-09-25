# Pass 58: shared rotation cue for featureless turning parts (lane p58-indicator)

## Problem

Removing Brown-absent marks (black rims, white stripes, index blocks and dots)
left smooth pulleys, drums, rollers, discs and cone/stepped pulleys with no cue
to how fast, or whether, they turn. The old marks were inconsistent (tread
patches, face bars, cone stripes, painted teeth, dots), so they are not
restored.

## Design

One helper, `src/simulation/rotation-indicator.js`, used everywhere:

- **Rule.** The body's surface is divided into four quadrants about its spin
  axis; the odd quadrants (x·y > 0 in the spin frame) take a slightly shifted
  tone of the part's own colour. In display (sRGB) space the shifted tone is
  `base × (1 − 0.2)` when the base luminance is at least 0.26, otherwise
  `base + (1 − base) × 0.16` (dark parts shift lighter). Driver red, driven
  blue, brass, grey and white-grey therefore darken by a fifth; ink hubs and
  shafts lighten a little. The four quadrant boundaries (the planes x = 0 and
  y = 0 through the axis) are also drawn as crisp lines about 1.5 px wide
  with twice the shift: radial lines on end faces, straight axial lines along
  treads, so a pulley seen edge-on shows lines sweeping across its tread.
  The same strength (`ROTATION_INDICATOR_STRENGTH` 0.22), line rule and
  threshold apply to every movement and to faces and treads alike.
- **Implementation.** A colour-only material patch (`onBeforeCompile` after
  `color_fragment`), evaluated per fragment from the mesh's own geometry-space
  position through a fixed geometry-to-spin-frame matrix. It turns with the
  part, adds no meshes (nothing to z-fight or intersect), changes no geometry
  or normals (flat faces shade flat; compatible with the p58-normals lane),
  and uses a one-pixel `fwidth` edge so the sector boundaries are crisp but
  not aliased. One shader program serves all patched materials. Patched
  materials are per mesh; later material clones (cutaways, clipping) keep the
  cue.
- **Any angle.** The quadrants cover end faces, treads, flanges, bores and
  hubs alike: face-on the four sectors turn; edge-on the sector boundaries
  sweep across the tread; from an oblique view both show.
- **Spin axis.** Either explicit (`axis`, or `frame`: an ancestor such as a
  `makePulley` rotor whose local Z is the spin axis), or `axis: 'auto'`: of
  the geometry's X/Y/Z axes through its bounding-box centre, the one about
  which surface normals have the least tangential component. Auto skips
  meshes that are not solids of revolution (score > 0.035: boxes, spokes,
  hex heads), so it can be applied to a whole rotor safely.
- **Scope rule.** Only featureless turning bodies take the cue. Parts whose
  turning already shows (teeth, spokes, arms, cams of obvious shape, threads,
  worms, spiral grooves, crank pins, eccentrics, carried planets) get none.
  Thin shafts and pins are left plain.

### Integration points

- `makePulley`: sheaves with `spokes: 0` (solid drums and bored sheaves) take
  the cue on tread and hub by default; spoked pulleys do not. Opt in/out with
  `rotationIndicator`. The old white tread patch and face bars are no longer
  built (`userData.faceIndicators` is now empty; the hidden ink-rim
  placeholders stay so child indices are unchanged).
- `makeSteppedPulley`, `makeConePulley`: every step / the cone body take the
  cue (`rotationIndicator: false` to opt out); their white stripes are gone.
- `src/data/rotation-indicators.js` + `applySourcePresentation`: per-movement
  role patterns for factory-built bodies, applied with the auto axis (one
  entry gives a ball an explicit axis). This avoids editing ~40 factory files
  that other lanes are changing, and matches the production route (live
  MuJoCo and baked models are matched by the part names their visuals use).
- Direct factory calls: 28, 32, 45, 46 (`authored-gears-core.js`, parts have
  no roles), 60 (`dual-belt-speeds.js`), 374 (`reciprocating-cord-working-parts.js`).
- Presentation (`hidePulleyIndexMarks`) now also hides the white index blocks
  the shared gear builders put on their rotors (Brown draws none); it hid the
  pulley marks already.

## Inventory method

A scratch script loaded every movement through the production loader
(`model-loader.js`; live MuJoCo for 82–126 and baked bundles for 123–182),
sampled five phases, found nodes whose local rotation changes about a fixed
axis, and classed each such rigid body as featureless when at least 97% of
its visible surface area has normals with |n·t| ≤ 0.25 about that axis
(t the tangential direction), with radius at least 3% of the model's size.
This separates plain drums and sheaves from gears, spokes, cams and threads
(a first nearest-neighbour test could not tell fine teeth from a smooth rim).
Candidates were then judged by eye from default and rotated captures.
Translating (rolling) bodies were checked separately; none featureless
qualified except parts with visible pins.

## Movements that carry the cue

- Through `makePulley` / stepped / cone builders (automatic): 3, 4, 5, 7, 8,
  9, 10, 12, 14–22, 28 (roller), 199, 243; also deferred 11, 13, 23, 201
  (listed below — no files of theirs were edited).
- Through `src/data/rotation-indicators.js`: 58, 59, 62, 82, 88, 117, 124,
  126, 129, 134, 137, 139, 149, 150, 154, 159, 160, 162, 163, 165, 198, 204,
  242, 244, 251, 253, 255, 256, 257, 258, 261, 262, 263, 265, 268, 270, 271,
  282, 320, 334, 355, 356, 359, 360, 365, 368, 375, 383, 388, 439, 472, 479,
  496.
- Direct factory calls: 28 (disk), 32, 45, 46, 60, 374.

Not given the cue by rule (turning already visible): 1, 2 and every other
spoked pulley; gears, worms and screws (e.g. 24–27, 30, 31, 34, 44, 64, 66,
102, 111, 202, 207, 275); discs with slots, spirals, pins or crank wrists
(29, 94, 98, 121, 142, 354, 361); oblique/eccentric discs (95, 171, 262/263
cone); the beveled wave cam 272; 390's pawl-carrying pulleys.

## Leftover marks removed

- `makePulley` tread patch and face bars; stepped-pulley face stripes; the
  cone-pulley surface stripe (all were already hidden by presentation or the
  belt factory, now not built).
- 374: the added `white-face-spin-index` (and its `remove` entry).
- 368, 371 (shared gear face index blocks, now hidden by presentation).
- 462: the white-painted chain-wheel spoke and the white working faces copied
  from it (`authored-chain-pumps.js`).
- 469: the white index tooth on the temperature bevels
  (`temperature-bevel-pair.js`) and the gear face blocks.
- 411: the white dot at the pendulum axis (`remove` entry).

Remaining white parts found by a scan of every presented movement are parts
Brown draws light (pins, washers, caps, valves, thread ends) or vertex-coloured
bodies, not rotation marks; 306's pallet-screw slots are white strips on
screw heads (not a rotation cue; left for review).

## Deferred IDs (p57 / p58-misc lanes own them; not edited)

Need the cue (suggested `rotation-indicators.js` entries):

- 47: two plain turned bodies (unnamed parts; needs roles or a factory call).
- 61: `['driverDrum', 'loosePulley', 'carrierPulley']`.
- 113 (MuJoCo): `['leftRoller', 'rightRoller']`.
- 153 (baked): `['body:leftGuide', 'body:rightGuide']`.
- 393: `['convex-outer-shell-of-polishing-cup', 'socket-ring-free-to-turn-about-ball-joint-axis']`.
- 415: `['single-smooth-internal-friction-rim-of-wheel-D', 'wheel-D-hub-fast-with-smooth-rim']`.
- 428: `['working-roller-A-[123]']`.
- 490: `['(upper|lower)-guide-sheave-(body|rope-groove)']`.

Already carry the cue through the shared `makePulley` change (no edits to
their files): 11, 13, 23, 201. 2 has spoked pulleys (no cue by rule). 500:
no featureless turning body found. Other deferred IDs have no featureless
turning bodies (99 spiral guide, 106 barrel-cam groove, 64 worm have visible
features). 110: the threaded roller's plain centre core and thrust collars now
carry the cue from the factory (`applyRotationIndicator` in
`authored-screws.js`), replacing its white roller index.

## Verification

Follow-up (edge-on legibility): the first version (strength 0.2, tone only)
read weakly on the side-on treads of 8, 9 and 10, where lighting gradients
mask a 20% tone step. The boundaries are now crisp lines and the strength is
0.22. Note also that the first 9/10 strips were invalid: those factories
integrate spin from the frame delta, so phase-only captures showed no turning.
New strips step the model at 60 Hz (`update(t, 1/60)`) and capture every
0.25 s from t = 4 s in the default views of 8, 9, 10, 3, 4, 7, 12 and 60. In
all eight, the tread lines and bands visibly move from frame to frame, the
cone and stepped pairs show their different rates, and the face lines stay
fine and quiet.

- Prototype captures (default, rotated ±, top, and 6-frame motion strips) of
  1, 2, 8, 9, 10, 60: the stepped (8) and cone (9, 10) pulleys and 60's fast
  and loose pulleys show their different rates; 60's idle loose pulley's
  quadrants stay still while the fast pulley's turn. The cue is quiet in the
  default views and legible when rotated.
- Fresh captures (restarted non-watching server) of every movement listed
  above, default and two rotated views; the white-mark scan was rerun after
  the removals (368, 371, 462, 469 clean).
- Tests: new `tests/rotation-indicator.test.mjs` (patch, frames, auto axis,
  builders, clone survival, and every data entry matching a production part);
  132 suites touching the shared builders, belts, gears, presentation and
  loader (1085 tests: all pass after updating two pins that expected the old
  face marks: models.test.mjs movement 2 and movement-479; the one other
  failure, movement 110's white roller index in models.test.mjs, comes from
  the concurrent half-nut edits, not this lane); plus the chain, friction,
  fusee, 368/371/374/411/462/469 and special-worm suites (pass).
- `docs/validation/202-264-worm-solids.json` regenerated
  (`scripts/review-special-worm-solids.mjs`; results unchanged, fingerprint
  of `authored-gears-core.js` updated). Other reports fingerprinting
  `primitives.js` were already stale at HEAD for other sources, except
  `148-teeth.json` (no test checks it) and 164/166–170/178 (stale through
  other lanes' files too); they need regenerating once the shared-builder
  lanes (this one and p58-normals) are integrated.

## Limits

- The cue is a shader patch: renderers other than three.js's standard
  materials (none in production) would not show it. Materials created after
  presentation by copying, not cloning, would lose it.
- Auto axis assumes the geometry's axis of revolution is one of its own
  X/Y/Z axes (true for every listed part); a sphere needs an explicit axis.
