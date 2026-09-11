# 057 · Reconstruction under review

Production 057 now uses the checked reconstruction. Its original factory and
test are preserved in `057-original-factory.txt` and `057-original-test.txt`.
The build, five focused mechanical tests, all 2,955 numerical tests and all
17 browser tests pass. Numerical and browser wrappers both report exit code 0
with no signal (117.005 and 698.536 seconds respectively). The browser suite
includes all 507 canvases and the new 057 play/pause/orbit/mobile check. All six
integrated source/oblique comparison frames and the rear view are inspected.
Movement 037 remains unresolved. This is an unfinished catalog review.

## Source

https://507movements.com/mm_057.html is saved in `../reference/mm_057.html`.
Unlike 056, this page has no official animation: its Animated control is marked
unavailable. Do not attribute the current factory's counts to a website animation.
The enlarged original is `../reference/brown-057-detail.png`, extracted unchanged
with pdftoppm from PDF page 22 (one-based), scale 6000, rectangle
(420,3730,1300,1330).

Brown says the top pulley drives the concentric external and internal gears in
opposite directions through two bands. The lower intermediate pinion spins and
orbits their common center. An open outer band and crossed inner band provide
those opposite input directions. The pinion requires a carrier, and the two
concentric gears require independent bearing constraints. Their hidden
construction must be inferred.

The drawing shows the inner band's drum OUTSIDE the sun's tooth tips; the current
factory instead places this drum inside the sun gear's outline. The driver looks
like one broad pulley with a hub and crank; its apparent hub circle is not evidence
for a second, smaller belt pitch radius. Equal-radius adjacent grooves should be
considered during reconstruction. Large decorative supports and rear spokes are
not visible in Brown's front view.

Initial read-only radial measurements are in `057-source-pitch-measurement.json`:

- Sun boundary scores favor 18 teeth (inner boundary 0.506, outer 0.447).
- Internal ring boundaries favor 34 (outer 0.519, inner 0.454).
- Planet evidence is ambiguous: inner boundary favors 10 (0.450), while the
  outer boundary favors 12 (0.409) just ahead of 10 (0.388). The visible shape
  appears closer to ten teeth, but meshing occlusions are substantial.

These raw counts do not satisfy Nr=Ns+2Np, which applies when both meshes have
the same operating pressure angle. That identity does not exclude a nonstandard
involute planetary set with different operating pressure angles and matched base
pitch; see the candidate evidence below. Indexed visible teeth still need checking.
Do not treat Fourier maxima or the old 40/20/10 values as authoritative dimensions.
Approximate source centers are
sun/ring (720,870), planet (727,1095), and upper driver (718,241). Approximate
radii: ring exterior 355, sun drum 194, sun tooth tips 164, planet tips 98,
driver exterior 135 pixels. The wheel centers are about 629 pixels apart.

## Confirmed baseline defects

`scripts/probe-band-epicyclic-teeth-baseline.mjs` checks actual closed tooth skins
in both directions through one relative planet-tooth cycle. Across 129 poses,
`057-tooth-contact-baseline.json` reports 6,321,950 samples:

- External sun mesh: 46,548 penetrations, maximum depth 0.05892273.
- Internal ring mesh: 20,797 penetrations, maximum depth 0.05906111.

The internal teeth are independent rectangular boxes, not involutes. Existing
phase invariants subtract their initial values, so passing invariants do not
establish correct initial tooth/gap alignment.

`scripts/probe-band-epicyclic-hardware-baseline.mjs` samples the carrier sleeve
against all sun solids, and ring spokes against the planet shaft and carrier
arm over 97 relative ring/carrier poses. Its intentionally limited one-direction
baseline is in `057-hardware-baseline.json`:

- Carrier sleeve penetrates the unbored sun gear, hub and sun drum; maximum
  measured depth reaches 0.17333334.
- All four ring spokes hit the planet shaft; maximum depth 0.04674167.
- Ring spokes also intersect the carrier arm by 0.00250000.

