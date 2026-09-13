# Movement 087: fixed stud orbit and initial lifting checks

The next source-fit candidate restores the stud's measured orbit inside E.
Its largest landmark displacement is 32 source pixels, compared with 75 for
the earlier connected-dynamics candidate. Native contact, mass/gravity and
two initial lifting studies pass. This remains an isolated candidate: the
changed geometry has not completed release, connected reversal or repeated
cycles, and the source outline comparison still has tradeoffs.

## Fit and source comparison

E's horizontal center and the measured 202.84-pixel stud orbit are fixed.
The 0.548-pixel vertical axis correction keeps E's pinion coaxial with the
output shaft. The stud is placed at the analytic incoming source-pose contact;
its resulting displacement is included in the fit. Five other landmarks can
move inside a common bound: F and G fulcrums, their rod pins, and G's upper
end. The weight and lever tip retain their source projections.

The deterministic population search and coordinate polishing use 310,948
evaluations. A selected 32-pixel bound meets the force-margin target at 2,049
analytic samples per branch. The searched transition bracket, 30.9375 to
31.25 pixels, is not a proof of a global optimum. The no-contact plateau in
the 25-pixel run is likewise not proof of global infeasibility.

The seven actual landmark errors have maximum 32.00, mean 25.43 and RMS
27.61 pixels. F's crank length is 102.15 pixels versus the measured 166.05;
G's is 276.87 versus 232.44. These proportional changes remain significant
even though no individual landmark moves 75 pixels.

Nine registered native part contours are compared bidirectionally with the
measured source model. Slot and E openings are included. Contour distances
are weighted by perimeter, without per-part registration. This is neither an
ink-image score nor an occlusion-aware comparison.

| Candidate | Maximum landmark error | Mean contour distance | RMS contour distance | Stud margin inside E |
| --- | ---: | ---: | ---: | ---: |
| Earlier 75-pixel pins | 75.00 | 8.65 | 20.66 | 32.17 |
| Previous distributed fit | 26.67 | 12.92 | 15.02 | -15.82 |
| Fixed orbit | 32.00 | 10.32 | 14.81 | 32.17 |

All distances are source pixels. The new fit improves contour RMS over both
controls and restores the rim relationship, but its mean contour distance
remains worse than the earlier 75-pixel candidate. Halving contour quadrature
spacing changes its mean by only 0.000043 pixels. The continuous maximum
distance upper bound is 38.69 pixels, using the sampled maximum plus half
the maximum sample spacing. Overall source fidelity is not marked resolved.

## Native geometry and contact

All 213 solids pass topology checks. The source pose screens 18,971 independent
part pairs with 1,467,444 bidirectional surface samples and no intrusion beyond
1e-6 world units. Native slot/fork gaps are nonnegative to roundoff. The native
stud starts with 0.000043 world units of clearance, approximately 0.013 pixels.

There are 258 native G/stud contact roots across the two lifting branches.
Minimum useful generalized moments on F are 0.36907 forward and 0.07408 on
return. Maximum gap residual is 1.25e-14. Support-identified finite differences
recover both contact derivatives within 1.02e-7; no tested stencil crosses a
feature boundary. Thirty-six full-solid contact witnesses agree within
2.29e-15, and contacts remain at least 0.468 units beyond the artificial cut
of the upper-arm contact patch.

## Fresh dynamics and retained setup error

The earlier trajectories are not transferred to this geometry. Independent
finite differences of rendered component transforms check the changed linkage
inertia and gravity at 129 poses. Maximum inertia error is 2.50e-10 and gravity
derivative error 7.99e-10. Sixty-five separate shaft/D gravity checks agree
with native component centroids to 1.56e-15 in potential and 1.07e-9 in its
derivatives. These retain the illustrative additive-component mass hypothesis.

Each direction starts independently at a native seated jaw cusp, fork wall,
slot end and incoming stud contact. Initial key preload follows the output
gravity torque; input phase is retargeted once to preserve the seated jaw.
These are explicit initial conditions, not connected animated transitions.
The existing jaw solids and measured cusp profiles are unchanged.

The first initialization used the profiles' preceding-stroke direction for
the next stud contact. The stud consequently receded, and the impact left
the lever stationary. That report and its exact source snapshot are retained
as rejected initialization evidence, despite its old assertions exiting zero.
Version 2 distinguishes arrival from outgoing direction and requires a
negative incoming gap velocity and an outgoing lever velocity of the expected
sign. The following results all use version 2.

Two half-time-unit lifts use the existing illustrative dry-friction values
0.78 static and 0.42 kinetic. Both keep D seated during this interval. The
frictionless controls withdraw by 0.01864 and 0.01290 world units. This is
sensitivity to an assumed material law, not identification of Brown's material.

The selected coarse/fine steps are 0.0005 and 0.00025, with 4,002 fine states
across the branches. Maximum position differences over all fine sample times
are 7.83e-5 radians on clockwise F and 2.36e-5 radians on the counterclockwise
shaft. Endpoint agreement alone would miss those transient differences.
Momentum, free acceleration, unilateral contact and friction-cone checks pass
at every stored fine step. Absolute physical contact-work defects sum to
0.002303 and 0.000318 in the model's illustrative energy units; a longer-run
energy/convergence qualification remains necessary.

Seventeen exact native jaw/stud samples per branch are nonpenetrating to
roundoff. Four full-solid endpoint screens pass another 6,053,388 surface
samples. These discrete samples are not continuous clearance or full travel.

## Rendered review and remaining work

All 17 stills are opened: nine source/front/oblique/rear/detail comparison views
and eight initial-lift endpoint views. The source overlay confirms the restored
E/stud relationship, while fulcrum and rod offsets remain visible. The ordinary
pin connections and depth ordering remain legible. Minor quadrant shadow
speckles persist. Both owned browser captures close normally with no errors
or unexpected warnings. No playback-speed claim is made from these stills.

The next work is to continue this geometry through full lifting and release,
then connected reversal and subsequent cycles, with the changed mass and
contact geometry throughout. Source proportions, historical retention and
material identity, continuous clearance, rendering polish, final speed and
production integration remain open. All 1,097 frozen production inputs and
prior study inputs remain preserved. The all-507 goal remains active.

`087-fixed-orbit-checkpoint.json` indexes the fit, geometry, native contacts,
corrected impact initialization, coarse/fine lift trajectories, independent
checks, both capture/inspection manifests and the rejected setup report.
Scripts use exclusive output paths; bulk generated artifacts stay outside Git.
