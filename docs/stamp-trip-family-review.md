# Stamp and trip hammer: 351 and 353

Primary references are Brown's [stamp 351](https://507movements.com/mm_351.html) and [first-order trip hammer 353](https://507movements.com/mm_353.html). Neither official page provides an animation. The 353 caption's reference to 72 is the site's correction of Brown's printed 74. This pass uses analytical working curves and existing components rather than tracing decorative outlines.

## 351: corrected lift and interfaces; release remains partial

The former box rack/trapezoid teeth are replaced with shared `rack-pinion-parts.js` involute and straight-rack profiles. A 25-degree pressure angle and addendum 0.1217761883 give nominal contact ratio one; initial tooth and rack phases are aligned to the six-pitch lifting interval. The pinion still has six consecutive teeth on a ten-position pitch circle. During the imposed lift, actual finite tooth surfaces clear by at least 0.0009063 model units, and a nearby upward-driving face remains within 0.0009397 throughout 129 sampled lift poses.

The shaft now passes through actual bores in the disk, hub and bearing. Guide front/rear lips clear the moving rod and rack teeth; the head's bevel no longer penetrates the workpiece. Brown's guides remain above and below the pinion. The six-pitch stroke is 3.4683 units, so the former head/collar passed through the lower guide. The smooth lower rod and head/anvil rest placement are extended downward by 3.2 units. Playback starts near the top of the stroke, matching the engraved head's proximity to its lower guide. The rod length and full-cycle travel are inferred; this is a phase interpretation of the source, not a claim that the original drawing literally contains the added dimensions. Full-cycle framing includes all travel.

**The release is not corrected.** After six-pitch lift, the retained gravity trajectory intersects the withdrawing final tooth. A finite diagnostic at raw cycle phase 0.64453125 measures 0.11293 penetration; the next tooth also has about 0.00273 entry interference near phase 0.97656. A bounded gravity-scale experiment did not make both transitions compatible and was reverted. Required drive faces were not hollowed away to hide this incompatibility. `reconstructionStatus` is `partial`, and the visible reconstruction note identifies both failures. A subsequent contact-driven reconstruction must revise the handoff, tooth withdrawal or timing; the current gravity/impact law is not validated passive motion.

`stateAtTime` includes the initial raised phase and matches playback. `stateAtUnshiftedTime` retains the unshifted analytical cycle for transition/energy regression checks; canonical display event times include the phase offset.

## 353: actual rounded tail, strike plane and journals

The existing finite radial-wiper/rounded-follower lifting law and compound-pendulum return are retained. The former helve corners protruded beyond their round follower into the wiper by about 0.0673. A tangent hull around the real circular wear nose now defines the working tail. The nose projects 0.02 beyond the helve's front cap to avoid coincident visible faces. Both actual helve and nose surfaces are checked against all four wipers.

The head had penetrated the anvil by about 0.055 because its drawn lower edge and bevel did not match the analytical strike point. Its finite lower face is trimmed to the actual impact plane, preserving the head/helve attachment. The shaft, fulcrum block, helve, hubs, bearings and supporting posts have genuine passages; a shorter cam hub and separated rear post clear the rotating wheel. Fog, ground slabs and floating contact markers are hidden. The full input revolution retains an 11.2-second minimum display cycle (2.8 seconds per blow).

The assumed mass model requires a positive lifting reaction throughout the radial-face interval: minimum approximately 100.076 in its chosen force units. The finite nose is within 0.0007252 of the working face. These are compatibility checks for the imposed lift and chosen masses, not validation of pickup impact, compliance, friction, real material density or rebound. Free flight retains the existing ideal compound-pendulum law; striking is perfectly inelastic. No new passive dynamics claim or MuJoCo validation is made.

## Verification and files

```sh
node --test tests/stamp-trip-working-parts.test.mjs tests/movement-351.test.mjs tests/movement-353.test.mjs
```

The 25 scoped tests cover existing kinematic/energy regressions, actual rendered finite surfaces, journal slices through long cylinders at thin eye planes, working-face proximity and torque sense, full-cycle bounds, stable geometry buffers and the visible tail-cap separation. Final log: `/dev/shm/stamp-trip-tests.log`.

Selected minima from the final 25-test run, including the separated helve/nose caps:

| Interface | Minimum sampled clearance |
| --- | ---: |
| 351 guides | 0.002224 |
| 351 shaft passages | 0.002871 |
| 351 engaged teeth | 0.0009063 |
| 351 striking face | approximately zero |
| 353 tail/wipers | approximately zero |
| 353 striking face | approximately zero |
| 353 moving/fixed support parts | 0.02000 |
| 353 shaft/fulcrum passages | 0.002852 |

These are sampled finite-interface checks, not continuous collision certificates. The 351 tooth sweep is intentionally qualified only during lift; its documented release diagnostic is not a test exemption masquerading as full-cycle clearance.

Production ownership is limited to `authored-stamps.js`, `authored-trip-hammers.js`, and the new dedicated `stamp-trip-working-parts.js`. Shared rack/plate/ring helpers are reused without modification. Final root source/default/oblique captures, including the separated 353 nose cap, show no browser errors or clipping (maximum normalized screen extent 0.908 for 351, 0.883 for 353). The visible nose no longer flickers. Packaged validation is recorded in the central progress ledger.
