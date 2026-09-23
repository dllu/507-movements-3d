# Engines 328, 330, 342 and 343 source-match and solids pass

Scope: 328 (Cartwright parallel motion), 330 (forked piston-rod guide), 342
(atmospheric beam engine) and 343 (upright engine parallel motion). Each movement was
compared against `public/engravings/mm_NNN.png` in its default and oblique review
captures, re-framed to the plate crop (`cameraDirection` (0.45, 0.28, 14) except 330, see
below; explicit plate-crop `cameraFitBounds`; `cameraDistanceScale` 0.96; `cameraFov` 8;
the full swept box is kept as `sweptBounds`), stripped of parts Brown does not draw, and
re-screened with `node scripts/show-body-intersections.mjs ID --spacing=0.01 --samples=129`.
All linkage laws, official timings and phases are unchanged. Every movement here remains
scripted/analytic; none uses MuJoCo.

Captures: `node scripts/review-movement-source-views.mjs --ids=ID --output-dir=/dev/shm/eng2`
(`ID-default.png`, `ID-oblique.png`; review artifacts are not committed). The script exits
non-zero because `maxNdc` > 1 is expected when the camera fits a plate crop rather than
the swept box. The camera-catalog contract (every vertex inside the crop projects inside
the camera at aspects 0.7, 1.2 and 2.4) was checked for these four IDs alone, with worst
|NDC| ≈ 0.991.

## Results

Depths are worst solid / coaxial overlap across the sweep. "0.0000" pairs are intended
seated contact.

| ID | Change | Worst before → after | Remaining flaws |
|---|---|---|---|
| 328 | Plate bed beam in front of the gear pair carrying two extruded pillow blocks with bored bearings; round cylinder barrel with cover, stuffing box, neck and gland at the bottom edge; tapered crank arms with bored pin bosses; plain gear flanks (no face ring, index box or bevel fold); flywheel rim drawn at plate proportions (13.6/12.9 units); undrawn frame posts, lower crossbase, beam bands and all index marks removed; wide plate crop. | 0.0535 solid / 0.0523 coaxial, open pinion mesh → none, no open meshes | The input flywheel shaft has no bearing (none drawn). The t=0 pose differs from the plate's (official phase kept). The plate's vertical scale is inconsistent; the rim-to-wheel-spacing ratio reads ≈1.31 vs ≈1.37 on the plate. The cover and gland sit slightly lower than drawn so they clear the crosshead's lowest position. |
| 330 | Rebuilt as the plate's side view along the crank plane (plate x → model −z): central frame column with capital, bored crank-bearing block with bush, edge-on flywheel with rim, hub and arms on a live shaft, crank web carrying hub and pin, guide A with shoe, bracket and mount arm to the column, round cylinder with cover, gland and two gland flanges, bottom cover below the crop; top beam and index marks removed. | none → none (an intermediate 0.0053 crank-web × rear fork branch was fixed by moving the crank plane to z 0.06) | Side-view reconstruction: the in-plane crank offset still comes from the official raster and cannot be checked from this view. The gland top sits ≈12 px lower than drawn to clear the fork wrist at lower dead centre; the crank web is shifted ≈7 px. The guide-A arm dog-legs behind the rod swing (invisible in the plate). Fork proportions and rim radial thickness are assumed. The column and cylinder end below the crop without a base. |
| 342 | Close-up of the beam's cylinder end as drawn: slotted segment-head beam casting, king post with strap and stays, bored beam pivot on a plummer-block pedestal over the masonry pier and wall, floor beam, open-topped lathe cylinder with flared rim, round piston head, concave-ended chain plates; plate calibration (pivot px (442, 162), 28.1 px/unit, beam at 15°) recorded in `sourceReference.brownPlate342.plateCalibration`. | 0.0255 solid / 0.048 coaxial (fluid 0.26) → last-chain-eye × terminal-connector coaxial seat 0.0000 only | The far beam end and weighted pump rod lie beyond the plate edge and are not modelled. The chain follows the official analytic wrap (scripted, not a dynamic chain). Stay, strap and pier proportions are read from the raster (±4 px). |
| 343 | Plate frame: two top rails, two pillars with capitals, extruded crank-bearing box on the rails; flat four-spoke flywheel annulus behind the frame; tapered bored crank arm and hub; closed round cylinder (gland, neck, cover, barrel with real bore, bottom cap) with a round piston head; joint pins P, C, U and D each fixed in one member (crank, piston output, upper and lower radius rods) with bores in the others; base rail, pedestal, square cylinder walls, cover lips, piston-rod guides, feet and white marks removed. | 0.0437 solid (piston rod × pin D) / 0.0759 coaxial (crank-pin boss × pin P), guide × vibrating piece 0.0428 → none, no open meshes | The engraving's radius-rod pivots and vibrating-piece length differ from the official canvas linkage, which is kept. The plate crank radius reads ≈4.3 units vs the official 3.5. Columns and cylinder end below the crop with no base. Spoke angles are estimates. |

## Reconstruction assumptions

- Shared rigid-body rule: every pin is a child of exactly one member; every other member
  carries a real bore (≈0.012 clearance) and crossing members are separated in z.
- 328: the bed beam is in front of the gears (z 0.96 to the gear plane + 0.21), matching
  the plate's overlap. The crank plane is z 1.10 and the rod plane z 1.34. The official
  flywheel radii 15/12.5 stay in `sourceAnimation`; only the visible rim uses the plate
  values.
- 330: the plate is read as a side view. The mapping is z = connectingRodPlaneZ −
  (px − 207)·s and y = 3.15 − (py − 52)·s, with s = `engravingScale` ≈ 0.01604 model
  units per pixel, recorded as `sourceReference.brownPlate330.plateView`. The camera
  therefore uses `cameraDirection` (14, 0.28, −0.45): the standard plate direction
  expressed in this side frame, not the literal (0.45, 0.28, 14).
- 342: the camera crops to the cylinder end of the beam as the plate does
  (box (−15.9, −12.6)·S to (3.2, 9.3)·S in x/y, z −0.6..1.0); the full swept box stays
  in `sweptBounds`. The piston law is the official corrected law
  (y = −6 − 12·beamAngle source units).
- 343: the plate crop is the official canvas window, x −15..15 and y −26..4 source units
  (17.5 px/unit, crank centre at px (262.5, 70)). The piston's lateral excursion on the
  near-straight locus (≤ 0.0078) stays inside the 0.012 bore clearance of the gland,
  neck and cover.

## Display-profile re-measurement needed

328, 330, 342, 343 (framing and geometry changed; `scripts/measure-display-profiles.mjs`
was not run). 330 in particular: its camera direction is now along +x.
