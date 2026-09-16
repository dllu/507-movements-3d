# Thermal air machine 469 and Hero rotor 474

Primary references: [469](https://507movements.com/mm_469.html), [474](https://507movements.com/mm_474.html), and their local engravings. The official pages were checked for both the unavailable control and absence of inline `ae.add_model` / `mm_present` definitions; neither supplies a 2D animation oracle. This pass preserves the source arrangements and existing disclosed analytical schedules, while correcting finite working parts.

## 469: screw, wheel and air passage

The spring-like tube was replaced with a closed, finite helical flight between the shaft and barrel. It reuses the shared screw thread generator, with the same lead and handedness as the existing transport law. The barrel is now a finite annulus. Its inclined passage through the cistern end wall has a shaped gland opening. A hollow tapered receiver joins the screw's lower end to the finite air conduit; markers now fit inside that conduit.

The 18/54 spur gears formerly occupied different axial planes. Their faces now overlap in one plane, and their tooth phases account for the actual line of centers. Standard module-based addendum/dedendum replaces the former oversized equal tooth depths. The wheel gear and wheel hub have real shaft bores, and six finite spokes connect the wheel hub to its blades/rims. The fixed axle remains supported at the rear cistern wall.

**Update:** the former smooth, toothless bevel cones have now been replaced by a finite, common-apex miter pair. See the [469 bevel follow-up](thermal-air-469-bevel-review.md) for placement, tooth phasing, clearance measurements and remaining analytical-load limitations.

The existing temperature run-down, stop and external reset remain an illustrative schedule, not a heat-transfer simulation or a prediction of self-running operation. Brown explicitly leaves temperature maintenance unexplained. Air compression, hydrostatic head, bubble slip, drag, sealing, passive starting torque and water occupancy are unsolved. The 13.8-second minimum display cycle is now enforced.

## 474: real steam passages and rotary supports

The boiler is a finite closed-bottom shell with feed holes in its lid. Both risers have open bores, narrow through reducers into coaxial fixed necks, and feed the rotating globe through bored trunnions. Bored stationary collars clear the rotating trunnions. The globe is a finite hollow shell with six actual ports: two axial feeds and four nozzle entries. Six annular spherical patches create the shell without runtime mesh boolean operations.

The prior nozzle bend reversed too tightly and obstructed its own bore when given finite thickness. Each nozzle now has a straight entry and a genuine radius-0.30 quarter-circle elbow terminating at the original tangential outlet. The globe ports align with those offset entries, and the decorative equatorial band is interrupted at the passages instead of plugging them. Steam cores and markers follow the revised paths. The four outlet positions, jet directions and opposite reaction direction remain unchanged.

The displayed steady speed still comes from the pre-existing algebraic momentum balance with assumed pressure, nozzle area and effective drag. It is not a validated fluid simulation or measured source speed. Boiling, transient inertia, pressure losses, rotary seals, leakage and useful load remain unsolved. Playback now has a six-second minimum cycle for readability, distinct from the calculated 0.96563-second illustrative physical period.

## Checks

`node --test tests/movement-469.test.mjs tests/movement-474.test.mjs tests/thermal-steam-469-474-solids.test.mjs`: **28 tests pass**. Added checks cover state/update geometry stability, finite bore paths, sphere ports, shaft/support clearance, gear phase/plane, display timing and no fog/ground.

Sampled rendered-solid minima:

| Interface | Minimum separation |
| --- | ---: |
| 469 spur pair, 97 poses | 0.00000351 |
| 469 inclined barrel / gland wall | 0.02970 |
| 469 fixed axle / wheel gear bore | 0.004495 |
| 474 fixed neck / rotating trunnion, 25 poses | 0.005978 |
| 474 rotating trunnion / stationary collar, 25 poses | 0.003959 |

A separate 3,936-point section audit around the four nozzle bores through the sphere found minimum clearance **0.00623**. The direct tests also check that nozzle centerlines clear their pipe walls, spherical shell and decorative band, and that the boiler feed holes are open.

Final browser default/front/rear comparisons with both engravings found zero clipped vertices over 65 poses, including the corrected elbow and wheel spokes. Both models retain finite working-part improvements with no live solver or per-frame geometry allocation. Bulk review artifacts remain in `/dev/shm`.

These are bounded sampled checks, not exhaustive collision or pressure-vessel certification. Pipe junctions, glands and rotating seals are visual mechanical reconstructions, not validated leak-tight joints; water/steam volumes remain explanatory overlays.
