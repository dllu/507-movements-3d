# 089: source-proportioned eccentric and split strap

The rebuilt eccentric follows five measured circular outlines, the clamping
lugs, the common flange and the flared rod. Its shaft offset is now 62.5
source pixels, and its collar has the engraving's approximately 40-pixel
radius. The source-facing castings and rod use one projection, with a
reconstructed common center for the nearly concentric outlines.

The previous height diagnosis was wrong: the visible arcs at the top and
bottom are the inner ring. The rectangular lugs hide the outer strap arc.
The new radial ink tracing, inspected overlay and independent circle fits
resolve that ambiguity. The earlier measurement and capture records remain
separate and are superseded for source proportions.

The strap halves now have actual bored clamping lugs and close-fitting
liners. Four bored sheave sections share the shaft's off-center press-fit
hole; the larger collar is bored as well. Front and rear lips retain the
strap axially. The flared neck meets the casting without overlapping its
volume. The correctly bored rod eye, fork and channel guides from the last
correction are retained, with a shorter complete output. A bored rear
support and substantial feet replace the floating shaft-support ring.

The input rotates continuously once every four seconds. The rod includes
its measured slight offset below the strap center. Exact rigid-link closure
therefore uses an offset slider-crank, including the slightly displaced dead
centers and its small strap swing. Seeking and repeat boundaries preserve
continuous angles and pin alignment.

Validation covers the following:

- 302 measured ink points on the five circular outlines. Maximum native
  contour discrepancy is 2.962 source pixels, within the approximately
  3-pixel reading uncertainty. Neck/rod waypoints are checked separately;
  their small construction error is not a claim of subpixel ink accuracy.
- 43 closed, positive-volume solids. Nine poses pass 1,382,972 native mesh
  surface checks. The initial pose includes pairs within each rigid family;
  subsequent poses check the independently moving families.
- Continuous clearance bounds for the rotating journal, pins and retainers,
  fork, guides and supports. The rod contour is clipped against an expanded
  guide range, then expanded by maximum material-point travel between
  samples. The minimum checked running clearance is 0.001419 world units.
- Pin closure through the dense sweep, with maximum discrepancy 1.78e-15.
  173 selected tests include camera checks for all 507 models. A final
  material/shadow refinement then passes the build, all six focused tests
  and the reconstruction checks again.
- A final two-cycle browser run and inspected source overlay, full mechanism,
  quarter-cycle poses, clamp/wrist/flange close-ups, and desktop/mobile views.

The image specifies no depths, loads or output installation. Running
clearances, the shared circle center, press fits, plate sections and the
completed crosshead/support system are reconstruction choices. The model
uses ideal revolute/prismatic constraints with finite visible clearances;
it is not a loaded bearing-dynamics calculation. The frame and completed
rod extend beyond the components drawn in the engraving.

The first native shaft ray test landed exactly on a triangulation edge and
returned no intersection. Its failure log is preserved. The corrected test
uses non-edge-aligned rays; the independent closed-topology test is unchanged.
The final source hashes and checks are recorded in
`089-source-playback-final-checkpoint.json`. The full 507-movement review remains
active.
