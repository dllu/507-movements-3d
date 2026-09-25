# Pass-58 misc lane review (500, 002, 011)

User requests: complete the 500 section linkage from disk A to the pointer;
graduate 500's dial all round as Brown draws it; make the rope of 002 and the
belt of 011 taut, with straight tangent runs.

Captures come from a freshly restarted non-watching server on port 44482.
They are in `/dev/shm/w3/`:

- `final-ID.png`: default at phase 0, default at phase 0.5, rotated +60°,
  rotated −70°, top and far oblique.
- `finalz-500.png`: section figure zoomed at phases 0 and 0.5, plus two
  rotated views.
- `finalz-2.png`: the crossover, rotated and from the top.
- `src/ID-default.png`: the render beside the plate.

## 500 — diaphragm pressure gauge

### Face view

- Brown's dial is graduated all round. The dial now has a band between two
  fine cut circles (r 2.62 and 2.86) and 60 thin graduations lying on the dial
  face, with every fifth one long (12 long). They are ink-filled lines 0.02–0.032
  wide with a polygon offset. They replace the old raised 11-block arc, and
  there are no marker blocks.
- The pointer pinion now sits on the dial axis. The sector pivot moved to
  y = −0.78 (pinion 0.16 pitch radius, 8 teeth, same 0.04 module as the
  31-tooth sector). This keeps the graduations concentric with the dial.
- A short 0.24 input crank on sector e (15° from vertical) raises the maximum
  sector angle from 0.349 to 0.951 rad. With the 31:8 ratio the pointer sweeps
  about 211° instead of 62°. The sweep is centred on the top of the dial: zero
  is at 195°, full pressure at −16°, near Brown's pointer pose. The exact
  spatial rod solve is unchanged (bisection bracket widened to 1.4 rad).
- Verified in `final-500.png` (a/b: the pointer moves from the left across the
  top to the right) and `/dev/shm/w3/raw/z6-500-*.png` (both circles and the
  graduations at 10× zoom).

### Section figure

- Before, the orange sector e stopped short of a stub pinion. There was no
  pointer, and the pinion did not reach the sector.
