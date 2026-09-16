# Wool-comber roller, movements 217–218

Primary references: [217 caption and grooved cam](https://507movements.com/mm_217.html), [218 companion catch plate](https://507movements.com/mm_218.html). Both pages were checked for animation assets as well as the unavailable-animation banner: neither contains `ae.add_model` or `mm_present` setup. There is no official moving oracle on these pages.

The caption calls for one-third turn backward, two-thirds forward, then a dwell while the catch returns to another notch. The shared analytical motion retains those angles and the continuous cyclic cam input. The engraving shows roughly eight schematic notches; the existing reconstruction uses nine so the net third-turn advances exactly three notch pitches. The nine-notch choice remains an explicit reconstruction assumption.

## Finite hook correction

The former straight radial notches bound the finite hook during release. A 1,025-pose probe of the rendered solids found 0.01746 model units of penetration. An independent circle/outline calculation found approximately 0.01804 penetration, while the former diagnostic incorrectly reported positive clearance: it only measured distance to the root or plain rim and ignored the notch flanks. Holding the rocker still during lift retained approximately 0.01730 penetration, ruling out a simple timing adjustment.

Each replacement notch is a convex cutter envelope of the actual finite hook entry and exit arcs, with 0.002 model units of milling clearance. The hook radius and axial overlap are unchanged. `scripts/generate-wool-comber-notch.mjs` generates the 72-vertex profile offline; the browser repeats that small profile around the wheel. Generation is deterministic. The runtime diagnostic now measures signed distance from the hook circle to the actual wheel outline, including every finite flank.

The pocket retains working faces in both directions. Relative wheel take-up reaches them after −0.08560° or +0.09455°; their opposing reaction torque arms are respectively 1.26856 and 1.14896 model units, compared with the hook's 1.27 axle radius. Thus the relief does not remove the driving engagement. Ideal playback omits this approximately 0.18° total physical backlash.

## Validation

- 32,769 samples per plate retain at least 0.001895 circle/outline clearance through entry, engagement, release and return.
- Focused tests inspect both rendered hook/wheel solids in both directions at 257 poses per plate. No sampled intersection is found. A separate 1,025-pose 217 probe also checked the follower against both groove walls and the trip lug against its boss, with no sampled overlap.
- A negative control restores the old radial notch outline and detects over 0.017 penetration at the same release pose.
- Both load-bearing flanks are checked for bounded take-up and the correct opposing reaction moment; axial contact overlap remains finite.
- Browser review compared default/front/release views with both engravings. The suspended cam is no longer cut by the unrelated ground plane. A 65-pose check of actual visible vertices finds none outside the default camera frustum for either plate.

Run: `node --test tests/movement-217.test.mjs tests/movement-218.test.mjs tests/wool-comber-contact.test.mjs`.

## Remaining qualification limits

This is an analytical geometry correction, not a validated passive MuJoCo model. Output rotation, catch lift and return are still prescribed. In particular, the rear cam projection touches the catch boss only at the release instant; its finite profile has not been shown to supply the whole lifting stroke. Gravity/spring return, output holding torque during dwell, loads and real backlash remain unqualified. The groove wall relief and ideal follower motion are inherited. Tests cover the selected contact neighborhoods, not every frame, hub, shaft or attachment pair. A later passive contact study must resolve the trip actuator and holding behavior before claiming a physical reconstruction.
