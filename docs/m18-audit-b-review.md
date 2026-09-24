# Lane m18-audit-b review (pass 52 audit follow-up)

Scope: 142, 148, 159, 198, 252. These rows were rated reasonable, but a fresh
audit (`/dev/shm/audit52/b`) found a visible problem in each. Captures: production
route, default camera, eight phases per cycle (`/dev/shm/m18/a2`, `a3`), each
checked beside its engraving.

## 198: framing of the swept mechanism

- Problem: the camera fitted only the source pose. The rack has to pass its whole
  straight length across the fixed pinion, so for about half the cycle the frame,
  rack and upper rod left the view on the left. Brown does not crop them.
- Fix (`authored-gears-core.js`, `fixedPinionLiftedMangleRack`):
  `cameraFitBounds` is now the full-cycle swept visible bounds plus 0.07,
  replacing the source-pose box. The travel is left as it is, because the
  plate's endless rack needs a full-length stroke.
- Result: every phase is fully in view. The worst sampled NDC is 0.86.
- Test: `tests/mangle-rack-working-contact.test.mjs` now requires every visible
  vertex of 198 to stay inside `cameraFitBounds` for the whole cycle (197 still
  checks only the source pose).

## 148: groove kept inside the toothed rim

- Problem: the traced groove centre line reaches 133 px at its lower-right lobe.
  With its 11 px wall, that lobe ran over the rim's inner edge (130 px) as the
  gear turned.
- Fix (`geared-crank-source.js`): the traced radius is unchanged below a 90 px
  knee. Above the knee a C1, monotone quadratic ease brings the lobe down to a
  115 px crest. The drawn pin position (62 px) and the inner run of the groove
  are exact as before. In `geared-crank-frame.js` the band half-width goes from
  11 px to 9.5 px. The outer wall now tops out at about 124.5 px, a visible gap
  inside the rim in every phase.
- Cost: the lever's rocking range falls from 0.364 rad to 0.278 rad. The pin
  still runs once round the groove per turn with no lever jumps.
- Tests: in `tests/geared-crank-frame.test.mjs` the rocking threshold goes from
  0.3 to 0.26 (legitimate: the groove is smaller), and a new check keeps the
  outer wall more than 0.12 inside the rim's bore.
- Validation regenerated: 148-assembly and 148-frame-assembly (0 failing pairs)
  and 148-complete-teeth (0 overlap). `148-rocking-frame.json` covers an old,
  rejected through-shaft hypothesis. Its fingerprints were already stale before
  this lane, and its script targets a part that no longer exists, so it was not
  rerun.

## 142: traverse output framed

- Problem: the view was cropped at the plate's lower edge, so the connecting
  rod's lower end and the slider on the guide never showed.
- Fix (`baked/silk-traverse.js`, runtime wrapper only, no asset change): the fit
  is the full-cycle union of every visible part (disk, gears, the full rod, the
  slider and the guide rail and bridges). `cameraDistanceScale` changes from 1.18
  to 1.02 and `presentedCrop` is set to null.
- Result: the rod and slider are visible throughout (worst NDC 0.87). The disk
  is smaller in the view, because the 3.7-unit rod and its roughly 3.7-unit
  slider travel are part of the subject.
- Test: `tests/silk-traverse-model.test.mjs` now requires the whole assembly to
  stay inside the fit bounds.

## 159: slack cord without the J-loop

- Problem: the slack illustration placed its Bezier control below and to the
  right of the eye. From about 0.05 to 0.45 of the cycle, the cord dropped
  through the resting treadle bar and hooked back up to its eye.
- Fix (`mujoco-cord-treadle/ideal-cord-shape.js`): the outgoing run is now the
  straight pulley-to-eye line plus a lateral bulge
  `A * 16 t^2 (1-t)^2` along its right-hand normal, away from the incoming run.
  The bulge has zero slope at both ends, so the cord still leaves the pulley
  tangentially and reaches the eye along the straight cord's line. The
  amplitude is still solved from the conserved cord length (length error below
  1e-12). The largest bulge is 1.76 units, at the peak slack of 1.23.
- Rebaked `159.json.gz` and its provenance with `scripts/bake-cord-treadle.mjs`.
  The MuJoCo motion is unchanged. Only the amplitude channel and bounds changed.
  Regenerated `docs/validation/159-ideal-shape.json`.
- Test: `tests/cord-treadle-ideal-shape.test.mjs` used to assert that the cord
  dips below the eye, which was the defect. It now asserts that the cord stays
  more than 0.09 above the resting bar's line away from the eye, and never below
  the eye.
- Visual: while the treadle rests, the slack cord reads as a loose S-shaped bow
  to the right. It is taut and straight, as on the plate, for the rest of the
  cycle.

## 252: D kept below slot C

- Problem: the official animation lifts D the whole 6-unit slot length. That
  carries the crossbar into slot C, between and behind the rollers.
- Fix (`authored-crossed-slots.js`): the slot length and slope stay the same
  (the 2.797846/6 roller-to-D ratio is exact). D's stroke is reduced to 3.6, and
  the rollers now travel 1.68 each instead of 2.80. At the top of the stroke the
  crossbar is 0.825 model units (0.56 world units) below the roller flanges.
- Test: a new test in `tests/movement-252.test.mjs` keeps the crossbar, web and
  input block more than 0.6 below the roller flanges and the lower rail
  throughout.
- Recorded difference: the travel is shorter than the official animation's
  endpoints. Brown's plate does not give a stroke.

## Other regenerated validation

The following reports fingerprint `authored-gears-core.js` and were current
before this lane, so they were regenerated. All results are unchanged except the
fingerprints:

- `191-196-201-contact`: 0 overlap.
- `200-226-bevel-solids`
- `202-264-worm-solids` (POSES=33, as before): 0 penetrations.

## Intersection screens (`show-body-intersections --spacing=0.01 --samples=129`)

- 198: no solid pairs, before or after.
- 252: 0.0050 arm/front-flange before and after. That is half the grid
  spacing, at the pin's axial running face, so it is sampling noise rather than
  a real overlap.
- 142, 148 and 159: the screen loads the older synchronous registry models,
  not the production routes, so it does not cover these changes. Production
  coverage:
  - 148: its assembly scripts (0 failing pairs).
  - 142: its geometry is unchanged.
  - 159: the cord-to-bar clearance test.

## Integration note (lead)

The 142 re-framing was reverted: Brown breaks the rod off below the disk, so the plate crop is correct, and fitting the whole rod made the disk small.
