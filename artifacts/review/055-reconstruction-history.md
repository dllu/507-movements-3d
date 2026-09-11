# 055 reconstruction evidence

The reconstructed 055 is now registered from src/simulation/coaxial-gears.js.
Its four focused mechanical tests and all 2,945 numerical tests pass; build
passes. The dedicated 055 browser test also passes. The complete browser
suite and final source/full captures are still pending. The review wrapper
055-candidate-model.mjs now re-exports the registered implementation.

Brown's description specifies different speeds for coaxial A and C driven
by pinion B; it does not prescribe a numerical ratio. The official site
corrects the original D label to B. Its animation uses 20/10/40 teeth, but
the engraving appears to have different counts.

The read-only pixel measurement in 055-source-pitch-measurement.json favors
17 teeth on A and 37 on C. The radial-boundary amplitudes are 0.6002 for 17
versus 0.2961 for 16, and 0.4954 for 37 versus 0.3059 for 36. Pinion B is
partly occluded; its boundary favors 10 (0.3647), but darkness alone does not
give a clear result. These counts need further visual confirmation. The
candidate 17/10/37 combination satisfies Nc=Na+2Nb and preserves one common
module and one fixed pinion axis. No external statement of Brown's counts
has been found. Script: scripts/measure-coaxial-source-pitch.mjs.

Independent baseline failures:

- 055-support-contact-baseline.json: 129 poses, 78,432 spoke samples,
  184 penetrating samples, maximum depth 0.0411753 into the pinion hub.
- 055-tooth-contact-baseline.json: 129 poses and 6,591,450 bidirectional
  tooth-surface checks. External A/pinion: 43,522 penetrating samples,
  maximum depth 0.0735757. Internal C/pinion: 9,813 penetrating samples,
  maximum depth 0.0738268. The old so-called exact internal gear uses
  rectangular tooth blocks. Its velocity invariants do not establish mesh.

The old source view also shows rear spokes, large shaft overhangs and face
ornaments absent from Brown. The new candidate investigates a cup-shaped C
with a rear web and coaxial hollow sleeve. A's shaft passes through that
sleeve. B has a short front shaft, terminating ahead of the rotating rear
web so it does not pierce that web. The cup section is an explicit inferred
support construction; the engraving does not show its back.

Candidate module 0.1, A17/B10/C37, center distance 1.35, C outer radius 2.075;
A and B depths 0.26, C rim depth 0.32 centered at Z=-0.03. The back web lies
at Z=-0.29..-0.19, with a 0.263 bore for A's 0.26 shaft. B's shaft radius
is 0.13 and stops at Z=-0.13 behind the gear, ahead of the web. These shaft
proportions are closer to the engraving than the original tiny shafts.

A and B use rack-generated involutes; C currently uses the existing
analytic internal involute outline, reconstructed without degenerate
zero-size bevel layers. Initial phases satisfy actual tooth/gap alignment:
A=pi/2, B=-pi/20, C=10*B/37. The old external phase sum is off by a quarter
tooth pitch and the old internal phase is also incompatible with proper
tooth/gap alignment. The candidate's actual skins still need verification;
do not infer success from these phase equations alone.

Next: inspect the candidate contact probe, refine source count confidence,
verify both involute engagements independently, inspect the cup's complete
support geometry and source/full views, and only then replace the factory.
054 is rebuilt and verified: 2,941 numerical and 14 browser tests pass. 037 remains
mechanically unresolved and the overall 507-movement review is active.

The first candidate probe now checks 65 independent phases through one
pinion tooth engagement: 8,307,000 bidirectional samples, zero penetration
in either mesh. Maximum nearest sampled gaps are 0.002077 for A and
0.0007443 for C; these still need exact triangle-distance checks and loaded
flank phasing. This does not validate the cup supports, shafts or complete
appearance. Report: 055-candidate-tooth-contact.json. The preceding probe
was deliberately terminated after finding degenerate zero-size bevel
layers in the initial ring; that invalid geometry was replaced before the
recorded 65-pose run.

Subsequent exact triangle minima confirmed that the centered, square-rack
prototype's external gap varies from 0.0007744 to 0.001615. Its full-depth
sharp cutter overcuts the low-count pinion root. Rounding the cutter alone
at 20 degrees improves A but causes internal tip/root interference in C;
that intermediate prototype is rejected. The saved original sharp-rack
candidate remains in 055-candidate-sharp-rack-model.mjs.

The current candidate uses common 25-degree involutes, a tangent rounded
rack cutter for A and B, and C addendum 0.08 / dedendum 0.105. The cutter
tip radius is limited to 95% of the radius at which its two bottom fillets
would meet. The 0.38-module option at 20 degrees follows the basic rack
fillet described by KHK; 25 degrees and the shortened internal tip are
reconstruction choices, not dimensions supplied by Brown:
https://khkgears.net/new/gear_knowledge/gear_technical_reference/involute_gear_profile.html
The downloaded source is ../reference/khk-involute-gear-profile.html.

The ring has 64 samples per involute flank and 8 per tip/root arc. The
shared internal-gear helper now accepts those optional sample counts and
omits bevel layers when chamfer is zero. Existing callers retain their
previous sampling and positive bevels. Their regression checks are pending.

Constant loaded phase offsets are A +0.000928 and C -0.000417 radians.
These take up the working flanks without altering either constant ratio.
055-final-candidate-planar-contact.json records 2,049 independent phases
per pair: A gap 0.00002455..0.00003151, C gap 0.00002774..0.00003812,
zero intersections. Unit compressive forces transmit positive input and
output power; maximum relative power mismatch is 0.2881%, consistent with
the finite polygonal flank normals and clearance. This is a quasistatic
geometry check, not a mass/inertia or elastic-contact simulation.

The fast segment-distance method was checked against independent 3D
triangle minima at 34 baseline pair/pose combinations: maximum difference
5.9e-17 (055-planar-method-validation.json). Six new independent triangle
measurements of the final candidate also retain tiny positive gaps; see
055-final-candidate-triangle-contact.json. The boundary extractor has now
been upgraded to recover contours from actual side-wall triangles instead
of model outline metadata; its final sweep still needs recording.

The current axial arrangement is A/B Z=-0.09..0.09, C rim -0.13..0.09,
rear web -0.23..-0.13, sleeve -0.56..-0.18, A shaft -0.65..0.125,
and B shaft -0.09..0.125. A/B shafts meet their own same-body bores at
matching nominal radii. A's shaft clears the independent 0.263 web bore
and 0.267 sleeve bore. The frame rotates atan2(16.5,227.5) to reproduce
B's slightly lower source position. The web's front is pale paint on its
existing faces, with no extra intersecting geometry.

055-candidate-solids.json: seven closed, positively oriented solids,
no zero-area triangles, and every corner normal points outward.
055-candidate-hardware.json: 97 poses over a complete C revolution,
14 independent hardware pairs, 38,887,646 bidirectional surface checks,
zero penetrating samples. Both tooth pairs are checked separately.
The cup joins and each gear's own shaft are intentional rigid connections.

The actual-triangle contour sweep is complete in 055-actual-contour-contact.json.
The registered version is pending final source captures and the complete
browser suite. The numerical wrapper recorded exit code 0, signal null,
117.014 seconds; its 2,945 passing tests include the existing internal-gear
callers and the new four mechanical tests. The build completed in 8.74 seconds.
