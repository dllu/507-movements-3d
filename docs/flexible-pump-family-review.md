# Pump family 452–454: finite working-part review

Primary sources: [452](https://507movements.com/mm_452.html), [453](https://507movements.com/mm_453.html), [454](https://507movements.com/mm_454.html), and the matching local engravings. All three pages mark animation unavailable and contain neither `ae.add_model` nor `mm_present` scripts. No official motion oracle was available. Dimensions and rates remain reconstructed.

## Changes

**452 — double acting pump.** The upper cylinder cover and stuffing box now have a continuous rod bore. The finite barrel wall fits the piston sealing rings instead of leaving a large radial bypass. Four barrel ports and matching manifold openings feed separate valve chambers. The check seats are flat annuli that meet the closed disks; branches now enter below each seat and exit above its moving disk, rather than carrying an uninterrupted narrow pipe through it. Valve chambers were moved outward to clear the barrel. The original four-valve sequence is retained: upper suction and lower discharge on descent, lower suction and upper discharge on ascent.

**453 — opposed lantern bellows.** The beam has a finite bored fulcrum boss. The fulcrum axle reaches its rear standard. Both connecting rods have bored eyes around actual transverse pins, and raised clevises on the moving top plates clear the lower eyes. Each rod retains its constant 1.18 length; the top plate lies 0.29 below its pin. The bellows' flexible lateral offset follows the beam-pin arc. The common discharge riser now passes behind the rocking beam. Bellows floors and the valve-chest floor have openings; the chest has finite sidewalls. The delivery checks move away from the bellows floor edges, and routed branches clear all four disks. Flat seats meet the closed checks.

**454 — diaphragm pump.** The curved lever has a bored fulcrum boss and finite planar body; the link has bored eyes and matching pins. A raised center clevis keeps the lower eye clear of the diaphragm clamp while retaining the exact constant-length linkage. The diaphragm center is 0.20 below the lower pin. The clamping annulus now reaches the membrane edge, the chamber floor has a real suction opening, and the chamber wall has a delivery opening. Both flap seats contain working apertures and hinge reliefs. Their finite enlarged chambers and shortened pipe ends clear the complete flap swing. The suction and delivery strokes retain the source order.

The shared scoped helper reuses `finite-fluid-passages.js`, `horizontal-turbine-solids.js`, `finite-plate-geometry.js` and `bored-planar-link.js`. Geometry is constructed once. Viewer ground and material fog are disabled. `minimumDisplayCycleSeconds` preserves readable 4.9/5.4/5.1-second cycles through the common playback wrapper. Default fit bounds include the full foundations and rod strokes.

## Validation

```
node --test tests/flexible-pump-452-454-solids.test.mjs tests/movement-452.test.mjs tests/movement-453.test.mjs tests/movement-454.test.mjs
```

40 checks pass. The new tests compare actual moving triangle-surface samples with finite stationary solids at 65 poses, including transparent chamber/pipe walls. Separate 128-pose tests verify both rod-eye centers against the actual pin axes and check the links against their moving levers and plate clevises. The tests also verify the continuous stuffing-box bore and preserve every scene object/geometry identity across repeated state queries and playback.

Chrome source/default, front and reverse-oblique views were reviewed. The final default framing sweeps contain every visible vertex at 65 poses for all three models. A final fixed-axle extension in 453 closes the rear-standard gap without changing motion. Bulk screenshots and audit logs remain in `/dev/shm`.

## Qualifications

These are finite geometry and prescribed-kinematics corrections, not solved pumps. The analytical piston/link/beam constraints remain deterministic. Valve lifts/flap angles follow scheduled stroke lobes; no pressure, inertia, spring, impact or cavitation model determines them. The 452/453 vertical lift checks are retained reconstructions of the engraved valve action, which depicts flaps.

Bellows skins and the diaphragm remain prescribed thin rendering surfaces; material thickness, elastic stresses, buckling and fatigue are not solved. The water volumes and tracers are schematic. In particular, 454's average-height water cylinder does not conform to the local membrane profile. The port and valve clearances do not constitute a watertight or pressure-qualified network: rectangular port transitions, junction unions, hinge leakage and seals require a separate hydraulic/manufacturing treatment. 452 still neglects piston-rod area in its equal-area fluid model.

The collision tests are sampled regressions over selected working pairs, not an exhaustive intersection proof. No MuJoCo model was added because these corrections concern determined linkage geometry and prescribed fluid illustrations; rigid-body contact alone would not validate flexible-wall pumping or hydraulic pressure behavior.
