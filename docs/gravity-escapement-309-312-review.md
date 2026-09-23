# Gravity escapements 309–312: working-solid review

Bounded correction pass over Brown's four gravity escapements: 309 (Mudge),
310 (single three-legged), 311 (double three-legged, Denison) and 312
(Bloxam). The motion laws are unchanged analytic prescriptions (cosine
pendulum, bisection-solved pallet magnitudes, smootherStep wheel steps). The
pass changes the solids that carry those laws and measures whether they
intersect, lock and lift.

## Method

- **Screen:** `node scripts/show-body-intersections.mjs <id>` (65 samples) and
  the fine variant `--spacing=0.01 --samples=257`.
  `scripts/probe-gravity-escapement-intersections.mjs` returns every pair, not
  just the worst forty, and accepts a pre-built model so tests can screen a
  deliberately broken variant.
- **Swept-cut working plates:** `scripts/generate-gravity-escapement-plates.mjs`
  writes `src/simulation/baked/gravity-escapement-plates.js`.
  - Each plate is declared as a blank (bands, discs, polygons, sectors) in its
    owner's frame over a z slab.
  - Offline, the generator subtracts every non-owner, non-plate mesh swept over
    one period, grown by a 0.006 running clearance, and keeps the largest
    connected piece.
  - The browser only extrudes the baked outline.
  - `inputHash` fingerprints the declarations, the other meshes' geometry and
    their world matrices at 24 times, so a stale bake is detected.
  - Plates do not cut one another. Plate-versus-plate contact across bodies is
    therefore checked by the screen, not assumed.
- **Engagement:** `scripts/check-gravity-escapement-engagement.mjs <id>
  phases...` checks that the solids still do their work after the cut.
  - Each model publishes `engagementContacts(state)`, giving the lock and lift
    drivers as a point, a radius and a z range.
  - `engagementAt` advances the driver along its wheel circle and reports the
    first plate it would enter.
  - `contactGapsAt` reports the signed gap from the driver's surface to the
    nearest z-overlapping plate.
- **Diagnostic contact markers** (`live-*`) stay positioned and report
  `userData.active`, but are never rendered (`visible = false`).

## Baseline defects (stock screen, 65 samples)

| Movement | Solid pairs (worst) | Coaxial pairs (worst) | Open meshes | Principal causes |
|---|---|---|---|---|
| 309 | 27 (0.2000) | 12 (0.1900) | 4 | half-forks through wheel hub, bearing and shaft; unbored bearings around arbors; nibs and faces in the teeth; visible markers inside parts; disc weights |
| 310 | 40 (0.2428) | 18 (0.1600) | 10 | stops and faces through legs and pins; unbored hubs; tube arms crossing the wheel slab; markers |
| 311 | 43 (0.0836) | 28 (0.1293) | 8 | curved crossing 3D tube arms instead of Brown's planar diamond; stops through both wheels; unbored bearings; markers |
| 312 | 42 (0.0792) | 38 (0.1443) | 6 | solid bearing cylinders through both arms and the pendulum; stop cylinders and detent tubes through the outer teeth; pallet beams through the small wheel; markers |

Raw baseline output: `/dev/shm/gravity-probe-baseline.txt`. Baseline renders:
`/dev/shm/gravity-review-baseline/`. The fine screen was not run on the
baseline geometry.

## Corrections

**Shared to all four:**
- Bored bearing rings or fixed studs with bored sleeves replace the solid
  bearing cylinders.
- Rotating arbors belong to their rotor, not the frame.
- Every working pallet, stop, lift face and arm body is a baked swept-cut plate
  in an explicit slab.
- Markers are hidden and report `userData.active`.

**309 Mudge:**
- Brown's balls replace the disc weights.
- Each pallet is split into three plates in its own slab:
  - a lift pad offset around the analytic lift locus;
  - a terminal locking nib;
  - an arms plate running from the pivot to the fork and the weight stem.
- A front suspension stud and cock carry the pendulum, clear of the half-forks.
- The wheel arbor turns in bored rings.

**310 single three-legged:**
- Each long inverted arm is one plate: a smooth centripetal Catmull–Rom bow
  (as in the engraving), jaw, tail, lift pad, arc bar and pivot boss.
- Stops D and E are sector blocks in the leg slab.
- Hubs are bored; the fly and back-frame bearings are moved clear.
- The arm role now names its inner lifting face.

**311 double three-legged:**
- The curved crossing tubes are replaced by Brown's planar diamond: each arm is
  one straight-armed plate between the wheel planes. Straight bands run from
  the pivot to the corner, from the corner to the bottom fork pin, and from the
  corner to the pallet.
- Topology is unchanged:
  - wheels ABC (front) and abc (rear) keep their 60° offset;
  - the pallets sit between the wheels;
  - stop D is confined to the front-wheel slab and E to the rear, which keeps
    them axially exclusive;
  - the lifting pins sit between the wheels.
- The unlock was re-solved at 1.8°.
- A slender suspension stud replaces the solid suspension bearing.

**312 Bloxam:**
- Both arms turn on one fixed stud through bored sleeves.
- Each arm is a flat plate in its own thin slab (±0.005–0.105 about the
  pivot), carrying the main rail, crosspiece and fork boss.
