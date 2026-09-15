# Movement 155 — source and contact review in progress

155 is not yet corrected in production. Its current apparent engagement does
not correspond to contact between the rendered solids. The next step is a
source-based MuJoCo reconstruction, followed by assembly qualification and an
offline bake in both pawl directions.

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

## Reconstruction requirements still open

- Build the shallower square-tooth wheel and the source-shaped throw-over pawl
  in a common working depth. This is a reversible pawl wheel, so symmetric
  working faces are appropriate; do not substitute directional ratchet teeth.
- Preserve the source elbow and pin centers, including the six-pixel upper-pin
  offset currently removed by idealization.
- Replace the invented horizontal input slot with an ordinary pinned input
  linkage. The drawing cuts off the upper input rod; its connection to a
  rectilinear driver will require an explicit reconstruction assumption.
- Use actual passive pawl/tooth contact, with justified gravity, return bias and
  resisting output load. Qualify both directions and natural seating; do not
  retain prescribed pawl lifts or output steps as evidence of correctness.
- Add bored, connected support hardware; inspect the full sweep and camera;
  bake qualified motion for lightweight playback.

These requirements are not yet satisfied. The production registration is left
unchanged at this checkpoint.

```sh
node scripts/measure-elbow-pawl-source.mjs
node scripts/review-elbow-pawl-legacy-contact.mjs
```

The compact reports carry source hashes in `docs/validation/155-source-teeth.json`
and `155-legacy-contact.json`. Raw radial samples and the rendered overlay
screenshot are under `/dev/shm`.
