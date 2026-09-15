# Movement 170 — crossed-arm governor (review open)

The existing model needs finite-joint reconstruction and a validated dynamic
response. An unregistered MuJoCo study now drives only the spindle; both ball
arms, upper links and axial output respond passively. No browser replacement
or production bake is registered yet.

## Source and existing model

The [source page](https://507movements.com/mm_170.html) has no working animation
script. Its defining feature is that the ball arms cross and extend upward to
two short links connected directly to the valve rod. There is no lower sleeve
sliding on the spindle. Preserve that topology and the bowed reference piece.

The existing factory measures the front engraving and imposes a spread angle
from the massless conical-pendulum equilibrium formula. It then forces all
visible links into that pose. This verifies neither loaded transient response
nor finite-body clearance. The added external frame, index decorations and
extended valve rod also need comparison with the simpler source silhouette.
The equal bevel pair remains to be checked at actual tooth surfaces.

The [97-pose selected-interface audit](validation/170-existing-contact.json)
makes 323,980 bidirectional visible-surface queries. It finds approximately
0.055 world units of central-pin intrusion into each arm, 0.1293 at each upper
wrist/link interface, 0.1294 at each output-pin/link interface, and 0.1165 between
the rotating collar and nonrotating clevis. This selected audit excludes gears
and does not certify the rest of the assembly.

## MuJoCo study

`mujoco-crossed-governor/physics.js` uses the existing source-derived arm lengths
as a starting point. Two spindle-carried hinges support the crossed arms.
Each upper wrist carries a passive short link whose far site connects to an
axially sliding output body. A single position actuator drives the spindle;
no actuator or prescribed trajectory controls spread or valve output.

The [native study](validation/170-native-study.json) runs eight cases for
16 seconds each, including timestep halving, constant speed, no spindle drive,
and heavier valve output. Masses and damping are inferred. The output slider
represents an ideal axial bearing above the spindle, not the lower sleeve
that the source specifically replaces. The study does not yet include the
nonrotating output bearing, finite collision contacts, bevel transmission or
steam feedback. Raw trajectories stay in `/dev/shm/170-native-runs.json`.

A 16% peak speed increase with weak damping produces excessive spread near
1.048 radians and upper-link branch reversal. Increasing output mass to 0.2
also permits the arms to exchange branches. Those cases must not be baked as
acceptable governor behavior. With zero spindle drive, arms swing through the
axis because no physical stops/contact surfaces are included yet.

A smaller 6% peak speed increase with arm damping 1 produces spread from
0.430707 to 0.810904 radians, output from 1.197512 to 1.716627 world units, and
maximum site closure error 1.20e-7. Halving the timestep changes sampled spread
by at most 5.80e-5 radians and output by 8.50e-5 world units. This is a promising
operating case, not yet a settled periodic or finite-contact qualification.
With heavier output under the same drive, peak spread increases to 0.858623.

## Remaining work

Fit the source silhouette and actual bored joints, reconstruct the rotating
to nonrotating output connection, and validate the bevel teeth. Qualify a
settled dynamic cycle with explicit load and drive assumptions, check all
visible solids through it, then bake the motion for browser playback. Runtime
MuJoCo is not necessary for the final viewer. Build, restart, full framing,
desktop/mobile and rendering checks follow registration.

```sh
node scripts/review-crossed-governor-existing.mjs
node scripts/probe-crossed-governor.mjs
```

Movement 170 remains open. The full 507-movement review remains active.
