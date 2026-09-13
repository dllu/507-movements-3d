# Movement 083: live spring-sector crown ratchet

The catalog now uses MuJoCo for the ordinary-pin input linkage, two independently
spring-guided sectors and the horizontal crown wheel. Only the remote input
slider has an actuator. The rod can swing on its pins; contact advances the wheel
and lifts each returning sector. Neither sector lift nor wheel angle comes from
a prescribed trajectory. The input period is four seconds, with continuous
physics across strokes and a deterministic Restart.

## Reconstruction

The visible plates preserve the traced pierced outline, twelve sector teeth,
crank spacing and rod-eye dimensions from the earlier 083 study. The complete
38-tooth crown, rear sector, bored guide hardware, fixed shaft bearings and the
remote rod pin are visible in Three.js. The rod continues beyond the engraving's
cropped end to a retained slider. The output bearing leaves the printed length
of shaft visible, and the base clears the whole moving assembly.

Brown explicitly describes springs allowing the returning arcs to rise. Their
radial guide construction, depths, remote input installation and bearing supports
are inferred. Uniform tooth spacing is a reconstruction of irregular and partly
occluded ink: the existing 299 radial readings give 5.23 source-pixel RMS and
23.02 pixels maximum discrepancy. This does **not** establish a three-pixel match
for every tooth. The measured source data and original provenance hashes are in
`src/simulation/mujoco-spring-sector/source.js`.

Masses and full three-dimensional inertia tensors are integrated from the native
closed solids, using a common density normalized to a one-unit front sector.
The spring stiffness (40), guide damping (12), friction (0.25), motor gains and
contact compliance are assumptions, rather than historical measurements. The
four visible coils follow the actual guide positions. Joint constraints supply
ideal bearings and pins; support-hardware collision is screened independently.

The crown uses its native six-vertex tooth wedges. Each sector's exterior is
decomposed into 77/78 convex pieces, with zero measured exterior boundary error.
Collision-only filling of the two pierced openings cannot affect crown contact:
their complete polygonal boundaries remain at least 0.19655 world units above
the highest crown point for shaft angles within ±0.235 radians and the complete
guide travel. The sector depth also stays outside the filled wheel shaft bore.

## Numerical evidence and limits

The final timestep is 0.25 ms, with a 2 ms contact time constant and one second
of stationary spring settling before the playback clock starts. Over sixty
seconds (fifteen cycles), the final model advances 118.8944 teeth and retreats by
at most 0.01553 tooth. All generalized coordinates remain finite and every
single-step coordinate change is below 0.000240.

A second sixty-second run at 0.125 ms advances 118.8934 teeth. At 1,200 matched
50 ms samples, the greatest wheel-rim displacement is 1.771 source pixels and
the greatest native sector-vertex displacements are 4.623/1.786 pixels.
Short impact/drop timing remains timestep-sensitive: these results establish
bounded agreement for the tested runs, not identical trajectories or continuous
convergence. This limitation remains part of 083's ongoing mechanical review.

The separate tests check native finite-sector/crown contact, ordinary-pin closure,
both sectors engaging and releasing, guide travel, every rendered vertex within
the camera envelope, deterministic reset and frame partitioning. Native solid
screens cover the two reversals and both driving strokes; their small permitted
soft contacts are restricted to actual sector/tooth pairs. The inertia helper is
checked against an independently calculated translated and rotated solid box.

The final 600 native-contact poses have at most 0.20824 source pixels of radial
sector penetration, 0.18979 pixels of MuJoCo penetration and 0.00849 pixels of
remote-pin error. Both sectors engage and release in more than 100 samples.
Five hardware poses contain 84 closed, positive-volume solids and pass 1,739,316
bidirectional surface samples with zero reported intrusions or topology issues.
These are sampled checks; they do not prove continuous clearance of every solid.

The production build, 17 focused tests and six browser tests pass. Fourteen
rendered views are inspected: twelve source, stroke and hardware views through
the application model loader, plus the built catalog on desktop and mobile.
The final 8.233-second headless Chrome run advances 8.2325 physical seconds over
245 frames (about 29.8 fps), with no browser errors. The build retains the existing
large-chunk and browser-guarded Node `module` import warnings.

Early trials are retained outside Git. An excessive actuator gain destabilized
the first trial. Light guide damping produced about eleven source pixels of
step-halving disagreement; it was replaced by the damped model above. The first
browser capture also had an incorrectly sized CSS canvas and is rejected.
The capture harness now checks canvas/stage size explicitly. Earlier custom
solver studies and their failed convergence checks are preserved and are not
used as qualification of this MuJoCo implementation.

## Reproduction

```sh
node --test tests/mujoco-spring-sector.test.mjs
PROBE_SECONDS=60 PROBE_PREFIX=/dev/shm/083-coarse node scripts/probe-mujoco-spring-sector.mjs
PROBE_SECONDS=60 PROBE_OPTIONS='{"timestep":0.000125}' PROBE_PREFIX=/dev/shm/083-fine node scripts/probe-mujoco-spring-sector.mjs
node scripts/compare-mujoco-spring-sector.mjs /dev/shm/083-coarse.json /dev/shm/083-fine.json
PROBE_BASE_URL=http://127.0.0.1:5174 PROBE_PREFIX=/dev/shm/083-views node scripts/capture-mujoco-spring-sector.mjs
```

Probe files record source hashes and refuse to overwrite existing reports.
The comparison requires matching source hashes and otherwise identical options.
It reports discrepancies without treating agreement in total wheel advance as
proof of identical contact timing. Large generated captures and raw trajectories
remain outside Git; the reproducible probes, tests and this review are tracked.
