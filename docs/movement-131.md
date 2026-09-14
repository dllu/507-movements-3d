# 131: slotted sector and rack — partial review

The [source animation and engraving](https://507movements.com/mm_131.html)
show a crank pin driving a slotted sector, which reciprocates a rack. This
linkage is analytically determined; it does not require a physics solve.

The current correction replaces straight trapezoidal sector teeth with
20-degree involute flanks and a conjugate straight rack. The pitch radius is
2.5 world units, with 23 equivalent full-wheel teeth, 11 sector teeth, and
10 rack teeth. Module is 5/23, addendum one module, dedendum 1.25 modules.
Each member has 0.008 module of tooth-thickness relief. Unbevelled working
surfaces preserve that clearance. The nonworking root extension connects each
tooth to the existing sector web. Rack root and tip heights now follow these
same pitch dimensions.

The authored cycle changes from 8.72665 to four seconds. A four-second minimum
also makes displayed timing explicit, replacing the generic display retiming.
The scene ground is hidden, fog remains disabled, the camera is nearly frontal,
and Restart restores the initial pose.

The crank pin now has radius 0.374 against a 0.375 half-width slot. The
0.001 world-unit running gap bounds the ideal centreline constraint's positional
error to approximately 0.045 source pixels. The slot has no expanding bevel.
The old dark outline and front face narrowed the opening by 0.04 world units;
they are hidden because they would intersect the corrected pin. The unengraved
crank arm and diagnostic indices are also hidden. The slot arm clears the disk
face by 0.05 world units, and the crank pin spans the full slot depth.

Validation:

- Finite polygon intersections pass 721 crank phases; a half-tooth wrong-phase
  control intersects and fails. At 121 phases the closest working surfaces
  remain within 0.004 world units (approximately 0.18 engraving pixels using
  the disk diameter as scale).
- The source animation callbacks independently agree with the pin orbit exactly
  and rack position within 0.000001184 world units at 721 equal crank phases.
  This checks phase-dependent travel, not source wall-clock timing. The tiny
  residual comes from rounded source interpolation constants.
- A separate finite pin test checks distance to every segment of the actual
  visible through-hole at 721 poses, requiring 0.00099–0.00101 world units of
  running clearance. It also checks the disk/arm axial gap and pin depth. A
  negative control detects the former outline's intrusion.
- The existing linkage regression passes. Three velocity cancellation tolerances
  were adjusted to accommodate floating-point roundoff at the increased native
  speed; they remain within 3e-15 world units per second.
- Packaged desktop/mobile playback checks cover pause, restart, JavaScript
  errors and absence of a WASM download.

Reproduce:

```sh
node scripts/compare-slotted-sector-source.mjs
node --test tests/slotted-sector-teeth.test.mjs tests/slotted-sector-pin.test.mjs
node --test --test-name-pattern='movement 131 drives' tests/models.test.mjs
```

The source comparison accepts `SOURCE_HTML` for an archived page and records
its SHA-256. The reviewed page hash was
`761b9dcc30293be36da9a65a114185e09d46f8ba9599c49d887176a8ad23adbb`.
No original animation geometry or library is shipped in the application.

## Remaining work

This is not a full engraving or interference sign-off. The retained sector web,
slot end outline, rack length and added frame still need a raster-based
reconstruction. The pin follows an ideal slot centreline, with the small
running-gap approximation bounded above; no contact dynamics are implied.
Other hardware collision pairs are not covered by the tooth and pin tests.
These remain part of the active all-507 review.