`scripts/probe-band-epicyclic-belts-baseline.mjs` checks actual initial belt
surfaces against the driver and driven drums. `057-belt-contact-baseline.json`
finds the open belt inside the driver by up to 0.04513746 and the crossed belt
inside its driver step by up to 0.04076956. The open belt also penetrates the ring
drum by 0.00358855. Rope pitch radii must account for the rope's finite radius.
The shared crossed-belt curve already bows its two free spans to opposite axial
sides with 0.13 lift; do not assume it has a planar self-crossing without checking
actual skins and all installed hardware.

## Baseline timing

The current model has module 0.08, ring/sun/planet counts 40/20/10, driver belt
radii 0.58 and 0.34, ring belt radius 2.0 and sun belt radius 0.72. Angular speeds
in authored seconds are driver +2.6, ring +0.754, sun -1.2277778, carrier
+0.0934074 and planet +2.7357778 rad/s. One carrier orbit takes 67.2665 authored
seconds. Its display metadata calls a single driver revolution the cycle
(2.41661 authored seconds mapped to 2 display seconds). Slow orbital motion is
therefore partly the differential ratio, not a frozen carrier. Reconstruct the
ratios first, then choose readable speed without falsifying the orbit.

The untouched model is captured and inspected in `057-baseline-phase-0.png`.
Its small inner band disappears behind the sun gear, while Brown shows the band
outside that gear. The exposed rear spokes, support frame and long shaft caps
also differ from the engraving.

## Integrated 18/10/34 reconstruction

Production files are `src/simulation/band-epicyclic-gears.js`,
`src/simulation/band-epicyclic-geometry.js`, and `src/simulation/band-epicyclic.js`.
The candidate modules now re-export these implementations so existing probes
continue checking production geometry. The gear contours
share base pitch 0.301592895, but work at 17.1116 degrees (external mesh) and
34.9952 degrees (internal mesh). Their base radii are 0.864, 0.480 and 1.632;
the planet center radius is 1.40625. Flank thicknesses and initial phases are
calculated for those two working angles. These are custom involute profiles,
not standard unshifted gears or copied animation geometry. Radial root joins
below the base circles are tangent to the involute; the roots are not claimed
to be rack-generated.

