# Pass 74, lane p74-c: user review fixes for 468, 469 and 474

The captures are in `/dev/shm/p74-c/`, outside Git.
- `before/` and `after/` hold `ID-default.png` and `ID-oblique.png` from `scripts/review-movement-source-views.mjs`.
- `b474/`, `a474b/` and `a474c/` hold the 474 rotated and close views (`tile.png`, and `cmp.png` beside the plate).
- `b469/` holds the 469 before views. `a469f/` and `after2/` hold the final crown-gear views. `a469/` holds the withdrawn bevel variant.
- `b468/` and `a468/` hold the 468 views: `tile.png` and `ba.png`, which stacks before beside after.

## 474 Hero's aeolipile

**User.** "The handles are not connected on the bottom (not to mention being perpendicular to what's depicted in the engraving) and the legs don't have caps at the ends."

**What was wrong.**
- Each handle was a C-shaped tube in a radial plane.
- Its lower end stopped about 0.05 off the boiler's flank, leaving an open tube mouth in the air.
- The legs were open tubes with hollow ends at the feet.

**Change** (`authored-aeolipiles.js`, `straightenSourceRisers`):
- **Handles.** Each handle is now a strap loop lying along the rim, running front to back as Brown draws it.
  - The right handle leaves the rim at the front and runs back and out. It then drops forward and returns into the flank lower down (y -0.55).
  - The left handle is the same loop turned half round. Its top bar shows above the rim, running back to the riser, as on the plate.
  - Both ends are sunk into the boiler wall.
  - The loop is built from straight bars with 0.26 fillets, on a new `filletedPolyline` helper.
- **Caps.** A new `cappedTubeGeometry` gives the handles and the four cabriole legs hemispherical end caps. The legs' heads start inside the flank (radius 1.30).
  - The caps' rings follow the tube's own Frenet frames, and their normals are analytic. The cap and the tube weld into one closed, consistently wound solid: after welding, no open, non-manifold or mixed edges remain.

**Evidence.** In `a474c/cmp.png`, the right handle is a strap loop hanging off the rim beside the riser, as on the plate. In `a474c/tile.png`, both of its ends meet the bowl from the ±40° views. `a474b/t2.png` shows rounded feet.

**Checks.**
- Intersections (0.01, 129 samples): no solid pairs, as before.
  - The handles are no longer flagged open. Only the steam cores are open, which is intended.
- Faces: clean.
  - The first fillet radius (0.16) pinched the tube at the sharp corner, and the face scan flagged 22 triangles.
  - Hemisphere caps that were not aligned to the tube's frames left 64 open edges; their first winding was reversed.
  - Both are fixed.
- **Residual, not in scope.** A faint dashed line runs round the bowl just under the lid rim, and the risers show fine banding. Both exist in the before captures.
- Seam: clean.

## 469 French temperature-difference air machine

**User.** "The right compartment is slightly off; the tube on the bottom appears meant to be mated to the water wheel in a way that minimizes leaks. Also the right gear mechanism is depicted as a bevel gear rather than a cylindrical pinion plus crown gear."

**Gears.**
- The lead's reading is that the wheel's drive must be a cylindrical pinion and a crown gear, and that only the screw-head pair is a bevel pair.
- An intermediate version in this pass had put a mitre bevel pair at the hub. It is withdrawn.
- The pass-72 drive is kept unchanged: a 12-tooth involute pinion on S drives a 48-tooth pinion-generated face (crown) gear on the wheel's front, 1:4, one wheel turn per loop.
- The screw-head mitre pair is unchanged.

