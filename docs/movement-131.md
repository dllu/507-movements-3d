# 131: slotted sector and rack

The [engraving and animation](https://507movements.com/mm_131.html) show a crank
pin driving a slotted sector and a translating rack. The browser now selects
`slotted-sector.js`, an analytical reconstruction using measured raster
proportions. The older registry factory remains available for historical
regressions; its geometry and tests are not the current browser model.

## Reconstruction

One world unit represents 100 engraving pixels. The sector pivot is (275,298),
the crankshaft (275,143), disk radius 111.5 pixels, crank radius 90 pixels,
and initial pin approximately (365,146). The guide centres are (49,298) and
(472,298) plus their vertical offsets. The two rounded web openings are traced
from the engraving and cut from one connected body containing the sector, hub,
and slotted arm. The previous separate spoke skeleton, broad solid rim,
invented rear frame, crank arm and diagnostic indices are absent.

The slot's end-circle centres lie 60 and 270 pixels from the pivot, with a
15-pixel inner radius. Its 14.9-pixel crank pin leaves 0.1 pixels of radial
running clearance; the analytical centreline constraint uses this small-gap
approximation instead of simulating clearance take-up. The arm occupies z=0–14
pixels; the disk front is z=-6. The crank pin spans z=-6.5–21, providing full
engagement without arm/disk overlap. Shafts pass through actual bores.

The sector uses nine teeth from a 28-tooth-equivalent 20-degree involute gear,
with a 130-pixel pitch radius. Its rack has the conjugate straight flanks.
Addendum is one module, dedendum 1.25 modules, with 0.008-module tooth-thickness
relief on each member. These regularized tooth dimensions and their root
extensions are a reconstruction: the hand-drawn tooth outlines are not copied
literally. Working surfaces have no expanding bevel.

The bar extends beyond the engraving so that both guides remain engaged over
the full stroke. The approximately 500-pixel drawn bar cannot cover a 423-pixel
guide span plus 161 pixels of rack travel. The reconstructed bar is 620 pixels
long, including end margin. Its centre follows the guide midpoint, offset from
the sector axis. The guide openings clear both the bar and the teeth; translation
is an ideal prismatic constraint, not a simulated load-bearing contact system.

Playback uses a four-second revolution, no live physics, no fog or ground plane,
a nearly frontal camera and Restart. Shaft supports and depth dimensions are
reconstructed; loads, friction and elastic deformation are not simulated.

## Reference discrepancy and validation

The source animation has crank radius / shaft spacing = 4/6.5, versus 90/155
in the engraving. At equal crank phases, aligning the source's shaft spacing
with the measured engraving gives a maximum pin-position difference of
5.385 pixels and rack-position difference of 2.615 pixels over 721 samples.
The implementation retains the engraving proportions. This comparison checks
phase-dependent geometry, not the site's wall-clock playback speed.

The reference page SHA-256 is
`761b9dcc30293be36da9a65a114185e09d46f8ba9599c49d887176a8ad23adbb`.
The comparison script fetches the current page, or accepts `SOURCE_HTML` for an
archived copy, and records its hash. No original animation code or geometry is
shipped in the application.

The new reconstruction test checks 721 poses for:

- One connected body with a pivot bore, through-slot and two web pockets.
- Finite pin/slot clearance of 0.099–0.101 pixels.
- No sector-body or tooth overlap with the rack teeth; working flank gaps
  below 0.2 pixels at 121 poses, and a wrong-phase failure control.
- Disk/arm axial separation and crank-pin depth engagement.
- The bar staying in both guides, with no bar/teeth versus guide-solid overlap.
- Full-cycle framing using actual transformed mesh vertices.

Packaged browser checks cover desktop/mobile rendering, animation, pause,
exact restart, JavaScript errors and absence of a WASM request. Source and moving
screenshots were inspected alongside the engraving. The older pin and tooth
unit tests cover only the historical factory.

```sh
node scripts/compare-slotted-sector-source.mjs
node --test tests/slotted-sector-reconstruction.test.mjs
```

This review retains the explicit tooth-profile, extended-bar, ideal-joint and
hidden-depth qualifications above; it does not claim literal raster identity
or a dynamic load-bearing simulation.