Technical support for different working angles in nonstandard planetary sets:
[EP3255314A1, description of planetary tooth counts and operating angles](https://patents.google.com/patent/EP3255314A1/en).
[KHK's gear-dimension reference](https://khkgears.net/new/gear_knowledge/gear_technical_reference/calculation_gear_dimensions.html)
also gives internal gearing with modified profiles and operating center distance.
These references support the construction method; Brown supplies the intended
arrangement and approximate proportions.

`057-candidate-gear-contact.json` checks actual Float32 side-wall contours at
2,049 uniformly spaced phases per mesh over a relative planet-tooth cycle:

- Sun mesh: gap 0.0000249847–0.0000254006, zero crossings.
- Ring mesh: gap 0.0000248520–0.0000252543, zero crossings.

`057-candidate-gear-forces.json` uses normals between the actual closest tooth
skin points, balances the free planet's spin torque with positive compressive
loads, and includes its translating center in the power balance. All 2,049
phases have the expected torque directions. Maximum power residual is 0.164%
of ring input power. Because the carrier output is small, the same tessellation
error is 5.57% of carrier power; do not present the latter as exact. The ring
provides net power, the oppositely rotating sun absorbs most of it, and the
carrier takes the difference. Imposing opposite angular velocities does not
mean both branches supply positive power.

`057-candidate-exact-contact.json` independently checks complete actual 3D
triangle skins at three phases per gear mesh and two phases at every driven
pulley groove. Gear minima are 0.0000249429–0.0000251648. Belt/pulley minima are
0.000188874–0.000195674. The two rendered crossed-belt free spans have a minimum
gap of 0.000390922. Those checks used the first carrier arrangement, but all
tested gear, belt and pulley vertices and poses are unchanged in the revised
carrier arrangement.

All 18 meshes pass every-face closed-surface, consistent-edge, positive-volume,
nondegenerate-face and outward-normal checks in `057-candidate-solids.json`.
The final hardware audit also passes: 97 poses, 128 independent part pairs,
997,119,928 bidirectional surface samples and zero penetrating samples in
`057-candidate-hardware.json`. These are finite geometric checks, not a proof
of continuous collision avoidance in arbitrary modified geometry.

### Carrier correction and belt construction

The first full candidate put its carrier behind the sun drum. An actual
bidirectional 13-pose, 128-pair audit found 6,369 penetrations between the planet
axle and inner belt near the top of the orbit, maximum depth 0.128401536
(`057-candidate-hardware-initial.json`, 145,122,530 samples). No other pair failed.
This is a rejected carrier arrangement, not passing evidence for the replacement.

The carrier now occupies the gap between the drum and the gear plane. Its sleeve
is at z=-0.205..-0.12, bored to radius 0.325 around the radius-0.32 sun shaft;
the arm is at z=-0.195..-0.145. The shortened planet axle starts at z=-0.205.
The inner belt's entire possible axial envelope ends at z=-0.2198, so it stays
behind every carrier part. The sun drum's front is z=-0.21 and the gear backs
are z=-0.11. The planet turns on its own bored bearing; its axle, rear shoulder,
front cap and arm belong to the carrier. The full 97-pose audit passes. The
rejected rear-carrier implementation is `057-rejected-rear-carrier-model.mjs`.

The ring uses an ideal external annular bearing constraint. It needs no rear
spokes or central cup wall for the crossed belt or orbiting axle to strike.
Fixed bearing mounts outside the source schematic are not drawn. The upper
pulley has two equal-radius adjacent grooves, a real hub and traced hollow-eye
crank. Every groove accounts for the radius-0.04 round cord. The crossed spans
use opposite small clamped-span deflections representing mutual cord contact;
this is an approximate static shape, not a solved elastic or friction model.
Material stripes move around each closed tube without moving geometric markers.

### Source indexing, appearance and timing

`057-indexed-source-teeth.json` independently extracts unseeded angular plateaus
from the first visible ink boundary, then fits tooth indices. It retains the
previous occlusion masks, closes only sub-degree scan gaps, and separately
records narrow or truncated plateaus. The best counts are 18 for 14 visible
sun plateaus (2.200-degree RMS), 10 for five planet plateaus (2.274-degree RMS,
versus 3.255 for 12), and 34 for 26 ring plateaus (1.330-degree RMS). The larger
unchanged planet crop `../reference/brown-057-planet-detail.png` was also inspected.
Wear and meshing occlusions remain substantial; these counts are reconstruction
estimates, not dimensions specified by Brown.

Front, oblique, rear and quarter-orbit captures are generated by
`scripts/capture-band-epicyclic-candidate.mjs`. `057-source-alignment.html`
compares projected actual mesh vertices with unchanged Brown scan pixels at a
fixed 160 pixels per unit. The ring exterior, planet radius, sun drum and upper
pulley closely follow the measured proportions. The sun tips are about 11
pixels shorter than the drawing to avoid planet interference. Involute teeth
are visibly different from Brown's square schematic teeth. The crossed band
passes behind the ring's thin section, whereas Brown draws it across the front
edge. These differences must remain disclosed.

With driver speed pi rad/s, ring speed is +1.170957262, sun speed -2.146754980,
planet spin +3.927210509 and carrier speed +0.022518409 rad/s. A carrier orbit
takes 279.024390 authored seconds. The belt ratios nearly cancel in the Willis
relation. The measured display profile covers a full carrier orbit and applies
time scale 1.599910494. At default speed the pinion spins once per second,
the driver turns about 0.8 times per second, and the carrier orbits in 174.4
seconds. These physical ratios are preserved; the entire orbit cannot be
compressed into two seconds without making the pinion unreadably fast.

The final evidence record is `057-reconstruction.json`, status
`rebuilt-and-verified`. The build took 9.79 seconds and retains the existing
bundle-size warning. The gallery contains 226 comparison frames. Movement 037
remains unresolved, and movements 058 onward are still pending; source review
and baseline defect measurements for 058 have begun.
