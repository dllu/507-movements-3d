# Movement 400: Wilson four-motion sewing feed

The [primary caption and engraving](https://507movements.com/mm_400.html) specify a forked carrier A, a feed bar B pivoted within it, one cam supplying lift and forward motion, spring return, and gravity drop. The page has neither `ae.add_model` nor `mm_present`; there is no official animation oracle. The engraving supplies topology and approximate proportions, not dimensions, exact profiles, timing or loads.

## What the finite review found

The old animation reported zero radial and axial residuals from scalar top-radius/front-X formulas, but those formulas did not describe its broad physical pads. Bidirectional surface samples found radial-pad/cam penetration of 0.15538 model units and axial-pad/base penetration of 0.04450. The variable front face was an open mesh; its sampled intersections cannot be interpreted as a qualified closed-solid penetration depth. The feed bar also entered both work plates by about 0.073, its pivot hub was unbored around the 0.145-radius shaft, and the carrier rails ran through the feeder base.

## Compatible finite construction

Both followers are now rounded buttons of radius 0.08, an explicit reconstruction choice. The radial cam is an inward normal offset of the button's pitch curve. A 0.00006 model-unit mesh allowance bounds polygon chord error; 1,025 poses measure actual button/cam clearance between 0.0000268 and 0.0000967.

The axial contact is solved directly against the rendered front-face triangles. The reusable `sphere-face-support.js` includes triangle interiors and finite edge extrema, selecting the furthest X required to keep the sphere outside the face. At 1,025 poses the independent mesh-distance check measures tangency within 4e-16. The reaction normal retains X component above 0.494, so it can drive the carrier; the radial reaction supplies a lifting moment arm above 2.289 about B's pivot.

The finite axial button advances the carrier by up to 0.06962 relative to the former point-follower control law. The full stroke and cyclic closure remain intact. The dense cycle check confirms forward feed, and actual tooth-tip coordinates remain 0.03 below the finite work surface throughout carrier return. The nominal phase table describes the cam's control ordinates; actual return/take-up flags use solved velocity. Velocity follows the contact normal; acceleration is a numerical derivative and includes faceting effects.

A narrow neck connects the axial button to two fork legs that clear B. The shortened A rails end before the feeder as in the engraving. B's hub has a real bore and its beam joins beyond the shaft. The work plate now has a longitudinal opening wide enough for the entire feeder stroke. A narrower rear cam extent improves the source width/diameter proportion while retaining every radial contact point. Bored bearings connect the camshaft to its support posts and base. The axial annulus remains part of the same rigid compound cam; its extension surface includes its inner, outer and rear boundaries.

The source does not specify these button radii, axial annulus dimensions, bearing construction, work-plate slot or fork-leg sections. They are disclosed finite constructions chosen to preserve the stated mechanism. No contour tracing or copied animation geometry was needed.

## Validation and remaining limits

Run `node --test tests/movement-400.test.mjs tests/four-motion-feed-solids.test.mjs`.

The tests cover the finite sphere/triangle support at both faces and edges, independent mesh tangency, useful reaction directions, full-stroke follower/cam, fork/B, pivot, shaft/bearing and feeder/work-plate clearance, cyclic motion, and feed direction. A negative control restores the nominal axial point-follower law and detects more than 0.03 penetration. Both floor and fog are suppressed. Browser review inspected default, front and raised/rear poses against the engraving; a 65-pose actual-visible-vertex sweep found no default-camera clipping.

This remains a quasistatic geometric reconstruction. Gravity and spring preload are assumed; friction, inertia, impact, fabric forces, spring stiffness and possible loss of contact are not solved. The radial follower uses the ideal offset curve with a documented tiny mesh allowance. The axial solver runs in tens of microseconds per state in the native JavaScript regression, so browser physics or a large baked trace is unnecessary for this determinate constraint. Passive dynamics would require a separately validated model before claiming load-dependent operation. The finite review covers named contact neighborhoods, not every mounting or spring attachment.
