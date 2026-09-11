# 075: continuous pawl drop and ordinary rod pin

The user's second correction identified a real defect in the first shark-fin
revision: choosing a new static contact at each frame could jump the holding
pawl through an undercut tooth. Endpoint contact and equilibrium tests did
not establish a clear continuous path. That implementation is preserved in
`075-before-continuous-drop/` and is superseded.

The bar now has additional travel. Only its oscillation is prescribed; the
wheel and both independently hinged pawls are integrated under gravity,
mesh-derived inertia, an opposing wheel torque, bearing damping, and
unilateral inelastic contact. The wheel travels about 5.47 degrees beyond
the holding position. The right pawl clears the crest, falls through free
space, and contacts the next pocket. The wheel settles back against it while
the left pawl returns. The net advance is one of the 34 teeth per four-second
cycle. Angles remain continuous through drops and repeat boundaries.

Rod C connects at a fixed circular bore in the yellow bar. Its upper pin
follows the bar's circular arc; the rod swings sideways while its lower end
moves vertically. The pin, bore and visible bearing stay concentric. There
is no slot. Both pawl bodies remain in the ratchet plane; the former thin
axial contact rods are absent.

Validation:

- `075-continuous-tests-refined.log`: all seven focused tests pass, covering
  source pivots, solid topology, circular bearing walls, rod swing, repeatable
  seeking, overtravel and free drop, contact Jacobians and finite clearances.
- `075-continuous-sweep.json`: all 32,000 nose-sweep intervals pass at a
  1e-6 world-unit tolerance. The conservative lower clearance bound is
  -3.994e-7. This checks the actual interpolated path using segment distance
  to every wheel edge and an analytic curvature bound.
- `075-continuous-surfaces.json`: 203 poses, including dense samples around
  both pawl drops; 70,487,942 actual mesh surface checks, zero intrusions above
  tolerance. Maximum sampled depth is 6.80e-7 world units.
- `075-continuous-convergence.json`: reducing the integration step from
  0.001 to 0.0005 seconds changes the pawl-tip position by at most 0.028
  engraving pixels. Repeat discrepancies are below 5e-12 radians.
- `075-corrected-final-captures.json`: fourteen inspected captures, including
  a twenty-frame close-up of the right pawl, source comparison, front/oblique/
  rear views, and desktop/mobile controls. All browser checks pass.

The regular tooth spacing and material/load parameters are reconstruction
choices. The bar input is prescribed; this is not a measurement of an
original physical machine. The wider all-507 review remains active.

Final regression: `npm test` passed all 3,094 tests with zero failures;
production build passed. Log: `075-continuous-full-tests.log`.
