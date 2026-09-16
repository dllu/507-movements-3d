# Watch regulator and compensation balance: 318–319

This pass repairs visible working interfaces while retaining the existing analytical demonstrations. It does not validate horological dynamics or material compensation.

## Source review

The official [watch regulator, 318](https://507movements.com/mm_318.html) uses a fixed outer spring stud, a staff-connected inner end, and two movable curb pins defining the active spring length. Rightward regulator motion shortens that length and raises the balance frequency. The official [compensation balance, 319](https://507movements.com/mm_319.html) places brass outside steel on two curved arms; warming draws their weights inward to compensate for thermal changes in the balance and spring. Neither official page provides an available animation. Both engravings were inspected alongside the final default/front/advanced browser views.

## Bounded corrections

**318:** the old .09-diameter round spring entered a .02-wide opening between curb pins. Its visible geometry is now a .014-wide flat ribbon, with actual finite clearance through that opening. A bored collet connects its inner end to the staff. The staff, wheel hub, and rear bearing have real bores/engagement and separated axial layers. The regulator has a solid annular bearing and mating ring rather than two zero-thickness disks. Their more compact diameter preserves visibility of the spring and better matches the source; the pointer joins the resized ring.

**319:** the staff and hub use bored geometry, the rear bearing is separated from the rotating hub and spring, and a collet connects the inferred rear spring. The main bar is split at the hub rather than filling the staff passage. Each weight has a real .42 × .44 rectangular passage around the two-layer arm, with a shallow clamp screw that clears the arm; the decorative solid “slot” is hidden. Both arms now project through their weights as drawn. Timing stems reach the main bar and their nuts have actual bores. The rear spring is a flat ribbon.

Both models hide the opaque background disks and ground, disable actual material fog flags, and use source-facing cameras. The regulator's authored 20-second cycle and the compensation balance's authored 8-second cycle remain unchanged; minimum display cycles are 20 seconds, preserving all relative motion. The visible spring and thermal response remain prescribed.

## Verification

```sh
node --test tests/watch-balance-interfaces.test.mjs tests/movement-318.test.mjs tests/movement-319.test.mjs
```

All **18 tests pass**. Existing tests preserve the regulator's active-length/rate relationship, both analytical motion laws and derivatives, compensation balance's ideal stiffness/inertia ratio, and cycle closure.

The new test uses the actual rendered triangle surfaces, querying vertices, edge midpoints, and triangle centroids at 65 equally spaced poses over each complete authored demonstration:

| Movement | Surface queries | Interfaces |
| --- | ---: | --- |
| 318 | 1,064,310 | Staff/bearing/hub/collet, regulator/fixed ring, every spring segment/both curb pins |
| 319 | 1,797,900 | Staff/bearing/hub/collet/main bar, every compound-arm segment/both weight passages and clamp screws, timing stems/nuts |

All 2,862,210 queries clear within a .00001 numerical penetration tolerance. The smallest sampled spring-to-curb gap is .000528 scene units. These are selected, one-way sampled surface checks, not a continuous global collision or force proof. Geometry IDs remain stable through repeated updates, and the fog/ground/background flags are checked.

Serial Chrome source comparisons, front views, and advanced poses produced no browser errors. Visible-vertex projection over the demonstration stayed within .821 NDC for 318 and .814 for 319. Rendered triangle counts including shadows were 30,792 and 15,928, with 264 and 498 draw calls. One Node construction measurement was approximately 51 ms / 21 ms, with 16,476 / 8,636 visible triangles before shadow passes. No physics or expensive profile generation runs in the browser. Bulk captures stay in `/dev/shm/watch-balance-final-*`.

## Residuals and assumptions

318 prescribes regulator travel and integrates an ideal changing frequency. The ribbon is deformed kinematically; its exact elastic shape, conserved strip length, curb contact forces, friction, energy supply, and amplitude dynamics are not solved. A small positive curb clearance is retained while the model treats the center between the pins as an ideal neutral point. This is an illustrative rate-regulation demonstration, not a validated free oscillator.

319 inverse-fits weight radius to preserve the assumed stiffness/inertia ratio. Its changing arm curves are not derived from brass/steel thermal strain or stiffness, and its spring softening law and temperature amplitude are illustrative. The mass model is retained and does not integrate the newly detailed solid geometry. The rear spring and collets are inferred connections, and the timing screws represent fixed settings without modeled helical adjustment contact. The larger watch bridge/support structure is outside the source detail and omitted. No MuJoCo solve is required for the retained prescribed DOFs; this pass makes no claim of validated governing dynamics.
