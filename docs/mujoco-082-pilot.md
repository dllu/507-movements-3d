# Movement 082: MuJoCo pilot

This branch provides a working, isolated replacement preview at
`mujoco-082.html`. The existing catalog route and the main agent's checkout
are unchanged. It reuses the 082 candidate's traced curved pawls, 26-tooth
ratchet, round-pin linkage and corrected small pulley. Both pawls contact
the wheel directly; there are no thin contact extensions.

## Run

```sh
npm ci
npm run dev
```

Open `/mujoco-082.html`. The preview has play/pause, restart, speed, orbit and
zoom controls. `npm run build` includes both the original application and
this preview. MuJoCo is loaded only by the separate preview entry.

```sh
node --test tests/mujoco-treadle.test.mjs
node scripts/probe-mujoco-treadle.mjs
PROBE_BASE_URL=http://127.0.0.1:5175 node scripts/capture-mujoco-treadle.mjs
```

The probe/capture scripts write temporary evidence under `/dev/shm` by default;
`PROBE_PREFIX` selects another output prefix. Generated output is not committed.

## Mechanics

MuJoCo 3.13.0 advances nine hinge coordinates at a 0.5 ms step. One position
actuator drives the lower treadle through a four-second cycle. The upper treadle,
two rods, two arms, two pawls and wheel respond through joints, contact and
constraints. The rod endpoints have closed pin constraints. A quartic joint
constraint approximates the existing equalizer linkage with maximum angular
fit error below 8.1e-10 radians over its working stroke.

The wheel and pawls use 27, 10 and 19 convex collision pieces, respectively,
derived from their rendered plate boundaries. Maximum sampled boundary
simplification is 0.1273 engraving pixels. Non-contact shaft bores are filled
in collision shapes; the contacting pawls cannot reach the wheel bore, and the
wheel cannot reach the pawl bores. Decorative hardware does not enter the
engine's contact solver. Body mass, center of mass and polar inertia come
from the existing meshes, with density normalized to unit lower-pawl mass.
The transverse inertias are approximate and do not affect the planar hinges.

The lower pawl falls away in the gravity-only trial. The working pilot adds a
visible passive torsion spring at its hinge (stiffness 4 and rest angle 0.45
in the model's normalized units). This is an explicit reconstruction assumption,
not a feature established by the engraving. The upper pawl closes under gravity.
Friction, damping, spring stiffness and the motor are illustrative parameters.

The finite-width strap follows the existing tangent/geodesic pulley path,
updated from the simulated treadle positions. Its pulley spin is the existing
rolling approximation. Belt material deformation, traction and capstan friction
are not simulated. There is no saved trajectory, periodic-state search,
prescribed pawl angle, or forced playback seam.

## Verification

The two focused tests pass, including a 60-second / fifteen-cycle simulation:

- Wheel advances 46.139 teeth; both pawls repeatedly engage and release.
- All 120,000 steps remain finite; maximum hinge step is 0.00260 radians.
- At 600 inspected numerical poses, maximum native pawl penetration is
  0.10277 engraving pixels; engine contact penetration is 0.09337 pixels.
- Finite strap triangles have positive clearance from a cylinder enclosing
  the pulley, with a minimum margin of 9.89e-7 world units.
- Maximum rod-pin separation is 0.00256 engraving pixels; maximum strap-length
  discrepancy is 0.00651 pixels.
- Restart and time-based seeking reproduce the same MuJoCo state.

The 60-second simulation plus its checks takes approximately six seconds locally.
This is a bounded, sampled validation, not a proof of all future clearances.

The production build passes. Vite reports the existing application chunk-size
warning and an externalized Node `module` import in MuJoCo's browser-guarded
loader. The built preview runs without browser errors. Ten final desktop,
mobile, motion, contact-detail and spring-side stills are inspected. The final
build also passes navigation back to the original twelve-card catalog page. An 8.233-second browser
run averages 30.0 fps on SwiftShader with a 2.7 ms 95th-percentile model update;
physical time advances at real-time speed. Earlier blank screenshot readbacks
were rejected; the final capture waits for settled frames and checks context loss.

## Integration boundary

`makeMujocoTreadle(mujoco)` returns the retained Three.js model, `advance(seconds)`,
`update(time)`, `reset()` and `dispose()`. The ordinary application can adopt it
after asynchronously loading MuJoCo for movement 082. Its engine must call the
model's `dispose()` to free the WASM model/data as well as the Three.js resources.
The standalone preview already handles that lifecycle.

This pilot demonstrates an engine-based alternative to the bespoke 082 solver.
It does not qualify the inferred spring or automatically migrate other movements.
