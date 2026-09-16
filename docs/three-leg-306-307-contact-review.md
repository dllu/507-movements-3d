# Three-legged escapements 306–307: bounded finite-rest correction

This pass corrects **307's outer resting interfaces only**. Neither movement is
qualified as a complete working escapement. Both keep prescribed pendulum/wheel
motion; no MuJoCo trajectory or force result is installed.

## Source and retained reconstruction

Primary plates/captions: [306](https://507movements.com/mm_306.html) and
[307](https://507movements.com/mm_307.html), with the local engravings
`public/engravings/mm_306.png` and `mm_307.png`. The recorded source pages provide
no registered animation. The existing source record for 307 additionally cites
Beckett's figure 18 and Britannica's description of separate front locking teeth
and **sharp-edged backward-pointing pins**. The current round rear pins are an
inferred simplification, not a faithfully reconstructed sharp driver.

307 retains the bottle-shaped pendulum plate, three long front teeth, two outer
stops D/E and two rear impulse pallets A/B. It now has one-sided concentric stop
solids instead of rectangular bars centered on nominal tip loci. The long tooth
has a small raked end supporting the two rest contact normals; radius 1.88,
three-arm topology, axial planes and timing are unchanged. These simple tooth
flanks and 0.13-deep stop bodies are inferred mechanical dimensions, not traced
source contours. The raked/hooked ends differ visibly from the source's nearly
straight spear-shaped legs; the large rear support and rounded aperture also
remain source-fit residuals. 306's broad wheel arms still differ from its
illustrated narrow legs. Finite stand-offs use the actual intersection of the stop
footprints and plate material, connecting each raised stop to the plate.

306 receives an explicit reconstruction note and hides the three floating
nominal tip spheres, which are diagnostics rather than mechanical stock. Its
working geometry and motion remain unchanged; an incompatible aperture must not be presented as a
contact-corrected mechanism.

## Finite evidence

`tests/three-leg-dead-rest.test.mjs` checks actual rendered triangles, their
normals, all three neighboring teeth, the stop bodies and their finite mounts:

- 59 dead-rest poses, including samples adjacent to release/landing: minimum
  sampled solid clearance **0.0004997833** model units.
- 107 working rest samples: maximum actual tip-to-face distance **0.0005002028**.
  The small running gap means this is near-contact geometry, not loaded contact.
- Actual stop triangle normals resist clockwise wheel motion: minimum unit-force
  wheel moment **1.7157063**. The opposed normal lies in the supported corner
  normal cone of the actual finite tooth. Maximum pendulum moment magnitude
  **0.0013882** comes from the discretized concentric arc, whose ideal moment is
  zero. This qualifies available reaction directions, not forces under load.
- Both mounts overlap both real solids they join; new parts receive shadows and
  disable fog. Existing near-front camera, ground suppression and six-second
  display minimum remain. Playback preserves object/geometry buffers and has
  continuous positions at all prescribed phase boundaries.

**Remaining concrete failures are tested rather than hidden:**

| Movement | Actual finite witness | Signed gap |
| --- | --- | ---: |
| 306 | Tooth versus plate at authored `t=.92` | −0.125 |
| 307 | Long tooth versus outer stop at `t=.89` | −0.0417676 |
| 307 | Rear pin versus impulse backing at `t=.96` | −0.0690765 |

These are sampled penetration witnesses, not exhaustive maximum penetration
bounds. In particular, a correct resting face does **not** qualify release,
impulse, drop, loaded handoff or dynamic governing. The viewer reconstruction
notes explicitly disclose the remaining intersections.

## Rejected construction study

The durable report is
[`validation/three-leg-306-307-rejected-contact-study.json`](validation/three-leg-306-307-rejected-contact-study.json).
The exporter reads the current factory and actual 306 leg triangles; the Python
study requires Python 3, NumPy and Shapely. It writes only diagnostic output:

```sh
node scripts/export-three-leg-contact-study.mjs /dev/shm/three-leg-input.json
python3 scripts/study-three-leg-contact.py /dev/shm/three-leg-input.json /dev/shm/three-leg-study.json
cmp /dev/shm/three-leg-study.json docs/validation/three-leg-306-307-rejected-contact-study.json
```

For 306, cutting the full 1,025-pose tooth sweep would place the nominal active
impulse point **0.35974535** inside the removed opening at `t=3.3046875`, deleting
its working material. This clearance-only route was rejected.

For 307, the inherited smoothstep impulse gives an offset finite-pin face that
folds/undercuts near the start. One simpler candidate uses linear wheel advance
and one-sided pin-radius-offset faces, plus concentric outer rests. A bounded
72-angle initial search over wheel angles `[3.00159265, 3.14259265]` at pendulum
angle `−0.05235988` finds no clear seed: minimum overlap area **0.00919585**, at
A. This is a failed local construction/bracketing attempt, **not proof that no
mechanically compatible path exists**. It is not installed. The next meaningful
study should reconstruct the source's sharp-edged rear driver together with both
impulse faces and the outer release, selecting wheel phase by finite contact.
Another sweep cut around the old imposed law would not solve this.

## Validation command

```sh
node --test tests/movement-305.test.mjs tests/movement-306.test.mjs tests/movement-307.test.mjs tests/pin-escapement-working-solids.test.mjs tests/three-leg-dead-rest.test.mjs
```

**35/35 passed**. Full log: `/dev/shm/three-leg48-final-tests.log`.
The five new checks include the unresolved witnesses; they do not turn those
known failures into acceptance criteria for a working escapement. Root reviewed both final default and oblique views against the engravings
(`/dev/shm/family48-contact-final`): no browser errors or clipping; maximum
normalized extents 306 .8898 and 307 .89475. The later 306 change only hides the
three nominal marker spheres. Root handles the final shared build; this lane
launched no Chrome.

Final integration passes the production build (22.88 seconds), scoped CPU screen
and all seven packaged desktop/playback/mobile cases (18.4 seconds). The CPU
screen excludes imports and GPU work. See [review progress](review-progress.md)
for the combined pass record. The final 306 source view was re-inspected after
removing its diagnostic markers.
