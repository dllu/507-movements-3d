# Water lifting family 441–443

Sources: [Persian wheel 441](https://507movements.com/mm_441.html), [Eisach pot wheel 442](https://507movements.com/mm_442.html), [stream-driven screw 443](https://507movements.com/mm_443.html), and their local engravings. None of the fetched pages contains `ae.add_model` or `mm_present`; all mark their animation control unavailable. The captions establish water-lifting topology, but provide no dimensions or operating rates.

## 441 — finite trip and receiver follow-up completed

The initial pass supplied hollow float channels, finite bucket walls and suspension bores, extended shaft journals and a bed below the bucket sweep. Its unresolved lug/pin and receiver intersections are superseded by the [441 trip and receiver review](persian-bucket-trip-review.md): a finite side shoe now follows round-pin tangency, and the receiving trough clears the moving parts while collecting the rendered discharge paths. Passive impact/swing and fluid behavior remain explicit approximations; this is a qualified geometric reconstruction, not a complete dynamics model.

## 442 — finite wheel and receiver corrections

The axle now passes through a real bore in the hub and through finite bearings; spokes have axle reliefs. Bearing frames and the rotation index clear the moving assembly. Pots lie inside the supporting rims, rather than projecting almost a full pot depth beyond them. The wheel uses a rear spoke plane, leaving the front face open for an axial receiving trough. Its receiver crosses the front rim plane inside the rim and stops short of the rear spokes. This is an explicit reconstruction choice that supplies a finite clear path for the stationary receiver.

Pot water is clipped to the rotating rectangular compartment beneath a horizontal surface using the existing fixed-buffer helper. It no longer crosses the floor or sidewalls. The stream bed clears the full pot sweep. Receiver dimensions, filling, drainage and discharge markers remain illustrative: this is not a fluid-volume/slosh solution or a proof that every rendered stream lands in the receiver. Passive current-driven torque is not solved.

## 443 — finite screw passage and supports

The zero-thickness ribbon is replaced with a closed, finite helical flight using the existing solid-thread builder. Its inner edge joins the shaft and its outer edge joins the inner casing radius; the former radial bypass gaps are removed. The rotating casing has finite walls and open axial ends. Fixed bearings clear the casing and longitudinal rotation index, and finite bridges connect them to the outboard posts. The receiver clears the complete rotating envelope. The river bed clears the lower paddle sweep.

The screw and its stream wheel remain one prescribed rigid rotor. Water-pocket positions, pickup, ascent and discharge are illustrative schedules. The schematic pockets are not finite fluid volumes constrained against the flight, and no sealing losses or available hydraulic torque have been calculated. The finite wall changes do not establish a working fluid-dynamics model.

## Playback and checks

All three hide the viewer ground, disable fog and retain structural supports. `minimumDisplayCycleSeconds` enforces 12 seconds for 441/442 and 11 seconds per shaft revolution for 443; setting only target timing metadata would be overwritten by the shared display wrapper. The screw's five-revolution transport illustration therefore lasts 55 seconds at nominal playback.

Run:

```
node --test tests/water-lifting-441-443-solids.test.mjs tests/movement-441.test.mjs tests/movement-442.test.mjs tests/movement-443.test.mjs
```

38 tests pass, including repeated state/update object and geometry identity checks, sampled finite moving-vs-fixed clearances for 442/443 and the bed/support subset of 441 (the follow-up adds the trip and receiver tests), 442 water containment, 443 flight/casing radial closure, and open 441 hub ports with retained channel floors. Clearance tests sample actual triangle surfaces over 65 poses; they are regressions, not exhaustive collision proofs.

Chrome source/default, front and reverse-oblique views were reviewed. Full-cycle default framing sweeps contain all visible vertices. Bulk captures and diagnostic logs stay in `/dev/shm`. No new live solver or native process is used; the remaining unknowns concern trip contact and fluid behavior, not a reason to label scripted playback as solved physics.
