# 313 reduced passing-spring study — NOT QUALIFIED FOR PLAYBACK

This offline MuJoCo study isolates a passive detent slide and a passive hinged passing leaf. A kinematically driven jewel follows the production balance circle; neither passive joint is actuated. The leaf is represented by finite capsules at the authored rest shape. Its lower hinge limit represents the one-way backing nose. This is a reduced rigid-body surrogate for flexible springs, with inferred masses, spring stiffness and damping; it is not a validated material model or a simulation of the complete escapement.

The study runs at the four-second display cycle. It does not establish the original half-second physical-rate behavior. The escape wheel and locking stone contacts are omitted, so its motion must never be treated as a complete release/locking validation.

Reproduce from the repository root:

```sh
node scripts/study-chronometer-passing.mjs /dev/shm/313-native-base.json
node scripts/study-chronometer-passing.mjs /dev/shm/313-native-half.json '{"timestep":0.000125}'
node scripts/study-chronometer-passing.mjs /dev/shm/313-native-disabled.json '{"contact":false}'
```

All runs last three cycles. The disabled-contact control produces exactly zero detent displacement and leaf rotation. Contact-enabled runs produce substantial acting lift and independent return flexure, but their finite contact penetrates by about 0.0159. Halving the timestep leaves same-time maximum joint differences of 0.000575 displacement / 0.00175 rad and velocity differences of 0.117 displacement/s / 0.358 rad/s. The near-agreement of peak ranges is insufficient to qualify a bake. Compact measured results are checked in; bulk traces remain in RAM.

The preliminary geometric contact construction also failed: a minimum-displacement quasi-static branch snapped the detent home after the jewel passed the leaf end, interfering with the departing tooth. This is why geometric clearance alone was not substituted for passive release dynamics.

Production retains its existing prescribed leaf schedule. This pass only integrates the independently verified impulse-pallet return-clearance correction. Next work requires a physically supported leaf/backing contact model with qualified finite penetration, timestep agreement and complete wheel/lock handoff, before replacing production playback.
