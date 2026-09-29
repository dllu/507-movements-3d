# 139: internal rack in a sliding carriage

The [source caption and animation](https://507movements.com/mm_139.html) show a
rack sliding vertically in a horizontally translating carriage. A continuously
rotating pinion engages alternate rows. The replacement now ships baked passive
MuJoCo motion, with no browser physics or runtime tooth generation.

## Source reconstruction

The engraving has **nine pinion teeth**, whereas its animation has eight and the
previous browser model had twelve. The animation guides the motion sequence;
the engraving supplies proportions and tooth count. The old trapezoidal teeth
intersected at all 360 checked poses, with maximum overlap 0.113642 world units
squared. See [the previous-model diagnosis](validation/139-tooth-review.json).

The replacement has involute pinion flanks and rounded cutter roots. Sweeping
the pinion produces a conjugate rack opening, including its rounded ends. A
common module of 0.059, eight straight pitches and a 16-tooth equivalent end
circle fit the drawing. The end-radius ratio is 16:9; one complete carriage
cycle takes 23/9 pinion revolutions. Pinion outer radius is 32.45 engraving pixels
versus approximately 32. The generated opening is 254.48 pixels wide versus
approximately 253 and 106.2 pixels high versus approximately 106.

The opening moves 4.65 pixels above the drawn centre to obtain conjugate lower-row
engagement: the hand-drawn teeth do not describe an exact gear pair. The source
pose puts the rack centre five pixels left of the shaft, with a pinion tooth
pointing downward. Unequal suspension arms with an approximately 64-degree bend
replace the old equal-arm, right-angle cranks. Fitted parallel cranks put eight
joint centres within 2.5 pixels of their measured positions. See the
[dimensional overlay](validation/139-dimensions.svg) and
[measurements](validation/139-dimensions.json).

The visible hardware includes bored links, a thick horizontal coupler, a thin
rack backing and tooth rim, vertical U-channel guides, the carriage's extended
bottom rail, short output rods, flanged support rollers and rear shaft support.
Depths, hidden supports, materials and physical scale are inferred. The scale
assumption is one engraving pixel per millimetre. A lightweight composite rack
and brass coupler make the chosen weight ratio plausible; the
[mass example](validation/139-mass-realizability.json) is an illustrative
construction, not evidence of historical materials or a strength calculation.

## Contact and playback validation

Only the pinion is driven in MuJoCo. The carriage and rack translate passively;
a crank/rod loop closes at explicit sites. The paired suspension is reduced to
equivalent masses. The horizontal coupler translates like its top pin, allowing
its mass to be lumped there without false rotational inertia. The selected
coupler-to-rack mass ratio is eight. Masses and inertias are assumed lumped
parameters, not an exact integration of every rendered fastener and support.
The geometry's principal panels illustrate those ratios; the dynamics do not
claim a unique physical reconstruction of the engraving.

The native mesh contains 352 pinion and 1,682 rack convex prisms. At a 0.000125-second
timestep and 0.001-second contact time, a 32-second run has no resets and maximum
soft-contact penetration of 0.03745 engraving pixels. Sampled rod closure error
is below 0.04574 pixels. The rack remains within 1.089 pixels of the ideal pitch
path. Lower counterweights or coarse integration lose engagement; the
[native study](validation/139-native-review.json) retains these failed trials.

Separate timestep halving and contact-stiffness doubling change rack position by
at most 0.2514 and 0.2402 pixels respectively. The longer run shows no increase
in penetration. See [the refinement comparison](validation/139-refinement.json).
These checks support the chosen animation under its stated parameter assumptions.

Motion is recorded at 100 Hz, preserving startup and an eight-second repeating
cycle. Position and velocity loop seams are below 0.000003 pixels and pixels per
second respectively. The offline geometry uses the same 0.015-pixel contour
simplification tolerance as the native mesh. The compressed geometry/motion
bundle is 1,030,208 bytes. At 1,600 between-recording times, maximum rendered
working-tooth overlap is 0.00558 square engraving pixels; this area is distinct
from the native penetration-depth metric. See [the playback contact check](validation/139-playback-contact.json).

Tests also check interpolated pin/bore clearance, coupler alignment, support
rollers remaining under the bottom rail, complete motion bounds and restart.
Packaged desktop/mobile playback is checked separately, including absence of
WASM requests. Provenance hashes tie the shipped asset to its geometry,
simulation and bake code.

```sh
node scripts/prototype-internal-rack-profile.mjs
COUNTER_MASS=8 SIM_OPTIONS='{"timestep":0.000125,"contactTime":0.001}' PROBE_SECONDS=32 PROBE_REPORT=/dev/shm/139-native-long.json node scripts/probe-internal-rack.mjs
node scripts/bake-internal-rack.mjs
node scripts/review-internal-rack-playback.mjs
node --test tests/internal-rack-profile.test.mjs tests/internal-rack-bake.test.mjs
```

## Pass 107: involute pinion and trapezoidal rack

Following the user's rule for square-drawn racks and pinions, the ten-tooth
pinion is an ideal involute cut by the standard 20-degree basic rack
(addendum 1, dedendum 1.25, full-radius cutter tips), and sweeping it round the
pitch path regenerates trapezoidal basic-rack teeth on the straight runs and
conjugate teeth round the ends (720 ideal poses, zero overlap). The native
study and bake were rerun with the commands above: the accepted candidate has no
resets over 32 s, maximum penetration 0.034 px, rod closure 0.036 px, and the
passive rack lags the ideal pitch path by up to 1.32 px in the end turns.
Timestep halving and contact stiffening move the rack by 0.43 and 0.58 px. The
bundle is 1,325,090 bytes; rendered overlap between recordings peaks at 0.0389
square px. Figures above this section describe earlier bakes. See
[p107-b review](p107-b-review.md).
