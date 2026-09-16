# Horizontal water wheels and turbines 433–435

Primary references: Brown's [horizontal overshot wheel 433](https://507movements.com/mm_433.html), [Fourneyron outward-flow turbine 434](https://507movements.com/mm_434.html), and [Warren central-discharge turbine 435](https://507movements.com/mm_435.html), with the local engravings. All three pages lack both `ae.add_model` and `mm_present`; there is no official animated construction for this group. The source identifies stationary inner guides and a rotating outer wheel for 434; 435 reverses that layout, with stationary outer guides and a rotating inner wheel.

## Bounded corrections

**433:** The broad horizontal boards are replaced by curved vertical vane walls, consistent with the working faces in the engraving. The existing outer catching lips remain. Both fixed bearings, the conical upper seat and overhead beam now have real shaft bores. The lower bearing previously intersected the rotating hub; it now sits beneath it on a connected pedestal, and the shaft reaches it. The original positive rotation and tangential jet interpretation are retained; the sparse caption does not independently establish an absolute speed or precise jet geometry.

**434:** The thin round tubes that represented guide vanes and runner buckets are now closed, finite-height curved walls. An annular runner backplate and four risers connect the working walls to the lower drive spider; its arms no longer extend across the opposite side of the rotor. Fixed guide and runner ring sections have finite radial clearance. The foundation has a real opening for the rotating hub, with a separate bored bearing and support bridge below. The central inlet, outward flow and clockwise runner interpretation are retained.

**435:** The fixed guides and runner buckets also become finite curved walls, with coherent stationary and rotating annular floors. The original runner's excessive radial blade depth obscured the open center seen in Brown; its inner radius is corrected from 0.68 to 1.45 against an outer radius of 2.14. Four spokes join the runner to its central hub. The discharge now descends through an annulus around the hub rather than through the solid disk, shaft and foundation. The foundation opening, lower bearing and support bridge preserve that route. The prescribed angular-momentum diagnostic changes with the corrected discharge radius; it remains a dimensional reconstruction, not a source-specified torque.

`horizontal-turbine-solids.js` reuses the finite plate and turned-section helpers for closed horizontal rings, bored supports and extruded centerline-offset vane walls. No manual ornament tracing, collision-mesh generation loop or live physics solver was added.

All three disable ground and material fog. Normal playback now uses the authored 5.4/5.6/5.8-second periods instead of compressing every revolution to two seconds.

## Validation and physical limits

```sh
node --test tests/movement-433.test.mjs tests/movement-434.test.mjs tests/movement-435.test.mjs tests/turbine-433-435-solids.test.mjs
```

The added checks inspect sampled moving surfaces against actual fixed guide, foundation, beam and bearing solids over 65 poses. They verify finite vertical working-wall height and check 435's annular discharge against the disk, hub, shaft and foundation. They are bounded sampled checks, not continuous collision proofs.

Flow tubes and moving markers are schematic directional overlays, not fluid particles constrained by the moving passages. Jet sharing, velocities, whirl and torque remain prescribed analytical diagnostics; pressure, free-surface evolution, leakage, efficiency, cavitation, inertia and load-dependent speed are not solved. The axial supports, wall thicknesses, clearances, count, dimensions and timing are inferred. Transparent water overlays may cross vanes during playback, and should not be interpreted as validated fluid-solid trajectories. MuJoCo rigid-body contact alone would not validate these hydrodynamic assumptions.

Final verification: **34 tests pass** (27 existing plus seven new), in 1.86 seconds. The three playback regressions exercise 300 repeated input-state queries, time-state queries and updates for each model, requiring unchanged scene descendant and geometry identities. They prevent recurrence of an accidental backplate allocation inside the turbine state functions caught during integration review. Default, plan and rear views were reviewed beside the engraving; 65-pose default-camera sweeps report zero outside vertices for every model. Review screenshots and metrics remain outside Git at `/dev/shm/turbine-433-*`, `/dev/shm/turbine-434-*`, `/dev/shm/turbine-435-*`, and `/dev/shm/433435-browser.log`.

### Production timing follow-up

The nineteenth pass found that the production display wrapper replaced the factory's target period with two seconds. These movements now explicitly preserve their reviewed 5.4–6-second cycle through `minimumDisplayCycleSeconds`; the actual production wrapper is covered by `tests/reviewed-cycle-timing.test.mjs`. Earlier cycle-duration descriptions referred to the authored motion, not the effective viewer speed before this correction.
