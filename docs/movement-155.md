# Movement 155 — reversible elbow-pawl feed

155 now uses an 839 KB offline MuJoCo bake with selectable right and left pawl
installations. Only the input slide is actuated in the native model. Pin
constraints move the rod and elbow; gravity and tooth contact determine the
pawl and output motion. Each settled 4.4-second cycle advances one tooth.
The browser interpolates five coordinates and loads no physics engine.

## Source fidelity

The [engraving and caption](https://507movements.com/mm_155.html) describe an
elbow-carried pawl producing intermittent feed in either direction according to
its installed side. The source marks its 2D animation unavailable.

The previous production model reported engagement despite a 0.471 world-unit
Z gap between the pawl and wheel. Every claimed engagement in 129 forward and
reverse samples had that gap. It also used 20 teeth rooted at the internal
154px decorative circle, making the teeth approximately twice the drawn depth.
The old diagnostic remains in `155-legacy-contact.json`.

Direct pixel sampling of 14 unobscured tooth-tip runs favors 23 regular teeth:
1.118° RMS angular error, versus 1.881° for 22 and 8.440° for the previous 20.
The hidden count is inferred, and the drawing is not exactly periodic. The
[source overlay](validation/155-source-teeth.svg) records that distinction.
Nearest-pixel sampling and ink thickness give approximately 2px uncertainty.

The reconstruction uses 0.01 world units per source pixel, tooth roots at radius
183px and tips at 210px, and the traced elbow/pawl. It preserves the six-pixel
upper-pin offset formerly removed by idealization. A 0.020-radian wheel mounting
adjustment and up to 5px inner pawl toe/neck relief reconcile the regular teeth
with the drawing without initial penetration. The internal circle is a surface
marking rather than a tooth boundary. The nearly frontal view retains the source
arrangement; the full wheel and extended input mechanism remain visible in 3D.

The right input uses an ordinary pin, replacing the invented slot. The rod's
upper pin at source (477, −70), beyond the cropped engraving, attaches to a
vertical crosshead. Its upper guide, rear frame, bored bearing, stepped output
shaft, sleeves and retainers are inferred construction.

## Passive feed and reversal

A vertical input stroke of 0.78 world units drives the pinned rod over 4.4s.
Gravity seats the freely hinged pawl; hinge damping and output bearing friction
of 3 model dissipative joints and a resisting tool load. Common-density moving
mesh inertias normalize the output family to mass one. The input crosshead's
actual mesh inertia is included. Guides and hinges are ideal constraints;
nonworking solid contacts are audited separately. The painted circle has no mass.

A weak resisting load (0.3) allowed the wheel to follow the elbow backward and
forward without net feed. The selected load produces one tooth per cycle in
both installations, without prescribed wheel steps or pawl lifts.

Reversal represents a **separate installation**, with the pawl turned over 180°
about the radial line through its pin and a reflected wheel mounting. The
selection resets playback; it does not animate disassembly/remounting. Only the
right-hand installation is shown in the source, so the left setup is inferred.
Simply swinging the hooked part across its pin in the same plane was rejected:
it put the handle inside the wheel, with 0.28-unit initial penetration.

## Numerical and assembly evidence

The supported native runs at dt=0.00025 start without penetration and settle to
one tooth per cycle, with per-cycle step error below 1e-7 tooth. Maximum sampled
soft penetration is 0.000148 (right) and 0.000172 (left); native pin-constraint
error stays below 7.4e-7 world units. These are sampled bounds, not continuous
contact proofs.

Halving dt from 0.0005 changes the largest sampled pawl angle by 0.000339 rad,
output angle by 0.0000295 rad, and input-slide coordinate by 0.0000133 world
units. Reverse motion during seating is below 0.95% of one tooth in either
installation (approximately 0.54 source pixels at the tooth tips).

Each installation contains 30 constituent solids. The native assembly audit
checks 390 relevant pairs at 129 startup/settled poses, with same-moving-body
interfaces checked once: 8,992,356 right and 8,177,648 left point queries find no
unintended intersections. Intended pawl/tooth soft contacts are reported
separately. Fixed-frame unions are excluded from the mass-overlap check.

The bake retains startup from the source pose, then repeats the settled second
cycle. Each installation records 4,401 poses at 0.002s spacing. Tests compare
17,601 native instants per installation, including between-frame positions.
Maximum interpolation errors across both installations are 0.000328 rad for the
pawl, 0.0000311 rad for the wheel, and 0.0000467 world units for the input slide.
The between-frame assembly check adds 8,931,638 right and 7,925,916 left point
queries with no unintended intersections. Surface sampling is finite; it does
not establish a continuous collision proof.

The production bundle has nine merged solid meshes plus a painted circle per
installation. Five focused tests cover native feed, loss of feed when contact
is removed, native/rendered body positions, interpolation, configuration, bounds,
fog, periodic closure and exact restart. Production build and packaged playback
check both selections, play/pause, restart, orbit/view reset, mobile layout,
errors and absence of a WASM request. Source-facing and oblique views are inspected.

## Reproduction

```sh
REPORT=/dev/shm/155-supported-right.json node scripts/probe-elbow-pawl.mjs
cp /dev/shm/155-native-samples.json /dev/shm/155-supported-right-samples.json
SIDE=left REPORT=/dev/shm/155-supported-left.json node scripts/probe-elbow-pawl.mjs
cp /dev/shm/155-native-samples.json /dev/shm/155-supported-left-samples.json
DT=.00025 REPORT=docs/validation/155-supported-right-fine.json node scripts/probe-elbow-pawl.mjs
cp /dev/shm/155-native-samples.json /dev/shm/155-supported-right-fine-samples.json
SIDE=left DT=.00025 REPORT=docs/validation/155-supported-left-fine.json node scripts/probe-elbow-pawl.mjs
cp /dev/shm/155-native-samples.json /dev/shm/155-supported-left-fine-samples.json
node scripts/review-elbow-pawl-refinement.mjs
node scripts/review-elbow-pawl-assembly.mjs
node scripts/bake-elbow-pawl.mjs
node scripts/review-elbow-pawl-baked-assembly.mjs
node --test tests/elbow-pawl-physics.test.mjs tests/elbow-pawl-baked.test.mjs
```

Reports and source hashes are in `docs/validation/155-*.json` and
`src/simulation/baked/assets/155.provenance.json`. Raw trajectories, production
builds and browser artifacts are under `/dev/shm`. Early prototype reports are
superseded by the supported reports; their history remains in Git.
