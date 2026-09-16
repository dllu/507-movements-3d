# Movement 199: unqualified passive-rack study

Offline MuJoCo diagnostic only. **Do not use these samples for browser playback.**
Production retains its documented source-oracle law. The final timestep controls
fail position agreement and cycle repeatability despite reproducing nearly the
full source stroke. The finite prisms are convex decompositions of the existing
visible teeth; the full four pins are retained. Only the input hinge is actuated.

See `docs/partial-lantern-native-study.md` for controls, measured failures,
reconstruction assumptions and remaining work. `study-results.json` preserves
compact results and model hashes; large traces and XML stay outside Git.

From the repository root:

```sh
node scripts/study-partial-lantern-rack.mjs /dev/shm/199-native-base.json '{"duration":24}'
node scripts/study-partial-lantern-rack.mjs /dev/shm/199-native-half.json '{"duration":24,"timestep":0.0000625}'
node scripts/study-partial-lantern-rack.mjs /dev/shm/199-native-disabled.json '{"duration":16,"contact":false}'
node scripts/compare-partial-lantern-native.mjs /dev/shm/199-native-base.json /dev/shm/199-native-half.json /dev/shm/199-native-disabled.json /dev/shm/199-native-report.json
node --test tests/partial-lantern-native-study.test.mjs
```

The report requires finite samples, monotone input/time, two complete input
cycles in every control, identical starting input, a contact-disabled run with
zero contacts and no reversal, timestep agreement, cycle repeatability and
bounded contact penetration/input tracking error. Failed checks remain failures;
no bake is exported automatically.
