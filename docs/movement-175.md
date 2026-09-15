# Movement 175: branch-transfer crank — constrained reconstruction

The frame now follows the engraving, with real bores, rigid links, retained pins
and a guide shoe that clears its full stroke. The catalog preserves an
eight-second two-turn cycle. Fog and scene ground are disabled; the initial
view is nearly orthographic, and Restart restores the fitted source pose.

## Source discrepancy and chosen fit

The [original page](https://507movements.com/mm_175.html) supplies an executable
animation with crank radius 5, guide offset 7 and rod length 12. Its tangent
branch transfer requires L = offset + radius. Measured engraving landmarks give
radius 77.01 pixels, offset 155 and rod length 163.69, whereas that topology
would require a 232.01-pixel rod. The engraving and animation are inconsistent.

The [constrained fit](validation/175-constrained-fit.json) holds the engraved
shaft, guide position and slot ends fixed. It enforces rigid-link closure and
full-stroke clearance for the finite shoe, including a one-pixel end margin.
A grid search minimizes squared initial pin errors under those constraints.
The resulting radius is 44.64 pixels: the crank pin differs by 32.37 pixels,
and the slider by 4.77. This is a substantial, explicit departure from the
engraved crank and dashed circle, necessary under these fixed-frame constraints.
The rod never stretches or changes branches discontinuously to hide it.

Eight independently measured frame features are within 2.74 pixels in the
[mesh projection check](validation/175-source-fit.json). This is a sparse
nearest-vertex audit, supplemented by visual comparison of the packaged front
view, not a whole-image registration. The fixed shaft and guide retain their
measured source coordinates. Unillustrated depths and bearing clearances are
reconstruction assumptions.

## Motion and validation

- The [oracle comparison](validation/175-oracle.json) executes the original
  library and callbacks at 1,441 phases. The analytic implementation, using
  the original dimensions through its explicit reference option, agrees to
  2.53e-14 model units. Production uses the separately fitted dimensions.
- Two production tests check rigid closure, pin alignment, velocity continuity
  at both tangencies, measured pose departures and intended cycle timing.
  Branch continuation and constant crank speed are supplied kinematically;
  a passive dynamic transition is not claimed.
- The original animation's reversals enclose 1.36491 and 0.63509 crank turns,
  rather than literally one turn each as the caption suggests. The complete
  cycle totals two turns. These reference values change with fitted dimensions.
- The [finite clearance sweep](validation/175-assembly-clearance.json) checks
  all cross-body pairs among 12 physical meshes at 525 poses, including exact
  branch transfers, piston reversals and nearby poses. There are 12,068,700
  surface queries and no sampled intersections. This is not continuous proof.
- Production build and [desktop/mobile browser checks](validation/175-browser.json)
  pass playback, exact Restart, orbit/reset, no overflow, no WASM requests and
  no page errors. MuJoCo is unnecessary for this explicitly kinematic model.

The [historical solid baseline](validation/175-existing-solids.json), against
757dafc, records eleven interfering pairs in the previous assembly. Those
parts were replaced; the source-animation reference option is for the oracle
comparison, not the shipped geometry.

Continue with 176. The full 507-movement review remains active, including known
open reviews elsewhere; this reconstruction retains the documented source
compromise above.
