# Movement 161 — centrifugal governor

161 now uses a source-shaped assembly and offline native bake. The final section
records shipped validation and remaining modeling assumptions; earlier sections
retain the diagnostic history.

## Source and current issues

The [original page](https://507movements.com/mm_161.html) describes a centrifugal
governor: engine-driven bevel gears rotate the spindle; increasing speed spreads
the balls and raises the sleeve to reduce the regulating-valve opening. The
Animated tab is unavailable, so there is no original 2D motion oracle.
The engraving shows solid low-speed and dotted higher-speed ball positions.

The existing authored model measures spindle x=279, upper pivots near (258,145)
and (303,145), elbows (210,269)/(350,269), balls (180,345)/(379,345), and sleeve
pins (261,389)/(298,389). It symmetrizes the linkage about the spindle. Its
spread is found from instantaneous point-ball equilibrium at each prescribed
speed; differentiating those equilibrium poses does not make the transient
motion satisfy the dynamic equations. The lower links and sleeve have no
influence on that equilibrium calculation.

The input bevel gear also needs a source fit: its current 0.75-world-unit pitch
radius is 41.67 pixels at the model's 0.018 scale, already larger than the
measured 35-pixel **outer** radius. The outer teeth increase the discrepancy.
The existing shared bevel generator uses a Tredgold involute approximation and
conical end profiles, which should be retained while correcting dimensions and
checking mesh contact. The lower fork/collar silhouettes and the old added
rectangular steam-port interpretation also need review against the engraving.

## Native linkage study

`mujoco-ball-governor/physics.js` has one driven spindle hinge, two passive
upper-arm hinges, two passive lower-link hinges and a passive sliding sleeve.
Two site connections close the lower links onto the sleeve. Each rigid upper
arm continues through its elbow to its ball, as in the source. Only the spindle
is actuated; arm spread and sleeve height emerge from native dynamics.

The diagnostic retains the existing source-proportioned geometry: top pivot
radius 0.405, pivot-to-ball length 3.858, elbow distance 2.388, lower-link length
2.351 and sleeve-pin radius 0.333 world units. It uses two 1 kg balls, 0.02 kg
upper rods, 0.02 kg lower links and a 0.1 kg sleeve. Gravity 98.1 world units/s²
corresponds to an inferred 0.1 m per world unit. Joint damping, masses and that
scale are explicit study assumptions, not historical measurements. No valve
force, engine feedback, finite ball/shaft collisions or bevel contact is modeled
yet. The speed endpoints are still the unloaded point-ball equilibria, about
4.586 and 5.097 radians/s, varying over eight seconds.

Two 32-second runs at 0.0005 and 0.00025 seconds preserve pin closure to below
2.2e-7 world units and left/right symmetry to roundoff. The maximum paired spread
angle difference is 0.001376 radians. At the finer timestep, successive cycle-end
spread angles are 0.365, 0.3420, 0.3036, 0.2662 and 0.2416 radians: the initial
transient has not settled to a periodic bake. This exposes dynamic behavior
hidden by the old equilibrium animation; it is not evidence of a qualified
steady operating cycle.

Two tests pass: spindle drive raises the passive sleeve with only one actuator;
removing spindle drive lets gravity lower the arms and sleeve. The latter is a
short load-path counterfactual, not a collision-qualified unpowered mechanism.

```sh
node scripts/probe-ball-governor.mjs
node --test tests/ball-governor-physics.test.mjs
```

The report and source hashes are in `docs/validation/161-native-linkage.json`.
Raw trajectories remain in `/dev/shm/161-native-*.json`.

## Next work

Fit the source solids and smaller bevel pair, identify the lower collars/forks,
and qualify actual clearances. Calibrate speed/load and damping with the passive
linkage rather than forcing instantaneous equilibrium. Check transient and
longer-run behavior, timestep convergence and the drive/gear phase before choosing
an offline bake. Retain explicit assumptions about valve loading and engine
feedback. Then verify the source view, reasonable playback speed and browser
rendering before registration.

## Full-linkage calibration and settled response

The equilibrium speed now accounts for the masses of both upper rods, lower
links and sleeve. `equilibrium.js` differentiates gravitational potential U and
spindle-axis rotational inertia I along the closed linkage coordinate theta.
Steady speed satisfies omega² = 2 U′ / I′. Uniform-capsule moments include the
cylinder, hemispherical ends and their first/second moments; ball intrinsic
inertia is independent of theta and drops out of I′. This is a calibration of
the speed endpoints, not a prescribed dynamic arm trajectory.

The inferred masses raise low/high equilibrium speeds from 4.586/5.097 to
4.77339/5.30504 radians/s, about four percent. An independent virtual-work test
projects native generalized bias forces onto the closed linkage tangent at 12
spreads and finds residuals below 1e-6. Analytic capsule moments match compiled
native bodies to 1e-12. With link and sleeve masses removed analytically, the
formula reduces to the familiar point-ball equilibrium. The native spindle
controller now evaluates its reference at the current configuration time;
the old next-step reference gave an unnecessary initial acceleration even for
constant requested speed. At calibrated constant speed the native governor
holds the engraved spread within 1e-7 radians over 32 seconds, with only the
spindle actuated.

Two 1,600-second runs retain the original low joint damping and compare the
final cycles at 0.01-second phases. No damping increase or forced arm/sleeve
motion is introduced to obtain a loop. The final internal-coordinate closure
is below 8.1e-11 radians and velocity closure below 4.9e-10 radians/s. Maximum
connection error is 4.3e-8 world units. Halving timestep from 0.0005 to 0.00025
seconds changes spread by at most 1.796e-5 radians and sleeve height by
0.00004041 world units (0.00225 engraving pixels). This establishes a settled
passive-motion candidate under the stated ideal-joint and mass assumptions.

Spindle rotation advances 40.31373645 radians per eight-second speed cycle,
which is not an integer number of turns. Future playback must retain that
unwrapped increment rather than snapping the rotor to zero at the cycle seam.
The bevel input angle must retain its corresponding transmission ratio.

Even after settling, the instantaneous-equilibrium replacement is measurably
wrong: at the actual native spindle speed it differs by up to 0.009641 radians
in spread and 0.021445 world units in sleeve height (1.19 pixels). The native
settled spread range is 0.35987–0.60829 radians. Thus calibration removes the
incorrect initial force balance while retaining the physical transient response.

Five native/equilibrium tests pass. Reproduce the new evidence with:

```sh
node --test tests/ball-governor-equilibrium.test.mjs tests/ball-governor-physics.test.mjs
node scripts/settle-ball-governor.mjs
node scripts/review-governor-response.mjs
```

Reports are `docs/validation/161-settled-linkage.json` and
`docs/validation/161-equilibrium-response.json`. Earlier 32-second results above
record the original uncalibrated study. Production remains unchanged. Source
solids, the oversized bevel pair, real contact clearances and the interpretation
of the lower output forks/collars are now the next work before baking.

## Source-sized bevel candidate

The unregistered `mujoco-ball-governor/bevel-pair.js` replaces the oversized
candidate with a 34.5-pixel input outer radius (0.621 world units). A 36:30
pair fits the visible input annulus and wider output pinion; these tooth counts
are inferred, not authoritative historical dimensions. Both gears share a
perpendicular pitch-cone apex at the spindle and input center. Input and output
pitch radii are 0.599415 and 0.499512 world units, with a shared module of
0.0333008. Their face widths follow the visible narrow input annulus and deeper
pinion. The input construction axis faces the visible annulus toward the camera.

The teeth retain the shared back-cone involute approximation and conical ends.
Shared cap normals now follow the analytic cone instead of its triangulation,
removing triangulation-dependent shading bands without changing vertex positions.
Previously baked meshes retain their stored normals until regenerated. Both
candidate gear bodies have actual shaft bores and fog-free materials.

A 65-pose sweep over one tooth pitch checks 1,147 cross-gear mesh pairs using
bidirectional vertices, edge midpoints and triangle centers. Across 6,464,366
surface queries it finds no penetration beyond the 1e-6 world-unit tolerance.
The nearest sampled tooth-flank distance stays between 0.00002974 and
0.00003540 world units (0.00165–0.00197 engraving pixels), using a 0.0062-radian
working-phase offset. This is finite sampled clearance evidence for approximate
teeth, not an exact contact-force or continuous-collision proof. The pair is
scripted at its pitch ratio; no MuJoCo gear-contact solve is needed for this
ideal transmission. The input retains 30/36 of the unwrapped spindle travel.

Two candidate envelope/transmission tests and 20 shared bevel regressions pass.
Front and oblique Chrome views were inspected, and the private production build
passes. Reproduce the clearance report with
`node scripts/review-governor-bevels.mjs`; results and source hashes are in
`docs/validation/161-bevel-clearance.json`.

161 is still open: source-shaped arms, supporting hardware and output
forks/collars must be completed, clearances checked, and the settled native
motion baked and registered. This candidate does not yet change production 161.

## Registered native bake and visible reconstruction

161 now uses the baked native governor. The browser loads a 451,447-byte asset
containing 2,001 samples of the settled 1592–1600 second interval; it does not
load MuJoCo for this movement. The eight-second speed cycle retains the spindle's
40.313736454-radian advance and corresponding input-gear advance across every
loop. The internal-coordinate seam closes within 5.4e-11 and the native velocity
seam within 4.9e-10. At 2,000 intervening half-frame times, playback differs from
native coordinates by at most 5.96e-7 (radians for angles, world units for sleeve
height). Interpolation uses native joint coordinates, including the lower hinges,
rather than substituting an instantaneous equilibrium trajectory.

The 99 visible meshes include source-shaped head cheeks, bored arm eyes, elbow
pins, balls, sleeve barrel and conical shoulder, groove flanges, a nonrotating
output fork and lower forked support. Ordinary pin clearances and separate link
plate depths replace intersecting beam joints. The old rectangular steam-port
assembly is removed: the actual valve and remote fork connection are outside
the drawing. The output fork follows the unloaded sleeve groove in translation;
its remote support, valve load and engine feedback are not modeled. Rear cheeks,
bearing depth, fork depth and lower support tilt are inferred. Effective native
masses remain the calibrated values, not densities derived from the visible
stylized geometry.

The complete solid sweep covers 65 poses, 2,495 cross-family pairs and 12,730,288
surface queries across the settled spread envelope while the spindle turns twice.
It found and corrected interference between the sleeve shoulder and lower-link
eyes. The final sweep finds no unintended sampled penetration beyond 1e-6 world
units. Rigid joins within one family (head cheeks/hub, sleeve/crossbar, arm/ball)
are intentional; bevel-to-bevel clearance is covered by its separate report.
These are finite surface samples, not continuous collision proofs. The new
report is `docs/validation/161-solid-clearance.json`; its candidate status records
the geometry validation stage before registration.

Eight mechanical, equilibrium, geometry and native-coordinate tests plus two
baked playback tests pass. Playback tests also cover later-cycle bounds, the
unwrapped seam, exact restart and disabled fog. A private production build
passes. Bake inputs, source hashes, loop increment and closure evidence are in
`src/simulation/baked/assets/161.provenance.json`. Reproduce with:

```sh
node scripts/review-governor-solids.mjs
node scripts/bake-ball-governor.mjs
node --test tests/ball-governor-*.test.mjs
```

Packaged Chrome validation passes on desktop and mobile: animation changes the
render, restart restores it exactly, the scene loads no WASM, and there are no
page errors or horizontal overflow. Source, moving, oblique and mobile views
were captured outside the repository; the full spindle and lower support fit.
Thin plates use the explicit shadow bias already used by adjacent rebuilt
movements, with fog and the unrelated ground plane disabled.
