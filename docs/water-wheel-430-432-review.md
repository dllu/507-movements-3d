# Water wheels 430–432: finite geometry and flow illustration

References: original [overshot wheel 430](https://507movements.com/mm_430.html), [undershot wheel 431](https://507movements.com/mm_431.html), and [breast wheel 432](https://507movements.com/mm_432.html), plus local engravings. None of the three pages contains either `ae.add_model` or `mm_present`; there is no official 2D motion oracle for this group. The engraving arrows and water paths support clockwise 430/432 and counterclockwise 431.

## Changes

Shared `water-wheel-solids.js` supplies finite bored bearings with connected pedestals, and reusable water-cell geometry buffers. Previously the alleged bearing supports stood off to the sides without reaching the shafts. Bearings now straddle the wheel axially with clearance for the rotating parts. All three sets of spokes were substantially too long; they now stop at the inner drum or supporting rim rather than crossing the bucket spaces. The normal playback target is six seconds per revolution, matching the authored period instead of compressing it to two seconds.

**430:** Added a closed inner bucket drum and axial bucket cheeks. The front cheek is translucent to expose the working pockets. Replaced level water boxes, which crossed their bucket dividers, with finite trapezoidal cell volumes clipped by a horizontal plane. The outer lips, top feed, clockwise motion, six spokes and bottom discharge are retained.

**431:** Opened the solid sluice tower into a lintel and axial jambs, preserving the bottom passage beneath the raised gate. The wheel's sixteen radial float boards remain distinct from 430's retaining buckets. The channel current still runs left to right and drives the depicted lower boards counterclockwise.

**432:** Added the previously missing full-width curved breast floor and stationary side cheeks. This is the essential geometry described by Brown: the fixed channel closes the spaces between rotating floats. Its inner radius is 2.78 against a 2.75 board-tip radius, with a small finite running gap. Flat outer rim sections fit inside that envelope. The floor has open inlet/outlet ends, and the headrace no longer extends into the rotating wheel. A gate lintel and axial jambs replace the obstructing solid tower. Water is displayed in the individual cells instead of an uninterrupted tube passing through all the boards. The front stationary cheek is translucent for visibility.

Ground and material fog are disabled throughout. Movement 432's framing bounds now include the entire gate stem and headrace.

## Evidence and limitations

Run:

```sh
node --test tests/movement-430.test.mjs tests/movement-431.test.mjs tests/movement-432.test.mjs tests/water-wheel-430-432-solids.test.mjs
```

Thirty existing tests plus five finite-geometry tests pass. The added checks sample rotating solid surfaces against fixed bearing supports, gates, flumes and channel parts over 65 poses, bound spoke radii, and inspect visible water vertices against bucket/cell solids over 97 poses. These are sampled checks, not continuous collision proofs. Water clipping reuses geometry buffers; it does not rebuild collision meshes or run a fluid engine in the browser.

Default/front/rear views were compared with the engravings. Final default-camera projection sweeps found zero outside vertices for all three wheels over 65 poses. Screenshots and logs remain in `/dev/shm/water-wheel-*` and `/dev/shm/430432-browser*.log`.

The water remains an explanatory animation. Cell fill is a prescribed clipping height, not a conserved volume or solved free surface; stream tubes and moving dots illustrate direction rather than fluid particles or validated fluid-solid contacts. Normalized torque diagnostics use idealized prescribed loads/forces, not the visible mesh's changing mass distribution. Gate-thread action, flow separation, splashing, leakage through clearances, water pressure, efficiency, inertia and load-dependent speed remain unmodeled. Axial bearing construction, bucket details, dimensions, transparency and timing are inferred. MuJoCo rigid-body contact would not establish hydrodynamic validity, so no physics claim or unnecessary live solver was introduced.
