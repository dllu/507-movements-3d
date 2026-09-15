# Movement 161 — centrifugal governor review in progress

161 remains open. Production still uses the authored governor; the new native
linkage is a diagnostic and is not registered.

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
