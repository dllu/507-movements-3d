# Wave-4 lane w4d-401-507 review

Pass-51 wave-4 re-audit items for 408–506. Every item was checked in a fresh
production-route capture (`scripts/review-movement-source-views.mjs`, render
left, engraving right) before and after the change. Intersections were
screened with `scripts/show-body-intersections.mjs ID --spacing=0.01
--samples=129`.

## 408 centrolinead

- Added Brown's inset as a static ink drawing beside the instrument
  (`addPlateConstructionInset` in `src/simulation/authored-centrolineads.js`):
  the construction circle, the three dashed rays from its vanishing point
  through the pins and joint, the dashed pin chord, and the two solid working
  lines meeting at the joint. It does not move and is placed behind the
  instrument layers.
- The white joint, clamp and pin index dots and the white blade graduations are
  hidden (Brown draws none).
- Intersections: sampled clear (2 bodies, no pairs).

## 409 proportional compasses

- The leg graduations Brown engraves are now ink-dark instead of white; the
  white pivot index dot is hidden.

## 412 capstan wheel-work

- The white rotation stripes on the sun and the three planets and the white
  annulus index are hidden.

## 468 flexible water main

- The default view was an oblique close-up of the whole crossing. Brown draws
  two figures of one joint: a sectional elevation, flexed, above a plan. The
  factory now builds exactly that: one rigid two-frame joint assembly
  (`buildPlateJointFigure`) drawn twice, face-on, with the elevation above and
  the same assembly turned into plan below. The downstream frame carries the
  spherical socket (opaque now) and the transverse trunnion pin through the
  ball centre; the upstream frame carries the hollow ball, collared mouth,
  paired logs, cross tie, pipe strap and upright hinge straps and swings about
  the pin.
- Working motion: both figures take the front 18-inch main's middle-joint
  deflection from the unchanged analytic crossing (`figureDeflectionAtTime`,
  started at the installed source phase 0.61, so the default pose is the 23°
  flexed elevation Brown draws). The crossing, banks, winches and river strips
  stay in the model as the hidden motion source, so its tests and kinematics
  are unchanged.
- `src/data/source-presentation.js` 468: camera face-on, the removal entry
  dropped (the river strips are hidden with the crossing) so the authored fit
  is not intersected with the stale display-profile bounds.
- Intersections: the visible figures are sampled clear (3 bodies, no pairs);
  the hidden crossing's winch/cable coaxial fits are no longer drawn.
- Follow-up for the integrator: `src/data/display-profiles.*` 468 still records
  the crossing's motion bounds and the winch rotor as the fastest part; it
  needs re-measuring.

## 502, 504 epicyclic trains (framing), 506 camera

- 502: the default fit crops to Brown's upright carrier pose (B over F over
  A/D); the carrier's full turn is kept as `sweptBounds` (and as the sampled
  motion bounds). The undrawn white carrier speed index is hidden.
- 504: the default fit crops to the arm at rest along +x from A's pedestal to
  end D; the full turn is kept as `sweptBounds`.
- 506: a 12° field and a nearly level direction replace the raised camera.
- Tests: 502 and 504 now check that `sweptBounds` contains the full sweep and
  that the crop contains the pose.
- Validation fingerprints refreshed: `503-504-contact-solids.json` and
  `412-495-gear-solids.json` were regenerated (results unchanged);
  `502-505-gear-solids.json` and `506-507-gear-solids.json` have no test and
  their generator no longer writes their `sources` block, so only their
  hashes were updated (the changes are camera and visibility only).

## 417–428 engines (sub-lane A)

- 417: head A rebuilt as a thick tapered turned block (washer, collar, boss for
  rod B) on a lengthened bent journal; hidden hourglass bore clears the ±16.4°
  journal tilt. Worst depth 0.063 → 0.008 (seated lower ball).
- 418: presentation removes the second (grey foundation) slab.
- 419, 420, 422: white pins/tips/anchors recoloured; 420 pedestal moved behind
  the swinging hammer (0.06 overlaps gone); 422 translucent sector back removed.
- 421: opaque cylinder/trunk walls, translucent steam indicators removed, Brown's
  dotted crank-pin circle added; crankshaft turns with the crank (0.119 → clear).
- 423: translucent fans and disc removed, dotted circle for D; crank, wrist
  bearings and valve spindle moved clear (0.279 → clear).
- 426: cycle starts at Brown's upright pose, where vanes A reach the casing
  wall; the slab is replaced by a cast foot (new helper
  `src/simulation/rotary-engine-cast-feet.js`, used only by 426–428).
- 427: cast foot for the slab. 428: filleted port necks with through passages,
  cast foot, shaft B turns with its arms (0.269 → clear).

## 436–465 water raising (sub-lane B)

- New helper `src/simulation/ruled-water-lines.js` (used only by these IDs)
  draws water as thin ruled strokes classed as fluid.
- 436: overhead beam becomes the flat top cover, base disc a cranked bridge for
  step c, plank inlet a broad chute; tailwater disc hidden.
- 439: floating black anvil cone hidden (kept for the strike law).
- 440: near side-on camera, stop blocks hidden, open plank frame, wedge trough.
- 441: ruled water lines, trip pin and bearing rings hidden, outer rim added.
- 442: stream box replaced by ruled lines, closer framing (0.275 → clear).
- 443: post, bridges and collars hidden, top-stub bracket, solid paddle disc,
  ruled water.
- 461: slab replaced by ruled lines; slimmer gutters.
- 463: water blocks hidden (kept as level-state carriers), ruled head and tail
  water, thin channel bed.
- 465: starts at the engraved diagonal pose; slab replaced by two banks; ruled
  reservoir water.
- Residuals: 436 case squatter than Brown's; 443's paddle disc still reads as a
  ring of boards round a small hub; 461 lattice upright where Brown tilts it;
  465 banks are plain blocks and no operator figure.

## 447–500 pumps, paddles, gauges (sub-lane C)

- 447: white current arrows, bow arc, wake and tiller ball removed; one dark
  feathered current arrow added (0.239 → 0.098, intended rope ties).
- 449: white beads and rod-top ball removed (448 untouched).
- 455, 456: Brown draws flow arrows, so the white arrows are recoloured black
  (not removed); the undrawn-legs claim was stale.
- 477: open square frame replaced by a half-cut flanged cast casing with cut
  pipes A and B; valve D's shape still differs from Brown's tube and dished foot.
- 487, 489, 497: arrows, beads and white indices removed via presentation;
  489 framed on the drawn parts.
- 499: dial no longer receives shadows (ghost removed); pinion journal
  shortened (coaxial pairs gone).
- 500: Brown's right-hand section figure added, animated by the same pressure.

## Display profiles

`src/data/display-profiles.*` are stale for 436, 440–443, 447, 449, 461, 463,
465, 468, 477, 487, 489, 497 and 500. They need re-measuring by the
integrator (this lane did not run `measure-display-profiles.mjs`).
