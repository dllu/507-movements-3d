# Unqualified quadrant-catch contact study (183–184)

This module is an offline diagnostic, **not the browser implementation and not a
bake source**. The production model still uses prescribed kinematics. Only the
piston is actuated here; the two handle hinges respond to gravity and contact.

`geometry.js` fits the two engraved poses jointly and uses circular quadrant
rims. Working arms use a small number of visible centerline points. The hidden
axial retaining pins are an inference, not an observed detail. Their placements
are currently incompatible through the full transfer. The fitted working tips
and weight pins also have 15–21 pixel residuals; this is not source qualification.
The collision layers at z = 0, 1, and 2 isolate the tested interfaces and are not
a proposed visible axial stack. Pivot bores are excluded from the contact study.

Run from the repository root:

```sh
node scripts/probe-quadrant-catch-transfer.mjs /dev/shm/183-quadrant-study.json
```

An optional second argument selects one named case, for example `shoe-only`.
The default runs one 18-second native cycle per case at a 0.0005-second step.
The JSON records endpoint errors, named final contact pairs, and source hashes.
The process exits successfully when it completes the diagnostic; its
`completesCandidateEndpoints` fields are not expected to pass. Even passing
endpoints would require subsequent continuous-contact and source-fit review.

The controls switch off the upper handle's retaining pin, the lower handle's
pin, and both pins separately. They do not alter mass, inertia, driver force, or
working-arm geometry. With the original inferred pin location, the lower handle
reaches approximately −0.956 radians and loses the shoe before releasing the
upper handle. Earlier release allows an upper swing but both retaining pairs
then bind midway. Removing only the lower pin allows the first upper swing;
the unretained lower handle falls back and the upper pin blocks the return.
Removing only the upper pin leaves the lower pin/rim pair blocking the upstroke.
Removing both permits the upper handle to fall prematurely into the shoe path.
Thus the failure is not repaired by deleting a contact or changing solver
precision. A valid reconstruction must first produce compatible retaining-pin
sweeps and a handoff while the driven handle is still supported by the shoe.

Classical contour extraction was tried on both engravings using
`scripts/extract-engraving-contours.py` (ROIs `190,35,230,365` and
`190,55,235,355`). It recovers visible boundaries in about 0.01 seconds per image,
but joined ink/crossings merge the handles and quadrants into large components.
Those outlines are useful source measurements; hidden pin locations cannot be
recovered from thresholding. Keep ideal circles for the intended quadrant rims
and infer occluded working faces separately.
