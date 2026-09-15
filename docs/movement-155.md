# Movement 155 — source and contact review in progress

155 is not yet corrected in production. Its current apparent engagement does
not correspond to contact between the rendered solids. An unregistered source-based MuJoCo candidate now feeds in both directions.
Full assembly qualification, timestep refinement and offline playback remain open.

## Verified defects

`review-elbow-pawl-legacy-contact.mjs` samples the actual wheel and pawl body
extents at 129 poses in each direction. All 65 forward and 64 reverse poses
claiming engagement have a **0.471 world-unit Z gap** between the bodies.
Consequently no amount of plan-view contact metadata establishes actual
engagement. The current wheel rotation, pawl lifting and settling are prescribed.
This check disproves contact; it does not qualify the other assembly parts.

The existing wheel has 20 teeth and a root radius of 154 source pixels. The
154-pixel circle is an internal drawn circle, not the outside of the tooth
spaces. Pixel measurements of the unobscured left/lower silhouette place those
roots near 182–184 pixels and the outer ink near 211–213 pixels. The present
56-pixel teeth are approximately twice the source tooth depth.

## Measured source evidence

The [source page](https://507movements.com/mm_155.html) describes an elbow-carried
pawl that feeds the wheel in either direction according to the side selected.
It marks the 2D animation unavailable.

`measure-elbow-pawl-source.mjs` reads the local 525×525 engraving directly,
without a browser. It samples outermost dark pixels every 0.1 degree and 0.25px
radius over the unobscured 115–345 degree sector. Fourteen complete tooth-tip
runs are fitted to consecutive centers for candidate tooth counts:

| Teeth | RMS angular error | Maximum angular error |
| --- | ---: | ---: |
| 23 | 1.118° | 2.372° |
| 22 | 1.881° | 2.724° |
| 20, current model | 8.440° | 13.361° |

The 23-tooth candidate is materially closer, with roughly 4.1px RMS tangential
error at radius 210. The drawing is not exactly periodic, and its obscured
sector does not prove an exact tooth count. Preserve that distinction when
choosing a regularized working profile. Nearest-pixel sampling and ink thickness
introduce approximately 2px measurement uncertainty. The radius quantiles also
include tooth flanks; they are not fitted circular root/tip radii.

[The source overlay](validation/155-source-teeth.svg) compares the old root circle
with the measured root region and shows the regular 23-tooth candidate. It has
been visually inspected. The hidden upper sector of that candidate is a
reconstruction, not a traced source contour.

## Native candidate

The candidate uses a 23-tooth wheel with radius 1.83 at the roots and 2.10 at
the tips, and a traced elbow/pawl at 0.01 world units per source pixel. It retains
the upper pin's six-pixel offset. The wheel mount is shifted 0.020 radians from
the silhouette fit and the pawl's inner toe/neck is relieved by up to five source
pixels to remove initial overlap. These are explicit regularization choices.
The pawl and wheel share the same working depth.

The right rod is attached through a normal pin. Its inferred upper pin is at
source (477, −70), beyond the source crop, and connects to an ideal vertical
slide. Only that slide is actuated: 0.78 world-unit stroke, 4.4-second period.
The elbow and rod follow the native pin constraint; the pawl and wheel remain
passive. Gravity and inferred hinge damping seat the pawl, and output bearing
friction of 3 represents a resisting tool load. Common-density mesh inertias
normalize wheel-family mass to one. No output step or pawl lift is prescribed.

A low resisting load (0.3) allows the wheel to follow the elbow backward and
forward without useful net feed. Increasing stroke alone did not correct this.
The resisted candidate advances one tooth per settled cycle.

Reversal is a **separate installation** of the same pawl turned over 180° about
the radial line through its pin; its reflected wheel mounting is initialized
accordingly. It does not animate the remounting operation. A trial that merely
swung the hooked pawl across the pin in its original plane started with 755
contacts and 0.28-unit penetration, putting the handle inside the wheel, and
was rejected. The original shows only the right-hand installation, so the
left-hand assembly and remounting interpretation remain inferred.

Eight-cycle probes at dt=0.0005 record:

| Installation | Settled teeth per cycle | Max sampled penetration | Max pin-constraint error |
| --- | ---: | ---: | ---: |
| Right | −1, error below 7e-8 | 0.000281 | 4.83e-7 |
| Left | +1, error below 1e-7 | 0.000195 | 6.00e-7 |

Both start without native contacts or initial penetration. Three tests check
single-slide actuation, repeated contact-driven feed in both installations,
rendered/native body positions, exact native reset, and a stationary wheel when
contact is removed. These establish a working native candidate, not complete
source/assembly correctness. Contact sampling is every 0.01 seconds and does
not prove a continuous penetration bound.

## Reconstruction requirements still open

- Add and audit connected, bored support hardware, the output shaft connection,
  and the upper input slide/pin. The current candidate omits the fixed frame.
- Audit all moving and fixed rendered solids through both complete sweeps;
  qualify mass-volume interfaces and native collision approximation.
- Refine timestep/contact meshes and quantify holding backlash and interpolation.
- Inspect source-facing and oblique views, full-sweep bounds and readable timing.
- Bake the qualified installations and preserve restart/selection in lightweight
  production playback. Production registration remains unchanged.

```sh
node scripts/measure-elbow-pawl-source.mjs
node scripts/review-elbow-pawl-legacy-contact.mjs
REPORT=docs/validation/155-right-native-prototype.json node scripts/probe-elbow-pawl.mjs
SIDE=left REPORT=docs/validation/155-left-native-prototype.json node scripts/probe-elbow-pawl.mjs
node --test tests/elbow-pawl-physics.test.mjs
```

The compact reports carry source hashes in `docs/validation/155-source-teeth.json`
and `155-legacy-contact.json`. Raw radial samples and the rendered overlay
screenshot are under `/dev/shm`.
