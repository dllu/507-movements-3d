# Pass 64, lane p64-fix-c1: undrawn supports removed

Reviewer: Claude Opus 5.5 (lane p64-fix-c1), 2026-09-26.

Scope: 376, 377, 388, 390, 392, 397, 398, 420, 430, 431, 432, 439, 441, 459,
462, 479, 491 and 498. Each was checked against `public/engravings/mm_NNN.png`
in fresh captures (default, half-cycle, +60 deg, -70 deg, back, top and two
seam phases; scratch under `/dev/shm/p64-fix-c1/views`, tiles in `tiles/`).
This pass overrules some "keep" decisions in `docs/p60-supports-review.md`
(373/376/377, 398, 441/462/491 and 498). If Brown does not draw a support, it
is removed. Shafts and axles end as short plain stubs, as in 125.

## Changes

| ID | Removed (undrawn) | Kept (drawn or needed) | How |
|---|---|---|---|
| 376 | rear bearing, standard, overhung arm, base rail (front set was already gone) | wheel, lattice, horse; axle ends as stubs either side of the cage | presentation `remove` |
| 377 | far rail post and its foot | A-frame standard and plank, diagonal side plank, short bracket joining the rail to the plank top. The rail is now a capped solid rod running straight past the drum end | factory `authored-person-treadmills.js` |
| 388 | bearing frame (standard, bearing blocks, foot) | rollers, board; shafts end as stubs | presentation |
| 390 | whole frame: upright, foot, side posts | piece A, fulcrum pin a (stub), flywheel, bands | presentation |
| 392 | rear guide standards, cheek joins, spring riser, bracket arm and stud, crank standard and journal | upper and lower guide cheeks, table, spring with its drawn right-hand clamp boss, crank wheel | presentation |
| 397 | rear standards, table-guide channel and bracket, crank bearing boss | rocker on its grounded foot lug and short sill (Brown hatches ground there), crank, link, table bar | presentation |
| 398 | rear frame plate with two legs and feet, guide brackets, long journals | cam, crosshead guide bars (drawn fixed parts), output disc; 0.30 shaft stubs | factory `authored-cam-rocking-drives.js` |
| 420 | bell gallows: post, foot, overhead arm, hanger pin | hammer on its bracket, plank, spring, bell with canon loop | presentation |
| 430 | far bearing pedestal and its footing | pit, breast, headrace; shaft stub | presentation |
| 431 | both bearing pedestals, bearings, front footing | sluice frame, race bed (Brown's hatched river bed), water | presentation |
| 432 | both bearing pedestals and bearings | breast, sluice, race foundation (see residuals) | presentation |
| 439 | gallows beam and post, pulley hanger, ground slab, striking anvil, spout post | pulley on a short shaft stub, rope, bucket with valve, counterweight, spout, falling water | presentation |
| 441 | inclined bearing standards, front and rear bearing rings | wheel, hollow shaft, buckets, stream | presentation |
| 459 | dark bar joining the two chain-wheel axles behind them | central tappet stand (Brown draws the centre post), well curbs | factory `authored-reciprocating-well-lifts.js` |
| 462 | two-post frame with cross beams | chain wheels on axle stubs, chain, pipe, spout, reservoir | presentation |
| 479 | two tall pulley posts | pulleys on axle stubs, bands, weights, bell, tank | presentation |
| 491 | deck pipe (bollard) and the right-angle rope lead over it | capstan, ratchet, deck (now Brown's ground line only, +/-2.5). The cable runs straight 0.6 past its free end and ends with capped strands | factory `authored-capstans.js` |
| 498 | boiler head, shell, far head, two saddle standards, pipe flange | U-tube, mercury, cock, pipe (open clean end), scale strip grooved round the open leg and carried by it | factory branch in `mercury-instrument-parts.js` + presentation |

Updated notes: presentation notes for 376, 388, 390, 392, 397, 398, 420, 430,
431, 432, 441, 462, 479, 491 and 498 now say what is drawn and that the shafts
end as stubs.

## Intersections (after; `show-body-intersections --samples=129`)

The fix only removes parts, except for 377's rail rod and 491's straight lead.
No remaining pair involves an added or changed part. Remaining pairs are older
working contacts and fluid volumes:

- Spacing 0.01, no pairs: 376, 377, 392, 397 and 398.
- 388 has coaxial or deforming contact only: teeth and roller against the
  plank.
- 390 has deforming contact only: bands against their ends and the groove.
- 420 has old solid pairs within the leaf spring and between the spring and
  its pad or heel. It also has cord deforming pairs. None involves the bell or
  its removed support.
- 430, 431, 432, 441 and 462 have fluid or coaxial pairs only: shaft in the
  hub, and water.
- 479 has old rope-lug and socket pairs.
- 498 has fluid pairs only: mercury against the menisci.
- 439, 459 and 491 were run at spacing 0.02, because 0.01 exhausts the 4 GB
  child heap:
  - 439: fluid pairs, plus a solid pair of 0.0000 between the valve disk and
    the bucket bottom (a seat touch).
  - 459: fluid pairs, plus older solid pairs of 0.007 between the worm and the
    star wheels, and 0.001 at the tappet arm.
  - 491: no pairs.

Face scan (`scan-bad-faces --ids=377,398,491,498`) found:

- no inward, shading or mixed faces
- in 491, an older back-to-back overlap between the crown ratchet and the deck
- in 491, z-fighting between the capstan head and its handspike sockets

## Residuals (honest)

- 439: with no ground, the valve still opens at the bottom of the kinematic
  schedule. What strikes it is not drawn, so the opening is a kinematic
  stand-in. The spout is a flat plank, where Brown draws an open trough.
- 498:
  - The scale is a slim ivory strip behind the open leg, grooved round it.
    Brown draws only marks and numerals.
  - Brown's left-hand "0" mark beside the pressure leg is not modelled.
  - The cock is a handwheel valve, where Brown draws a plug cock with a T
    handle.
  - The pipe run is shorter than Brown's.
- 432: the flat race foundation plank is kept as Brown's hatched ground under
  the breast and tail race (the same role as 431's race bed). It stands in for
  sectioned ground, not a support.
- 377: the short box bracket joining the rail to the top of the diagonal plank
  is kept. Brown seems to show the rail passing the plank near its bolt hole.
- 390: fulcrum pin a still projects about 0.5 behind the lever as a stub.
- 397, 398, 459 and 462: drawn fixed guides, cheeks, pipes and wheel axles
  float without a frame, as Brown draws them.

## Tests

The tests below were rewritten because they pinned the old supports:

- `tests/movement-376.test.mjs`: every frame part is detached.
- `tests/movement-388.test.mjs`: the bearing frame is absent.
- `tests/movement-390.test.mjs`: the frame is absent.
- `tests/movement-420.test.mjs`: the bell support is detached.
- `tests/movement-439.test.mjs`: the gallows, ground, anvil and spout post are
  absent.
- `tests/movement-498.test.mjs`: comment only.

Tests run: `movement-{376,377,388,390,392,397,398,420,430,431,432,439,441,459,462,479,480,491,498}` and the shared tests that import these factories or the presentation data:

- source-presentation
- mercury-instrument-working-solids
- capstan-491-finite
- chain-weir-interfaces
- gasometer-working-interfaces
- groove-drive-working-solids
- reciprocating-cord-working-solids
- spring-pivot-family-solids
- treadwheel-working-solids
- treadmill-gait-solids
- water-wheel-430-432-solids
- water-lifting-441-443-solids
- water-mechanism-439-440-444-solids
- well-scoop-gutter-solids
- dual-band-390-contact
- textile-planer-working-parts
- persian-bucket-trip
- alternating-drive-solids
- reviewed-cycle-timing
- rotation-indicator
- mujoco-baked-loops
- movement-489

Result: 298 pass, 1 fail. The failure is in `rotation-indicator`, on
movement 134's reel pattern, which belongs to another lane.
