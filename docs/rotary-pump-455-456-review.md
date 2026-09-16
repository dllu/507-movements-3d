# Rotary pumps 455–456: finite working parts review

Primary references: [455](https://507movements.com/mm_455.html), [456](https://507movements.com/mm_456.html), and the corresponding local engravings. Both official pages were checked for the unavailable control **and** absence of inline `ae.add_model` / `mm_present` animation definitions. Neither supplies an animated oracle. Dimensions, operating rates, depth and contact-law details are reconstructed.

## 455 — useful solid corrections; contact reconstruction remains partial

The source shows two hinged vanes, a lower inlet, upper outlet and a fixed lower-side abutment that folds each passing vane. This pass adds bored hinge eyes, rotor relief and finite supporting cheeks, shaft bores through both covers, actual casing port openings and open inlet/outlet walls. The lip uses the housing circle on one side and its hinge-sweep envelope on the other, so its finite trailing corner clears during initial folding. The six-second minimum display cycle is enforced; scene fog and ground are disabled.

The folding schedule and fixed abutment are **not mechanically validated**. The previous abutment profile was evaluated at the hinge angle, although the folded tip is at another polar angle. A bounded 361-pose rendered-surface audit finds blade/abutment penetration of **0.22758 model units at phase 0.22778**, and lip/abutment penetration of **0.23727 at phase 0.22778**. Do not count this movement as contact-corrected. Resolving it requires a compatible abutment and finite vane contact law, including release/return; simply carving away the complete sweep would not establish a load-bearing closing surface.

The corrected hinge eye clears the relieved rotor by at least **0.00394**, and the lip clears the casing by at least **0.0000556** in the same audit. These are sampled render-geometry measurements, not exhaustive collision guarantees. The regression caps the outstanding abutment penetration at 0.25 without requiring the failure to persist.

## 456 — finite cam, slider and port correction

The old sinusoidal radius reached the housing at only one angle, leaving a large gap through the working arc; the finite roller overlapped the nominal cam, and the solid drum annulus blocked both sliders. The discharge also crossed the working annulus.

The reconstruction now uses a circular working dwell, a 24-degree half-width retracted dwell around E and 40-degree quintic transitions on each side. Those widths are inferred, not supplied by Brown. The stationary cam is the inward normal offset of the **roller-center** path by the actual 0.11 roller radius. Thus the sliding piston crosses E while its opposed piston remains fully extended, as the caption requires. The constant-radius sum of the former sinusoid was removed from the assertions; it is not a source requirement.

The fixed cam and cover have axle bores. The drum has real opposed radial slots, and a rear spider connects it to axle A while clearing the stationary cam axially. Curved piston heads fit the casing with a small mesh tolerance. F and M have casing openings; the finite hollow discharge leaves M radially and turns outside the working cylinder. The inlet shell is open rather than a transparent solid plug. The 6.2-second minimum display cycle is enforced, with fog and ground disabled.

A 181-pose finite surface audit checks each piston blade, roller and sealing head against the stationary cam, slotted drum, separator E and casing, plus the head against discharge H. All tested pairs clear. Representative minima are blade/cam **0.03213**, blade/drum **0.055**, head/drum **0.005**, head/E **0.03326**, head/casing **0.0000566**, and roller/cam approximately **0.0000052**. A separate 360-angle check keeps the analytic normal-offset contact within 0.00002 of the rendered cam mesh. Sampling does not prove every possible solid pair or exact tangency between samples.

## Validation and remaining assumptions

`node --test tests/movement-455.test.mjs tests/movement-456.test.mjs tests/rotary-pump-455-456-solids.test.mjs`: **26 tests pass**. Tests cover prescribed kinematics, finite working clearances, bores, cycle continuity, display timing and repeated state/update calls preserving scene objects and geometry identities.

Browser review compared default, front and rear views with each engraving. After correcting the 456 camera distance, both models have zero clipped vertices over 65 sampled poses in an 850-pixel square viewport. Review screenshots and scripts remain in `/dev/shm`.

These remain analytical animations, not solved hydraulic systems. Shaft motion, vane folding, piston extension and water visualization are prescribed. Pressure, leakage, cavitation, elastic seals, support loads, vane return and contact forces are not solved; water volumes are illustrative and not boolean-clipped around every solid. In 456, motion imposed by the unilateral cam assumes an available return load. The inferred cam profile and redesigned external H bend preserve the source topology but are not dimensioned reproductions. No MuJoCo or fluid solver was used or implied.
