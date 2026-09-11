# 056 · Lathe gear engagement

The reconstruction is integrated in `src/simulation/lathe-gear-engagement.js`
and `src/simulation/lathe-engagement-motion.js`. Build, five focused tests,
all 2,950 numerical tests and all 16 browser tests pass. The numerical process exited 0 in 110.866 seconds; the browser process
exited 0 in 660.136 seconds with one worker. Six integrated source/oblique
comparisons and the rear view are saved; source phase 0, full phase 0.42,
source phase 0.65, the rear view and source overlay were visually inspected.
The overall review remains active: 037 is unresolved and 057 onward are pending.

## Source and interpretation

Brown describes an eccentric-slot lever that withdraws the large gear's shaft.
The drawing shows a curved foreground headstock, slender integral handle,
three rear pulley steps and a sliding bearing partly concealed by the lever.

- Official page: https://507movements.com/mm_056.html, saved in
  `../reference/mm_056.html`.
- Enlarged scan: `../reference/brown-056-detail.png`, extracted unchanged from
  PDF page 22 at scale 6000, rectangle (3050,2400,1400,1320).
- Measurements: `056-source-circle-fits.json`, `056-source-tooth-peaks.json`,
  `056-indexed-tooth-fit.json` and `056-source-pitch-measurement.json`.

The indexed visible large-wheel teeth fit 38 positions best among the tested
counts (1.65 degrees RMS). The partly concealed pinion suggests about 12 teeth;
this remains an estimate. The website animation uses 45/15. Neither count nor
ratio is prescribed by Brown's description. The reconstruction uses 38/12,
one module of 0.1 and parallel shafts at center distance 2.5.

The apparent source circle centers do not project consistently as concentric
parts on parallel shafts. The near-frontal view (0.65,-0.1,10) balances the gear
and pulley positions while retaining straight shafts. The standard involutes
have shorter tips than the schematic teeth: large-wheel radius is about 20
pixels smaller at 190 pixels/unit, with a small remaining center offset.
A 1.6-module addendum trial improved diameter but lost consistent engagement:
gap up to 0.0009052 and normal-force work discrepancy 7.87%. That unused trial
is in `056-extended-candidate-model.mjs`, `056-extended-rack-geometry.mjs` and
`056-extended16-contact.json`.

`056-source-alignment.html` overlays actual projected Float32 mesh contours on
the unchanged scan. Opacity and hidden-edge controls expose the residuals.
The headstock, integral lever and front bearing follow the traced contours.
Thicknesses, rear support, bores and pulley sections are inferred.

## Operation

Four stages drive both gears, stop and withdraw, turn the pinion alone, then
stop and return. A whole free pinion revolution makes re-entry phase-compatible.
Both shafts remain stopped during each lever stroke. Quintic start/stop profiles
preserve continuous position, velocity and acceleration. Seeking is pure.

This sequence is an explicit interpretation. Brown does not require shifting
under power. The Logan lathe manual, U.S. Army TM 9-3416-233-14&P, printed page
23 (PDF index 26), states:

> NEVER ENGAGE BACK GEARS WHILE LATHE IS IN OPERATION OR WHEN SPINDLE IS IN MOTION.

Primary manual mirrored at
https://cdn.imagearchive.com/homemodelenginemachinist/data/attach/1/1690-powermaticarmy12.pdf,
saved as `../reference/logan-lathe-back-gears-manual.pdf`. The filename does not
identify its manufacturer. No impact, inertia or friction model is claimed.

The lever turns 53 degrees. Its circular slot has center (0.028,0.585) relative
to the fulcrum and an initial follower radius of 0.91, producing about 0.37
shaft throw. Rounded ends extend 0.02 radians beyond operator-controlled travel,
keeping the follower on the circular working wall during start/stop. The first
end-cap trial had up to 21.2% work discrepancy near stroke ends; its report is
`056-candidate-cam-forces-endcap-baseline.json`.

The authored cycle is 7.2 seconds. Measured display rates give a default cycle
of 4.1533 seconds, playback scale 1.73356: about 1.38 seconds per running stage
and 0.69 seconds per stopped shift.

## Geometry and evidence

Both gears use 20-degree involutes generated with a rounded rack. The existing
055 generator defaults are unchanged. The local extrusion wrapper triangulates
Float32 coordinates and removes exactly collinear points before triangulation,
avoiding cap triangles collapsing on conversion. It explicitly orients exterior
and hole loops. All 16 meshes are closed with positive volume and outward normals
at every triangle corner.

The slot and shaft bores are real holes. The output bearing translates without
rotating. Pulley, gear and shaft belong to their correct rigid bodies. The fixed
headstock and cam pivot stand in front of the gears; pulley and rear support are
behind. Ground is hidden; there is no fog; the camera fits the whole lever sweep.

- `056-candidate-tooth-cycle-contact.json`: 2,049 uniformly spaced tooth phases,
  actual gaps 0.00002833–0.00003584, zero crossings, positive compressive power,
  maximum work discrepancy 0.278%.
- `056-candidate-planar-contact.json`: 1,026 full-cycle poses, zero crossings.
- `056-candidate-exact-contact.json`: independent actual triangle minima at
  three gear poses and ten shaft/slot poses, all strictly positive.
- `056-candidate-hardware.json`: 97 poses, 85 independently moving part pairs,
  62,754,548 bidirectional surface checks, zero penetrating samples. Permanent
  same-body attachments are excluded; tooth contact is checked separately.
  Disjoint transformed AABBs certify separated poses where applicable.
- `056-candidate-cam-forces.json`: 130 poses, active-wall gaps
  0.00003887–0.00005688, positive compressive power both ways, maximum work
  discrepancy 0.805%. These are quasi-static normal-force checks.
- `056-candidate-solids.json`: all 16 solids pass every face and corner check.
- `056-focused-tests.log`: five passing tests covering solids, actual teeth,
  hardware, stopped shifts, deterministic seeking and actual cam forces.

Finite sweeps and tessellation clearances are numerical evidence, not continuous
collision certification or a simulation of elasticity, wear, impact or load
inertia. Counts and hidden sections remain inferred.

## Replaced baseline

`056-original-factory.txt` and `056-original-test.txt` preserve the replaced
code. Its 45/15 phase was a quarter pitch from proper tooth/gap alignment, and
its large gear moved after contact ended. Its frame was behind exposed gears;
the broad elliptical cam and separate black grip differed from the drawing.

`056-tooth-contact-baseline.json` records 19,778 penetrating samples in 3,248,220
checks across 85/129 poses, maximum depth 0.07079554. Original views remain in
`056-baseline-phase-*.png`. `056-first-candidate-*` preserves earlier geometry
and evidence; those files do not describe the integrated model.
