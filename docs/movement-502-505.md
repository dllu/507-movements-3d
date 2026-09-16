# Epicyclic family: 502–505

Sources checked 2026-09-15: [502](https://507movements.com/mm_502.html),
[503](https://507movements.com/mm_503.html),
[504](https://507movements.com/mm_504.html), and
[505](https://507movements.com/mm_505.html). 502 and 505 provide animations;
503 and 504 do not. Their captions and engravings remain the primary reference.
The existing signed carrier-frame ratios agree with those mechanisms and remain
analytic. The nine-second-class carrier periods are retained: the faster sun
in 505 completes a revolution in about 2.84 seconds, while 504 deliberately
needs several carrier turns to show its small opposed output rates.

## Corrections

All four omit invented large support frames and floating contact dots/plaque
labels. Ground and material fog are disabled. Actual bores now clear the
stationary/carried shafts through the gear bodies, hubs and carrier plates.
Output and compound sleeves have separate bores for their journals. Face
indicators no longer cover the bore openings. Camera bounds contain complete
carrier revolutions; 503's extraneous shaft extensions were shortened.

504's carrier is now below its gears, as drawn. Its pedestal now ends below the
carrier instead of passing through the fixed wheel, and the stationary stud
ends at that wheel instead of protruding above the entire mechanism. The 20-,
21-, and 19-tooth ratios are unchanged. Its existing four-band intermediate B
remains a disclosed reconstruction: different modules on the working bands
close all centers exactly, unlike the engraving's apparently straight continuous
teeth. This pass does not claim to have reconstructed that historical compromise.
The extra lowest working band and vertical ordering of the output stack remain
source-fit residuals.

505 previously used a full-depth internal ring with shallow sun/planet teeth.
Its ring entered the planet's solid root: the baseline audit found 3,762
penetrating samples across 17 poses, with depth at least 0.05 model units.
The replacement uses the existing rounded-rack generator offline for its 14-tooth
sun and 11-tooth planet, retaining the 36-tooth ring and exact tooth-count closure.
All three now have module 0.12 and a common 25-degree pressure angle. Addendum
is 0.8 module, dedendum 1.05 module, cutter backlash 0.0012, and generated radial
allowance 0.0003. These are engineering reconstruction choices, not values
specified by Brown. The lower-count planet receives an actual generated root
transition. `scripts/generate-planetary-505-profiles.mjs` bakes only one radial
tooth profile per gear; the browser does no rack sweep.

The external and internal ideal working contact ratios exceed 1.05 (about
1.09 and 1.29 respectively), and every member has equal base pitch. This checks
that the corrected teeth provide overlapping engagement intervals instead of
merely removing material until disconnected wheels no longer intersect. The
small generation clearance remains intentional; playback supplies ideal ratios,
not dynamically resolved backlash.

## Evidence and limits

`node --test tests/epicyclic-family-clearance.test.mjs tests/movement-502.test.mjs tests/movement-503.test.mjs tests/movement-504.test.mjs tests/movement-505.test.mjs`
passes 33 tests. New checks sample the actual journal cylinders against rendered
body/hub surfaces, check open face indices, and check 505 base pitch/contact
ratios. Existing checks cover carrier-frame velocities and long continuous
rotations.

`node scripts/review-epicyclic-teeth.mjs` checks actual rendered gear bodies and
teeth bidirectionally using vertices, edge midpoints and triangle centers.
The published `docs/validation/502-505-gear-solids.json` uses 33 uniformly spaced
carrier poses per movement: 180,768 queries for 502; 243,906 for 503; 230,715 for
504; and 1,246,068 for 505. No sampled penetration exceeds 1e-6 model units.
This is sampled working-gear evidence, not continuous collision proof or a
complete assembly interference audit. It excludes hubs, supports and shafts;
those receive the separate scoped journal tests.

Browser default/front/advanced source comparisons show intact involute and
conical faces, open bores and continuous opposed/aggregate motion. Each renders
under 80,000 triangles including shadows. 502's full-orbit camera necessarily
leaves space around its initially vertical arm. 505 starts with its arm horizontal
rather than at the engraving's diagonal phase. The source proportions, 504's
historical tooth construction, and untested carrier/fixed-member clearances
remain follow-up work. 503's teeth retain the shared back-cone involute
approximation, not exact generated octoid flanks.

502 and 504 retain their previous shallow involute tooth depths. Their sampled
nonpenetration checks do not establish contact coverage throughout a tooth
period; engagement continuity for those bands remains unqualified.