- The eight-degree outer detent and the axial stop A/B are sector plates in the
  outer-wheel slab. The swept T-heads leave a hooked stop whose leading face
  catches the next head.
- The plane pallet face is a plate in the small-wheel slab with a short stem.
- The common arbor is in the rotor and runs in a bored ring on a new bracket.

## Evidence (final)

### Intersection screens

| Movement | Stock screen (65 samples) | Fine screen (0.01 spacing, 257 samples) |
|---|---|---|
| 309 | 0 solid, 0 coaxial, 0 open | 0 / 0 / 0 |
| 310 | 0 / 0 / 0 | 0 / 0 / 0 |
| 311 | 1 solid at depth 0.0000 (lifting pin 1 grazing the right diamond), 0 coaxial, 0 open | 1 solid at depth 0.0001 (same graze) |
| 312 | 0 / 0 / 0 | 0 / 0 / 0 |

### Engagement

Numbers come from `check-gravity-escapement-engagement.mjs` and are asserted in
`tests/gravity-escapement-working-solids.test.mjs`.

**311:**
- In every locked sample, the locked leg meets only its own stop (D for ABC, E
  for abc) within 0.4–0.5° of further advance, at a gap of 0.0055–0.0058.
- The lift is at running clearance (gap 0.002–0.0065) to about 70% of the
  step.

**312:**
- The T-head reaches stop A or B within 0.2° at a gap of 0.0067–0.0072.
- The leading tip corner of each small-wheel tooth drives its plane pallet at a
  gap of 0.0043–0.0064 throughout both lifts.

**309:**
- The tooth drives the lift pad at a gap of 0.013–0.014.
- No nib lies ahead of the locked tooth (see limits).

**310:**
- The central pin drives the arm at gaps of 0.006–0.012.
- No stop lies ahead of the locked leg (see limits).

### Tests

The focused test is `tests/gravity-escapement-working-solids.test.mjs`. It
checks that:
- the bakes are current and rendered;
- the four screens show no pair deeper than 0.002 and no open meshes;
- the markers are hidden;
- the 311 and 312 locks and lifts engage.

Its negative control rebuilds 311 `right-stop-D` and 312 `left-detent-A` from
their uncut blanks. The probe must then report a solid intersection deeper
than 0.02.

`tests/movement-309..312.test.mjs` assert `userData.active` in place of
marker visibility. The lazy loader and the registry produce identical
fingerprints for 309–312.

### Renders

`node scripts/review-movement-source-views.mjs --ids=309,310,311,312
--output-dir=/dev/shm/gravity-review`

311 reads as a planar straight-armed diamond from the top suspension to the
bottom fork pins. The 310 bow is smooth again. No other visual regressions
were found against the baseline renders.

## Remaining limits

- **Prescribed dynamics are not physics validation.** Every lock, lift,
  impulse and handoff is prescribed by analytic laws. This pass shows only that
  the rendered solids do not interpenetrate under that prescription and, where
  stated, that they lie in position to transmit it. No MuJoCo or contact
  dynamics were run.
- **309 and 310 station phasing.** Both movements have the same problem:
  - The source-pinned stepping phases the lock stations with the tooth or leg
    pitch: in 309, one pitch per beat with a 9-pitch pallet separation; in 310,
    120° per beat.
  - So while the wheel is held on one side, a tooth or leg stands exactly at
    the other pallet's lock point as that pallet falls. In 309 it is about 0.27
    inside; in 310, about 0.2.
  - The arriving driver also sweeps the stop while the pallet is still low.
  - The swept cut therefore removes nearly all of the lock solid:
    - 309 nibs keep 0.007–0.011 of 0.10 area;
    - 310 stops keep 0.014–0.016 of 0.174.
  - Locking in these two movements comes only from the analytic law, and the
    310 D/E remnants read as small slivers beside the bows.
  - A real fix needs the pallet-fall timing or station geometry re-derived
    against the source, which is outside this bounded pass.
- **311 late lift.** After about 70% of the step, the smootherStep tail makes
  the analytic face concentric with the pin path. The swept pin also carves the
  fallen arm, so the gap grows to 0.025–0.059. The late lift is supplied by the
  law, not by contact. One lifting-pin graze of depth ≤ 0.0001 remains in the
  screen.
- **312:**
  - The trapezoid frame and legs are an added reconstruction, not Brown's.
  - The outer teeth are straight spokes with T-heads, which only approximate
    the engraved stops.
  - The small-wheel "curved" teeth are straight boxes. Lift contact moves to
    the tooth tip corner (gap 0.004–0.006) instead of the analytic flank point.
- **309 frame:** the rectangular frame and front suspension cock are
  reconstruction additions, not Brown's.
- **310 left arm plate:** the swept cut splits off and discards a 0.155-area
  fragment of the blank (0.070 on the right arm). The rendered arms remain
  continuous.

## Integration follow-up

Under the source-matching rule in `AGENTS.md`, the 309 clock frame and the
312 support frame (neither drawn by Brown) are removed by
[source presentation](../src/data/source-presentation.js), and all plates were
rebaked without them. After rebaking, the 309–312 tests and focused test pass
(39/39) and the fine screens at 0.01 spacing over 257 phases show no
penetration except 311's 0.0001 lifting-pin graze. Primary-agent visual
inspection: Claude Opus 5.5, 2026-09-23.
