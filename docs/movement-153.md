# Movement 153: baked passive stud-disk bar reverser

Production now uses `baked/stud-reverser.js`: a 298,839-byte offline MuJoCo
bundle with 6,001 poses and 15 merged meshes. The browser interpolates motion;
it does not load WASM or run contact physics. A full disk turn takes twelve
seconds and produces two six-second forward/return strokes.

The [source caption](https://507movements.com/mm_153.html) describes disk studs
pushing the bar's underside lug, followed by return through the elbow and the
bar's front stud. The replacement retains the source plan landmarks and the
approximately diametric stud pair, with the following explicit reconstruction
choices:

- The inner 100 source pixels of the input arm are raised above the disk stud
  ends. Its distal 19.08 pixels and rounded tip remain at working depth. The
  raised rear face is Z=0.80 and stud ends are Z=0.73. This **hidden depth relief
  is inferred**, not established by the engraving.
- Gravity resets the elbow onto a finite cylindrical stop. There is no elbow
  angular joint limit in this model. The stop bracket, bored bearings, rear
  supports and two C-shaped bar guides are inferred. Those guides remain
  engaged when the original left support roller loses bar contact.
- The return arm sits 0.05 farther forward, clearing the bar face by 0.03 while
  still meeting its projecting stud. The settled bar's left position is 2.91
  source pixels right of the drawing. A near-plan camera retains the source
  layout, with an unrestricted orbit for inspecting depth.
- The disk alone is actuated. Bar translation and elbow rotation are passive
  contact responses. Guide frictionloss 2, damping 1 and common density
  normalized to bar mass one are inferred. Working contacts are frictionless;
  the bar's guide constraint is ideal. Support-roller spin is derived from bar
  travel with a no-slip assumption. No external working load is modeled.

The old animation released the lower stud as soon as the bar reached its
chosen left coordinate, then prescribed a quintic elbow reset. The stud was
still contacting the arm. An independent rendered-mesh check found 26 failing
poses and 0.03722 maximum penetration during that reset. Passive simulations
of the original geometry and of a shortened output arm did not sustain the
intended cycle. The stepped arm supplies a physical release path instead.

## Physical and rendered checks

The final native model has bored moving hardware and moving parts designed to
meet at their host faces. Studs, hubs, collars and the disk rim no longer
contribute overlapping host volumes to mass estimates. A within-body surface
check covers 46 moving mesh pairs and 43,896 queries with no penetration above
1e-6; this is finite geometric evidence, not an exact CSG union-volume proof.

At dt=0.000125, the sixth-cycle bar range is 0.04069–1.02452. Consecutive settled
cycle endpoints differ by 2.41e-10 in bar position with effectively zero
follower velocity. Halving dt from 0.00025 changes matched bar positions by
at most 0.0005053 (0.0361 source pixel), disk angle by 0.0001805 rad and elbow
angle by 0.0022624 rad near impact. Three native tests cover actuator
independence, removal of contact and sustained passive reciprocation with the
physical stop.

The full rendered assembly check covers 43 parts and 626 distinct-body pairs
at 65 native poses: 3,843,468 bidirectional surface queries and no unintended
interference. Working contacts, including the stop, are reported separately.
Its maximum sampled soft penetration is 0.0000541. Vertices, edge midpoints
and face centers are tested; these finite samples do not prove continuous
clearance. Reports: `153-supported-{prototype,fine,refinement}.json`,
`153-assembly.json` and `153-moving-volumes.json` in `docs/validation`.

## Baked playback checks

The bake records native time 60–72 seconds at 0.002-second intervals. Tiny final
position residuals (at most 6.88e-10 across recorded coordinates) are closed at
the last sample, retaining the disk's unwrapped negative full turn. Meshes are
merged only within a rigid body and material. Bounds cover every recorded
pose with padding; fog is disabled and the ground is hidden.

Two bake tests compare interpolation at 24,001 native timestamps and check
bounds, fog, periodic continuity and exact restart. Maximum interpolation
errors are 0.0001024 rad for the disk, 0.0000816 for the bar (0.0059 source
pixel), and 0.0005429 rad for the elbow. An additional 65-pose between-sample
assembly check performs 3,848,628 queries with no unintended interference.
It applies baked coordinates to the same authored constituent solids merged
into the bundle; intended soft working contacts are reported separately.

Production Vite build and packaged Chrome desktop/mobile playback pass,
including play/pause, exact restart, orbit/reset and absence of WASM requests.
Source and oblique packaged renders were visually inspected. Private artifacts
are under `/dev/shm/153-*`.

## Reproduction

    INPUT_MIN=1.4 FRICTION=2 REPORT=docs/validation/153-supported-prototype.json node scripts/probe-stud-reverser.mjs
    cp /dev/shm/153-passive-samples.json /dev/shm/153-supported-samples.json
    INPUT_MIN=1.4 FRICTION=2 DT=.000125 REPORT=docs/validation/153-supported-fine.json node scripts/probe-stud-reverser.mjs
    cp /dev/shm/153-passive-samples.json /dev/shm/153-supported-fine-samples.json
    node scripts/review-stud-reverser-assembly.mjs
    node scripts/review-stud-reverser-moving-volumes.mjs
    node scripts/bake-stud-reverser.mjs
    node scripts/review-stud-reverser-baked-assembly.mjs
    node --test tests/stud-reverser-physics.test.mjs tests/stud-reverser-baked.test.mjs

Bundle source hashes, closure, bounds and size are recorded in
`src/simulation/baked/assets/153.provenance.json`. The older rejected
`153-passive-prototype.json` and `153-short-output-probe.json` describe commit
`ca75fc5`; `153-relieved-*` and `153-relief-contact.json` describe the preceding
candidate at `8a5acef`. They are historical evidence, not snapshots of current
geometry. Keep the inferred relief/hardware, ideal guides, assumed resistance
and finite-sampling limits attached to this reconstruction.
