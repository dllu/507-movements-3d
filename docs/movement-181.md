# Movements 181–182 — fitted tappet motion; latch reconstruction open

These engravings show opposite stages of one mechanism. The
[source description](https://507movements.com/mm_181.html) says the piston tappet
closes one valve handle, the diagonal catch transfers engagement, and the other
backweight opens its valve pair. Both variants share geometry and motion;
182 starts at the opposite end of the 18-second cycle.

## Handle fit and finite contact

The old model inferred handle travel from the weight pins alone. Its working
arms did not clear a narrow tappet. The [isolated baseline](validation/181-tappet-baseline.json)
stalled in both directions at both timesteps; widening the travel limits let
it pass. That ruled out merely narrowing the oversized shoe as a repair.

Each handle now uses one rigid fit to its working tip and weight pin in both
engravings, registered at its pivot. The fit also requires the held tip to clear
the shoe's right edge. Tip radii are 0.10 model units (eight source pixels).
The working-arm tracing receives one fixed similarity transform; it does not
change shape while moving. Angles are -0.995 radians for the upper handle and
-0.9446 for the lower. The fit is an explicit compromise between inconsistent
hand-drawn positions:

| Handle | Tip error in 181 | Tip error in 182 | Weight-pin error in each plate |
| --- | ---: | ---: | ---: |
| Upper | 10.37 px | 15.50 px | 10.70 px |
| Lower | 14.30 px | 6.43 px | 11.54 px |

The shoe spans registered source X pixels 170–193. The invented contact rollers
are removed. Contact now comes from the finite working-arm outline over the
whole shoe width, with a circumscribed approximation to the rounded tip.
The tappet moves continuously; its position determines the driven handle angle.
Contact progresses along the arm rather than following one material point.
A short prescribed seating interval finishes the handle's last approximately
1.2% of travel after the working surface clears the shoe.

The opposite handle stays caught during the drive, then returns separately.
Its return is constrained against the opposite shoe face until the tappet has
passed. This replaces the old simultaneous motion, which made the released
handle cross the tappet during overtravel. Valve fractions follow their own
handles. Return timing, seating and catch switching remain prescribed; they
are not yet a fully passive valve-gear simulation.

## Assembly and rendering

The previous repair added 0.12-radius bores around 0.11-radius shafts and
retained, bored weight-rod joints. The handle planes remain at -0.12 and +0.12.
The catch is now at +0.43, clear of the shoe thickness. Its exposed fixed shaft
ends at the back of the catch, an inferred cutaway of the unillustrated support.
The lower backweight arm runs behind the piston rod at -0.68, with a bored
sleeve connecting it to its handle; the engraving shows this arm obscured by
the rod. Depths are reconstruction assumptions.

No ground, fog, added engine frame or floating contact markers are shown.
Both variants retain front full-motion framing, orbit controls and exact
Restart. The earlier unused-outline cleanup remains in place.

## Evidence and limits

The [updated native study](validation/181-tappet-study.json) drives only the
piston against one passive weighted handle at a time. Both fitted handles
complete their strokes at 0.00025- and 0.000125-second timesteps, without extra
travel. Disabled-contact controls and extra-travel controls also pass; all ten
runs remain stable. Final input error is 0.004905 model units, the expected
static gravity/servo offset. The largest measured soft-contact penetration is
0.000943 units. The study omits the catch and opposite handle; its masses,
friction, damping and valve stops are assumptions. It qualifies only the
isolated drive contact, not the complete mechanism.

Four targeted production tests pass. The two motion tests each check 1,201
poses, including finite polygon overlap between the shoe and both working arms,
source-feature residuals, continuous monotone piston strokes, handle continuity,
separate drive/return timing, contact migration and restart. They replace old
tests that asserted the incorrect weight-only angles and fixed-marker motion.
The two joint tests retain checks for bores, layers and retained weight eyes.

The [full assembly sweep](validation/181-current-solids.json) checks 49 meshes,
1,002 cross-body pairs and 8,690,134 finite-surface samples at 129 poses. It
finds **six remaining interfering pairs**, down from 16 before this repair
(and 68 before the initial joint repair). All six involve the old latch rollers
against catch surfaces or the catch's weight pin. The full audit deliberately
still exits nonzero. These sampled checks are not continuous collision proofs.

The production build and [desktop/mobile browser checks](validation/181-browser.json)
pass for both variants: playback, exact Restart, orbit/reset, no horizontal
overflow, no live WASM request and no page errors. The front screenshots were
inspected; the catch profile and short moving rod still visibly differ from
the engraving.

Reproduce with:

- `node --test tests/movement-181.test.mjs tests/movement-182.test.mjs tests/diagonal-catch-assembly.test.mjs`
- `node scripts/probe-diagonal-catch-tappet.mjs`
- `node scripts/review-diagonal-catch-solids.mjs` (expected failure on the six unresolved latch pairs)

## Next work

Reconstruct the actual hook/finger surfaces from both engravings. The current
nearly closed circular pockets and cylindrical latch rollers are not faithful
and still intersect. Then validate passive catch retention and release with
both weighted handles and the piston together before baking that motion.
The finite piston rod also needs the source's sectioned extent, and the full
catch/handle silhouettes need further comparison. Do not mark either movement
fully reviewed or advance to 183 yet. The complete 507-movement goal remains active.
