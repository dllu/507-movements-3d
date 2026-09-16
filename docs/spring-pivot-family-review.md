# Pendulum saw and spring-assisted mechanisms: 378, 416, 420

This bounded pass corrects visible working interfaces and preserves the existing analytical linkage laws. It does not validate cutting forces, spring-driven motion, impact, or elastic bell vibration.

## Primary sources and motion references

- [378, pendulum saw](https://507movements.com/mm_378.html): the caption specifies a pendulum-driven saw cutting a lying tree. Its page contains both `mm_present` and `ae.add_model`; the existing source reconstruction follows the official small pendulum swing, constant-length rod, horizontal bow saw, vertically fed U carriage, and two counterweights. The existing three swings per downward feed are retained; the smooth return feed is a reconstructed repeating demonstration.
- [416, spring-assisted treadle](https://507movements.com/mm_416.html): spring A assists crank B at its dead centers. The engraving places the anchored spring beside the flywheel and attaches its free end to the crank pin. The page has no inline animation model. The visible spring is reconstructed as a broad planar expanding curl around its lower fixed anchor, matching the engraved loop instead of the former narrow straight coil. Spring rate, bidirectional tension/compression characteristic, neutral length and terminal leaf deformation remain explicitly inferred.
- [420, bell hammer](https://507movements.com/mm_420.html): the spring below the hammer raises it clear after striking, allowing the bell to vibrate. The page has no inline animation model. The engraving supports an external hammer, underside spring, and separate bell. No actuator or impact law is supplied.

Local engravings were inspected directly. Availability was checked from inline model scripts, not merely the initial unavailable CSS class.

## Corrections

**378.** The former radius-0.315 rope wraps did not join radius-0.300 straight legs and lay 0.13 ahead of the pulley plane. Radius-0.300 wraps and circular straight ropes now share the actual groove plane. Closed grooved rims, bored hubs and fixed bored support tabs carry the ropes. The connecting rod now has two finite eyes and extended pins. Two separated rails behind the bow provide an open horizontal pin guide, replacing a solid bar through the sliding pin. The pendulum pivot has a real hub bore and journal.

**416.** The pitman formerly ended as a solid cylinder at each pin center. A constant-length bored link now engages both pins; its plane clears the crank arm. Spring pivot eyes and a finite planar curled strip replace coil ends crossing the pins; its short terminal leaf bends smoothly to reach the moving eye. The spring is separated axially from the pitman and is supported by an anchored standard. Bored crankshaft/treadle journals and a bored hub connect the crank arm to the flywheel. The exact crank-rocker closure and positive quasi-static spring assistance at both dead centers are unchanged.

**420.** The rendered striker was 0.12 ahead of the state position, while the bell was another 0.40 behind the hammer plane. Both now share the actual contact plane. Bell placement uses the finite lip tube plus striker radius, and the published clearance measures the rotated lip rather than a projected X line. The rectangular head remains behind its contact face. The spring shoe now sits below the arm with 0.00020 clearance instead of inside it; its heel reaches the leaf. The bell has a closed 0.055-thick wall, and the hammer has a bored hub and bearing. Its fixed post now actually reaches the overhead crossbar.

Ground and material fog are disabled. Production minimum display cycles are 14.4 seconds for the saw's complete six-swing feed loop, 6 seconds for the treadle, and 4 seconds for the hammer. These use `minimumDisplayCycleSeconds`, so the global display timer cannot compress them to two seconds.

## Checks and measured results

`tests/spring-pivot-family-solids.test.mjs` samples actual triangles in both directions across full cycles, plus the exact hammer strike pose. This is a bounded interface audit, not an exhaustive all-pairs collision certification. Long pin surfaces are checked in both directions because their end/edge samples may miss the eye's axial plane.

| Interface | Measured minimum clearance (model units) |
| --- | ---: |
| 378 rope / grooved rim | +0.0000382 |
| 378 pendulum pin / connecting-rod eye | +0.01285 |
| 378 saw pin / connecting-rod eye | +0.002852 |
| 378 pendulum shaft / bored hub | +0.002925 |
| 416 crank and treadle pins / pitman eyes | +0.003839 |
| 416 crank pin / spring eye | +0.003841 |
| 420 striker / bell lip, closest sampled finite surfaces | +0.000915 |
| 420 spring shoe / arm | +0.000200 |
| 420 pivot pin / hammer hub | +0.002871 |

The smooth sphere/torus contact law reaches zero at the strike; tessellation leaves the small positive finite-mesh gap above. The lip reaction has the correct opposing moment (greater than 0.8 per unit normal force), and the upward spring reaction gives a positive return moment throughout the stroke. Pin/eye checks also require finite axial overlap, avoiding a false clearance result from disconnected parts. The saw guide's nominal radial allowance is 0.005; its two separated rails retain axial engagement with the pin.

The 6 new tests cover these interfaces, rope tangency, closed bell wall, support bores, finite axial engagement, force-direction geometry, stable object/geometry identities, and readable timing. All 28 existing movement tests also pass after replacing obsolete scaled-cylinder endpoint assumptions and the spring pad's old centerline-radius assertion. Final command:

```sh
node --test tests/spring-pivot-family-solids.test.mjs tests/movement-378.test.mjs tests/movement-416.test.mjs tests/movement-420.test.mjs
```

The final integrated source/default/oblique browser checks pass without errors or clipping. Maximum normalized screen extents are 0.869/0.917/0.866 for 378/416/420. The final source review includes the planar curl and connected bell crossbar; packaged results are recorded in the central ledger. All 34 scoped tests pass after these source corrections.

## Remaining physical assumptions

- 378 retains prescribed pendulum and feed inputs. Rope elasticity, slip, counterweight acceleration, cutting resistance, and wood removal are not solved. The blade entering the unremoved log is an intentional cutting illustration, not validated solid contact.
- 416's spring force and energy are quasi-static readouts of prescribed crank rotation. The planar curl has a prescribed bending terminal and reused geometry buffers; it is not an elastic-strip or buckling solution. Its lower source-positioned anchor preserves positive ideal assistance at both dead centers. This pass validates named joint clearances, not the torque required from a person's foot or a free flywheel.
- 420's compact pulse has zero speed at its closest approach. It demonstrates approach, contact, and spring return; it is not an energetic impact trajectory. The subsequent small rigid bell rotation is a display cue for vibration, not a solved elastic shell mode. Hanger elasticity and its loaded contact are not certified. Actuation, spring force history and ringing dynamics remain reconstruction assumptions.

No MuJoCo bake was introduced: the corrected geometry is analytically constrained, while validating the outstanding elastic/contact dynamics would require a separate bounded physical model.
