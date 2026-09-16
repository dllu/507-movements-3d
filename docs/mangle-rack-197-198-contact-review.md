# Mangle racks 197–198: finite working profiles

The [197 caption and engraving](https://507movements.com/mm_197.html) require an eleven-pin rack with a rising/falling pinion shaft. [198](https://507movements.com/mm_198.html) fixes that shaft and suspends the closed toothed rack on two rods. Both pages register their matching `ae.add_model` and set `mm_present`; their unavailable CSS class does not indicate a missing animation.

The existing distinction is retained: 197 has isolated round pins and a three-turn capsule cycle; 198 has 36 connected rack-tooth sectors, a six-tooth pinion, and exact two-rod closure through a five-turn mechanical cycle. The source animation for 197 uses a +3-turn rotation in its Y-up coordinates. The initial finite-profile pass retained clockwise playback; the fortieth pass corrects playback to the source's counterclockwise direction. The engraving-aligned initial pose is retained. 198's source defines a −2.5-turn input with a half-rate guide path; its complete mechanical closure spans five turns. No source tooth contours were traced or copied.

## Working correction

The previous actual-surface witnesses penetrated by **0.10275282** in 197 and **0.10282703** in 198. Nominal rolling equations did not detect either error.

- **197:** An offline full-radius pin cutter produces a tenfold-periodic pinion. All eleven radius-0.09 pins remain, with substantial ten-tooth pinion material between radii **0.578001** and **0.815510**. The dark pin rims now sit within the pin diameter instead of intruding as larger uncut teeth. Both end guides and the bored shaft collar share a real front working plane, clear of the pinion. Finite mounts connect those guides to the frame. The shaft slider is bored and clears its vertical slide rails.
- **198:** The actual six-tooth pinion cuts the entire inner boundary of the closed rack offline, including both terminal turns. The 36 finite sectors join a continuous root land; this remains a closed toothed rack, not a row of replacement pins. The original finite pinion outline is retained, with a real shaft aperture. A **0.00008** normal-direction finishing offset closes a small discretization defect at a terminal corner; enlarging only radial clearance would be ineffective on steep flanks.
- **198 interfaces:** The rear plate and slot rim now have an opening wide enough for the actual fixed shaft. The central tie sits in front of the shaft end and connects through end mounts. Suspension rods have bored eyes with reaching pins. The fixed shaft bearing is behind the moving plate. Guide wheels have bored hubs and clear the finite frame-rail thickness; their small tread indicator no longer sets an oversized contact radius.

Both mechanisms retain their prior analytical motion laws and source arrangement. Expensive profile construction is baked; playback only changes transforms. Materials disable fog, the ground is hidden, the minimum display cycle is nine seconds, and swept actual vertices determine framing.

## Validation

```sh
node --test tests/movement-197.test.mjs tests/movement-198.test.mjs tests/mangle-rack-working-contact.test.mjs
node scripts/generate-mangle-rack-working-profiles.mjs --check
```

**19 tests pass:** ten unchanged source/kinematic regressions and nine new finite working-contact/interface checks. The retained regressions cover 32,769 kinematic states per mechanism. The new independent geometric audit uses 257 poses, all four operating branches, finite segment/circle or segment/polygon distances, and actual float32 extrusion coordinates. Separate rendered-triangle checks revisit the two original penetration witnesses.

| Movement / branch | Minimum separation | Largest nearby driving-face separation | Minimum resisting moment per unit force |
| --- | ---: | ---: | ---: |
| 197, either straight run | 0.00033061 | 0.00098541 | 0.65758 |
| 197, either end turn | 0.00033055 | 0.00033055 | 0.65758 |
| 198, either straight run | 0.00008461 | 0.00049965 | 0.26942 |
| 198, either end turn | 0.00005402 | 0.00045676 | 0.31464 |

197 is conservatively checked against complete circular pins, enclosing their rendered polygonal cylinders. 198 has no positive-area intersection between opposing finite working outlines. The nearby contact normals oppose each pinion's input on every sampled branch (197 now counterclockwise, 198 clockwise); close but torque-free faces are not accepted as driving witnesses. The small manufacturing/profile clearances remain explicit, rather than claiming that separated surfaces already exert contact forces.

Additional checks cover 197's collar/guide depth overlap and **0.008** end-guide running clearance, the slider's real bore, 198's shaft passage clearance above **0.0088**, front tie/end-of-shaft clearance above **0.0449**, bored suspension and guide-wheel journals, frame/roller clearance, stable descendant/geometry identities, and 65-pose visible-vertex framing.

The generator's `--check` regenerates in memory and compares the complete serialized output without writing. The final bake reproduces byte-for-byte; SHA-256:

`fa6f4d52b660fb89ff6af8fccfa0d2d400268ec4243e8227e42411422187cc50`

Parent source/default/oblique browser review reported no errors or clipping, with maximum NDC **0.91145** (197) and **0.87603** (198). Screenshots are RAM artifacts at `/dev/shm/family39-first-{197,198}-{default,oblique}.png`.

## Remaining assumptions

These are finite geometrically compatible profiles under prescribed rolling and linkage closure, not load-validated dynamic simulations. Motor torque, clearance take-up, guide reactions, friction, compliance, and passive branch selection are not solved. 197's guide clearance can permit a small loaded trajectory change; 198's reconstructed suspension assumes rigid links and ideal hinges. Sampled finite checks do not establish an exhaustive arbitrary-load collision proof. A later native study should use these corrected visible/contact profiles if loaded pickup or guide behavior needs validation.

Source engravings leave out several support depths; their axial arrangement is reconstructed. No claim is made that the nominal pitch-contact marker alone proves working contact.


## Fortieth-pass direction follow-up

The current [source animation](https://507movements.com/mm_197.html) registers
three positive rotor turns. Its library uses a positive counterclockwise
rotation matrix and flips canvas Y to display Y-up model coordinates. Movement
197 now advances the rotor by `+6π` per rack cycle and traverses the same guide
path in reverse. Canonical times, rack/shaft velocities and speed metadata are
updated consistently. No tooth, guide or source-pose geometry changes.

The profile audit checks the newly loaded side, with maximum nearby driving
clearance `0.00098570` and opposing moment magnitude at least `0.65758`.
The original penetrating witness is checked at its complementary cycle time.
All **20 affected checks pass**, including unchanged 198 regressions and a new
independent finite-difference check of translational and rotational derivatives.
The offline generator deliberately retains its clockwise sampling order so the
same geometry asset reproduces byte-identically regardless of playback direction.
Default/oblique browser inspection reports no errors or clipping (NDC `0.91145`).
This closes the direction discrepancy; the prescribed-load limitations above remain.
