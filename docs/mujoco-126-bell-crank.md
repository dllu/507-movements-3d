# 126 — Pulley and bell crank: preliminary source review

The public model still uses the authored kinematic implementation. A native
replacement has not yet been built. Seven inspected baseline views show a
spoked pulley where Brown draws a solid face, narrow straight lever arms in
place of the curved source outline, oversized pulley proportions and an added
support frame, guide rails and handles.

The [original caption](https://507movements.com/mm_126.html) describes a
bell-crank lever changing force direction. It does not specify a driving
stroke, return load, rope properties, axial depths or the hidden bearings.
Those will require explicit reconstruction assumptions. The pulley, two cord
attachments and fixed bell-crank pivot provide the visible topology.

Preliminary bounded ink-band circle fits use the 525-square local engraving.
The circle-overlay image was inspected; front/rear offsets and the hatched
shaft still require interpretation. Values are image coordinates in pixels:

| Circle | Center | Radius | RMS |
| --- | --- | ---: | ---: |
| Pulley outer rim | 156.587, 148.385 | 79.453 | 0.757 |
| Pulley inset | 157.174, 148.136 | 61.416 | 0.656 |
| Pulley hub | 156.237, 150.054 | 26.918 | 0.458 |
| Pulley shaft | 156.864, 150.929 | 15.633 | 0.430 |
| Bell pivot outer eye | 396.757, 349.302 | 24.823 | 0.648 |
| Bell pivot inset | 395.762, 348.718 | 17.625 | 0.325 |
| Bell pivot pin | 394.879, 349.194 | 7.902 | 0.303 |
| Input eye | 227.131, 348.590 | 19.666 | 0.413 |
| Input pin | 225.746, 350.516 | 8.245 | 0.289 |
| Output eye | 388.813, 490.647 | 18.197 | 0.770 |
| Output pin | 388.932, 491.298 | 8.207 | 0.344 |

The partial pivot-pin fit has only 49 points; the other fits have 94–120.
Coaxial geometry, the rope's working radius, rope width and the curved lever
silhouette are not yet qualified. Circle fits alone do not establish a
source-faithful three-dimensional assembly or working contact.

Run `scripts/capture-bell-crank-baseline.mjs` against Vite using
`PROBE_BASE_URL`, and `scripts/measure-bell-crank-source.mjs` for the circle
measurements. Use `TMPDIR=/dev/shm` and exclusive `PROBE_PREFIX` paths.
The initial retained records are `/dev/shm/126-baseline-a.json` with seven PNGs,
and `/dev/shm/126-source-a.json` with its measured-circle overlay. All eight
images were inspected. Scripts freeze inputs and verify their hashes; generated
images and measurements remain outside Git. Native motion, contact, rendered
clearance, source comparison and integration checks are pending.
