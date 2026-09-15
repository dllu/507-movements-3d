# Movement 164 — source-shaped knee press

164 now uses a ten-mesh analytic reconstruction. The curved handle, tapered
compression link and rounded foot in a cup replace the former straight beams,
exposed lower pin eye, added reaction columns and invented workpiece. There is
no live physics or expensive collision geometry to load.

## Source and motion

The [original page](https://507movements.com/mm_164.html) supplies a working 2D
animation. It confirms that the lower support is fixed and the upper pressure
plate translates vertically as the knee straightens. Its lower link has a
rounded end seated in a circular cup, rather than a through-pin bearing.

Engraving measurements use 0.018 world units per pixel: upper pivot (239,73),
knee (213,147), rounded-foot center (241,456), and handle end (497,181). The
rounded tip reaches row466; treating that visible tip as the pivot, as the old
model did, lengthens the lower link incorrectly. The new foot radius is ten
pixels, and the cup has a small radial clearance and flared entry for rocking.
The plate and base use the drawn widths. The curved silhouettes are traced
from the public-domain engraving; unseen depths, pin clearances, rear cheek
and upper vertical guide remain inferred.

The mechanism has one degree of freedom. For each lever angle, the fixed-length
lower link fixes knee height by a circle intersection, then the short arm fixes
upper-plate height. The handle is rigidly part of the short arm. No dynamic
solver is needed for these ideal seated-bearing constraints. Friction, material
deformation and force-dependent contact loss are not simulated; the foot is
assumed to remain seated under compressive load.

A smooth four-second cycle starts at the engraved pose, approaches straightness
and returns. It stops 0.012 radians short of the straight configuration, avoiding
an exact singularity or crossing onto the other branch. The pressure plate rises
0.10239 world units (5.69 engraving pixels). Ideal vertical-force multiplication,
computed from virtual work, rises from about 8.89 to 237.69. This is a kinematic
ratio, not a predicted capacity of an actual press.

## Verification

The original animation and its actual library are executed in an isolated VM
with a no-op canvas at 721 phases. With the oracle's dimensions and measured
input angle, the independent circle/guide solution agrees within 4.98e-7 of its
coordinate units. The oracle uses a different stroke and dimensional sketch;
its shapes and timing are not copied into the reconstruction.

Two tests check both rigid lengths, vertical guidance, singularity avoidance,
force-ratio behavior, visible pin alignment, swept bounds and exact restart.
The full visible-solid audit checks 35 cross-family mesh pairs at 129 poses,
using 2,397,984 vertices, edge midpoints and triangle centers. It finds no
intersection deeper than 1e-6 world units. Same-family rigid joins are excluded;
this finite sweep is not a continuous collision proof.

The production build and packaged desktop/mobile Chrome checks pass, including
playback, exact restart, orbit controls, responsive layout, no browser errors
and no WASM loads. Fog and the unrelated ground plane are disabled. Source and
oblique screenshots were inspected. The pre-existing large-main-chunk build
warning remains.

Evidence: [oracle comparison](validation/164-oracle-comparison.json) and
[visible clearance](validation/164-solid-clearance.json), with source hashes.
Raw oracle assets, screenshots and private builds remain in /dev/shm.

```sh
node --test tests/knee-press.test.mjs
node scripts/compare-knee-press-oracle.mjs
node scripts/review-knee-press-solids.mjs
```