**Change** (`authored-temperature-air-machines.js`; `cutaway-presentations.js` 469 entry):
- **Pipe route.** The descending pipe now runs at x 2.50 (Brown about 2.4), close beside the wheel. At the bottom it jogs back to the wheel's plane and turns in under the wheel.
- **Hood.** The pipe ends in a new hood (`air-pipe-mouth-hood-fitted-under-wheel`, a finite plate union).
  - It is an open-topped box whose front, back and side walls end in arcs concentric with the wheel, 0.02 outside its rims.
  - It spans both rims and runs from 0.30 left to 0.40 right of the axle, which matches Brown's stepped chamber under the wheel. Brown's lip clearance is not measurable at plate scale; 0.02 is the chosen fit.
  - The pipe enters the hood's right wall through a hole of the pipe's own bore.
  - The hood takes the pipe's opaque cutaway material.
- **Air path.** The air leaves the pipe inside the hood and follows a smooth path (tangent to the pipe's exit), rising on the wheel's right side.
- **Cisterns.** The cisterns are 2.20 deep front to back (was 2.10). That is the least that seats the hood's back wall, 0.02 clear of the cistern's back wall. The elevation and the camera fit are unchanged.
- The mechanism and transmission texts mention the hood.

**Evidence.**
- `after2/469-default.png` is the render beside the plate: pinion on S over the crown ring, hood under the wheel.
- `a469f/tile.png` shows the wheel front and oblique, then (cistern walls hidden) the hood oblique, side and back.

**Tests.**
- `temperature-air-469-bevel.test.mjs` and `thermal-steam-469-474-solids.test.mjs` are the pass-72 versions, unchanged, and pass. They check the head mitre and the face-gear pair: generated teeth clear with a close flank gap, pitch velocities agree, and the pinion clears the disk.
- `movement-469.test.mjs` is the pass-72 version plus:
  - the hood's parent;
  - a new test that the hood's lips sit 0.015–0.025 outside the rims, that the hood spans both rims and clears the back wall, and that the pipe ends at its wall.

## 468 Flexible water main

**User.** "The geometry is slightly sloppy and contains gaps too." The gaps are between the brown blocks (cheeks) and the pipe-joint parts, and around the black ball joint and the base.

**Change** (`authored-flexible-water-mains.js`, `buildPlateJointFigure`):
- **Cross ties.** Each cross tie is now a saddle framed into both logs, 0.01 into each, from the logs' bottoms. Its top is cut to the pipe's radius, so the pipe lies in it; before, a tie block stood 0.02 under the pipe.
- **Pipe straps.** The pipe straps now touch the pipe (inner radius = pipe radius), and their legs run into the saddle's top.
- **Hinge straps.** The hinge straps lie flat on the log faces (outer 0.88 and inner 0.64); before, they stood 0.005 off.
- **Knuckle.** A trunnion boss, cast on the socket, now carries the pin out through the inner strap to the outer strap's face.
  - Before, the pin started at a point on the socket sphere and ran bare.
  - The pin head now bears on the outer strap; before, it stood 0.035 off.
- **Log ends.** The figure flexes only one way (0–23°), and the upstream log ends then swing clear. So the log ends need only clear the other frame's strap legs: the gap at the joint is 0.09 each side (was 0.16).
- **Ball neck.** The upstream pipe now runs 0.012 into the ball's neck; before, it stopped 0.004 short.

**Evidence.** `a468/ba.png` (before | after) and `a468/tile.png` (front, ±40°, under, back, plan oblique).

**Checks.**
- Intersections (0.01, 129 samples): only zero-depth coaxial bearing contacts: pin head / boss against the outer strap.
- Faces: clean. A pin end that was coplanar with the boss face was removed.
- Seam: clean.

## Tests run

- `movement-468`, `folding-pipe-solids`, `movement-469`, `temperature-air-469-bevel`, `movement-474` and `thermal-steam-469-474-solids` all pass.
- `check-loop-seams` for 468, 469 and 474: clean.

## 469 checks (final crown-gear version)

- Intersections (0.01, 129 samples): 8 bodies, no solid pairs, only fluid rows. The face-gear tooth sector is flagged open, as in pass 72.
- Faces: the cistern-wall same-look z-fight and base section-cover flags only. Both existed before; nothing is flagged in the hood.
- Seam: clean.
