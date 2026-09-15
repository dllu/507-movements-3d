# Movement 177: released engine coupling — final assembly review open

176 and 177 now instantiate the same seven selector solids. The annular curved
passage, recessed faces, connecting sleeve and retaining lips are identical;
only the selector orientation changes by a quarter turn. The previous straight
engaged slot has been replaced. The geometry does not morph between states.

## Shared physical selector

The source caption for [176 and 177](https://507movements.com/mm_176.html)
describes rotating the same selector ring. The
[consistency check](validation/176-177-slot-consistency.json) now proves exact
position, normal and index-buffer identity for every selector part, identical
local part transforms, and a ring-angle difference of minus pi/2. Both use an
annular passage of radius 3.3 and half-width 0.29.

The engaged wrist's analytic wall-contact residual is at most 3.29e-11 model
units with the retained clearance lag. The released wrist has 0.01 clearance
from each annular wall to numerical precision. Finite-solid sweeps check the
actual triangulated geometry independently. The selector attachment check in
176 applies to the identical local solids and transforms in 177; its mounting
against the different cheek is included in 177's separate clearance sweep.

The input rotation, stationary released output and selected ring angle remain
prescribed. This is not a passive dynamic demonstration of disengaging under
load. Retaining depths, bearing supports and the angular lock are assumptions.

## Checks and remaining work

The [current sweep](validation/177-assembly.json) checks 23 meshes at 386 poses:
129 full-turn samples plus 257 concentrated entry/passage/exit samples. It
performs 22,088,450 finite-surface queries with no sampled cross-body
intersections. This is not continuous proof.

Both 176/177 motion tests pass. Production build and packaged
[desktop/mobile checks](validation/177-browser.json) pass for both views:
playback, exact Restart, orbit/reset, no overflow, no WASM requests and no page
errors. The front views were inspected alongside their engravings. Fog and
scene ground are disabled, and catalog playback is bounded below by four seconds.

The [historical baseline](validation/177-existing-solids.json), using geometry
at fadeb59, records eight interfering pairs from decorative tubes, markers and
the front bearing. Those interferences are removed.

The shouldered output shaft and integral bosses now pass the complete attachment audit (validation/177-selector-mount.json). Ten measured source features fit within 3.93 pixels (validation/177-source-fit.json). Both coupling tests and packaged desktop/mobile checks pass. The full 507-movement review remains active; next are the user's corrections to 165, 171, 173 and 151.
