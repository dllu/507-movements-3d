# Unqualified 390 flywheel/pawl dynamics study

This is an **offline diagnostic**, not the browser implementation and not an
approved bake source. Production retains the finite geometric pawl motion from
`dual-band-pawl-contact.js`. The saved timestep controls fail to reproduce the
same pickup trajectory; do not replace that playback with these samples.

Two position servos supply the open/crossed carrier angles. The flywheel and both
pawl hinges are unactuated. The model includes gravity, inferred pawl torsion
springs, seating pegs, flywheel inertia, a viscous resisting load, and finite
outer tooth cells. Arm capsules conservatively cover the visible curved pawls;
finite toe cylinders meet the asymmetric ratchet outline. Shaft/pawl journals
are ideal hinges; their visible bores were checked in the prior geometric pass.
The normalized masses, inertias, springs, damping and numerical contact margins
are reconstruction assumptions, not measurements from Brown's engraving.

Initialization starts at a zero-speed reversal, with the pawls and wheel placed
outside the virtual stop/flank contact preload. Starting a maximum-speed carrier
against a stationary wheel, or starting overlapping contact margins, injected a
large unwanted startup impulse in earlier trials. Correcting those defects was
necessary but did not fix the remaining timestep sensitivity.

Reproduce the final controls from the repository root:

```sh
node scripts/study-dual-band-flywheel.mjs /dev/shm/390-native.json '{"duration":24}'
node scripts/study-dual-band-flywheel.mjs /dev/shm/390-native-half.json '{"duration":24,"timestep":0.000125}'
node scripts/compare-dual-band-native.mjs /dev/shm/390-native.json /dev/shm/390-native-half.json /dev/shm/390-native-comparison.json
node scripts/audit-dual-band-native-solids.mjs /dev/shm/390-native.json
node scripts/study-dual-band-flywheel.mjs /dev/shm/390-native-disabled.json '{"duration":16,"contact":false}'
```

The comparison script deliberately records a failed qualification rather than
silently producing a bake. `study-results.json` stores the final model hashes,
options and compact metrics. Full samples/XML remain RAM review artifacts. The
contact-disabled switch removes only wheel transmission, retaining the pawl
stops; an earlier control produced exactly zero output advance. The final model's
configuration and nonpenetrating initialization are covered by
`tests/dual-band-native-study.test.mjs`.

See `docs/dual-band-native-study.md` for the failed control numbers and
bounded follow-up. A visually plausible coast, positive clearance, similar
average speed, or a transient apparent repeat are insufficient bake validation.