- Now the train is whole and connected:
  - The disk-A centre boss carries a lug and pin.
  - A constant-length rod (solved by bisection, residual below 1e-9) runs from
    that pin to the pin on arm e.
  - Sector e turns on a fixed stud across the section (Brown's small circle),
    carried by a plain bracket screwed to the back of the dial.
  - Its toothed crown rim lies just behind the pinion and engages the pinion's
    back, which gives Brown's toothed arcs above and below the pinion.
  - The pinion is keyed to the pointer spindle. The spindle runs through a
    bore in the dial to the pointer hub and needle between the glass and the
    dial.
- The crown ratio is 4:1. The arm length is solved at build time so the section
  pointer's full-pressure sweep equals the face pointer's (3.684 rad).
- The section pointer's sweep is centred on the cut plane: it stands nearly
  upright at zero pressure (as Brown draws it), points into the case at mid
  pressure and hangs down at full pressure.
- The moving parts are whole solids (not cut), so the motion reads in every
  view.
- Verified in `finalz-500.png` (a/b default zoom at phases 0 and 0.5; c/d
  rotated +50° and −40°).

### Intersections

| Screen | Result |
| --- | --- |
| Solid, before → after | 0 → 0 |
| Coaxial, before → after | 0.0648 → 0.0648 (the existing face ball joint) |
| New, deforming | section disk × centre boss 0.035, a seated face; the boss sits exactly on the disk front (checked numerically: boss max x = disk min x = 6.9594) |
| New, deforming | rod strip × its own eyes 0.009, one rigid part |
| New, coaxial | pin/eye and stud/sector, 0.0002 or less |

The standard `--samples=129` run exhausts the default Node heap because the
diaphragm geometries are re-sampled every frame. With a 14 GB heap
(`node --max-old-space-size=14000 scripts/screen-body-intersections.mjs
--worker=500 --spacing=0.01 --samples=129`) it gives the same rows as the table
above (`/dev/shm/w3/ix500.json`).

### Residuals

- The two figures use different linkages (the face uses a spatial rod and a
  spur sector; the section uses Brown's crown sector and arm e). They agree at
  zero and full pressure; at mid pressure the face pointer leads (67 % of its
  sweep against 40 %).
- The section pointer, being whole, stands up to about 0.5 in front of the cut
  plane near the ends of its sweep.
- Brown's black centre disk on the face is still the open window onto disk A
  (unchanged).
- At rotations of 60° or more the section's half-drum still overlaps the gauge
  in projection (unchanged).

Proposed ledger text:

- **Assessment:** minor (unchanged).
- **visibleFlaws:** "At rotations of 60° or more the section figure's half-drum
  overlaps the gauge in projection; the section's whole pointer stands a little
  out of the cut plane at the ends of its sweep."
- **Limits:** "Face and section use separate reconstructed linkages that agree at
  zero and full pressure; the face pointer sweeps about 211° over a dial
  graduated all round (31:8 ratio, reconstruction choice)."
- **Intersections:** known. Coaxial 0.065 face ball joint; seated boss and disk
  in the section.

## 002 — pulleys and crossed rope

- Before, the shared `beltCurveCrossed` bowed both free runs ±0.13 out of the
  pulley plane with a sin² lift, so they read as slack curves in rotated views.
- Now a local `tautCrossedRopeCurve` makes both runs straight common tangents.
  One run lies wholly 0.066 in front of the pulley mid-plane and the other
  0.066 behind it, which gives a 0.036 clearance at the crossover. The rope
  shifts across the 0.30-wide tread over each wrap on a smoothstep, so the path
  has no kink.
- It is still the laid rope (radius 0.048), as the plate draws. The shared
  primitive and the other crossed belts are untouched.
- Verified in `final-2.png` (every view shows straight runs) and
  `finalz-2.png` (the runs pass cleanly at the crossover).
- Intersections: 0 → 0 at `--samples=129`, spacing 0.01; clear.
- Proposed ledger text: reasonable. visibleFlaws "". Limits "Prescribed crossed
  rope motion; the two runs pass in planes 0.066 either side of the pulley
  plane; tension and friction are not solved."

## 011 — quarter-turn belt without guides

- Before, both free spans were cubic Béziers between tangent points that were
  not common tangents, so the runs bowed.
- Now both runs are straight lines, laid out by the quarter-turn rule (each run
  approaches its pulley in that pulley's mid-plane):
  - The drum's belt plane touches the pulley's pitch circle at its left, so
    the left run is vertical, as Brown draws it.
  - The drum stands forward of the pulley plane by its pitch radius, so the
    right run lies in the pulley plane and comes from behind the drum, as on
    the plate.
  - Each run leaves its pulley at the delivery angle. The belt eases across the
    tread just before delivery (at most 0.057), so the path stays tangent
    continuous.
- The drum centre moved from (−0.68, 2.25, 0) to (−0.96, 2.25, 0.76).
- Verified in `final-11.png` and `src/11-default.png` (straight runs, left run
  vertical, matching the plate).
- Intersections: band × drum 0.0015 and band × pulley rim 0.0010, classed as
  coaxial seated contact. The earlier ledger note was sampled-clear, scoped.
- Proposed ledger text: reasonable. visibleFlaws "". Limits "Quarter-turn
  geometry laid out by the approach-plane rule; the belt twist on the free runs
  is reconstructed, not solved elastic equilibrium."

## Files

- `src/simulation/authored-diaphragm-pressure-gauges.js`
- `src/simulation/authored-belts.js` (only `simpleBeltTransmission`'s crossed
  curve, the new `AxialShiftWrapCurve3`/`tautCrossedRopeCurve`,
  `SkewedDeliveryWrapCurve3` and `rightAngleWithoutGuides`)
- `tests/movement-500.test.mjs`
- `tests/models.test.mjs` (the blocks for movements 1–2 and 11)
- `tests/pulley-belt-geometry.test.mjs` (the flange clearance test now skips the
  hidden retired ink-outline rims, which are not rendered parts)

Display profiles to re-measure: 500, 11 (the drum moved) and 2.
