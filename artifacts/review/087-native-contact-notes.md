# Movement 087: native stud contact and lifting strokes

The separate 75-pixel candidate now has contact positions derived from its
rendered stud and G edges on both lifting strokes. An exact edge check also
finds a small overlap at its unchanged default source pose that the earlier
surface samples missed. The new lifting views use corrected wheel phases.
Neither the default candidate nor production has been replaced by a complete
reversal animation.

## Source fidelity remains unresolved

An independent pin-placement search varies the displacement directions of
both rod eyes while keeping all other measured points fixed. Its common
displacement radius falls from 75 to 73.5 source pixels at the previous smooth
return-moment target. The coarse angular grid and local refinement perform
30,096 evaluations; a subsequent check uses 513 poses per lifting branch.
Zero adjustment matches the original linkage exactly at 361 poses.

This is only a search within a restricted family, not a global optimum proof.
The small reduction does not resolve the visible source mismatch, so no new
geometry is built from that fit. The earlier 75-pixel candidate remains the
subject of the contact studies. The engraving's pin centers stay preserved
separately as measurements.

## The source-pose overlap missed by sampling

The native boundary calculation recovers the actual Float32 side edges of G
and the stud. Their initial separating-axis penetration is 0.005149432 world
units, about 1.545 engraving pixels. A witness on G's long edge lies inside
the stud by 0.005146130, and the corresponding stud witness lies inside G by
0.005149432. These are independent signed-distance queries against both full
3D triangle solids at Z = 1.25.

The earlier triangle vertices, edge midpoints and centroids do not sample the
small intersecting section of that long edge. Their passing reports therefore
remain evidence of sampled checks only. They must not be used to claim that
the original source pose is collision-free. This limitation affects the
unmodified measured 207-part source pose as well: its initial G upper arm and
stud have the same geometry and transforms.

The corrected first contact rotates E by −0.009740722 radians, about −0.5581
degrees, relative to the measured stud position. Motor and output phases are
matched to retain the engaged right jaw. This removes the overlap in the
stud-driven lifting poses without changing the measured source data.

## Contact calculation and independent checks

The native contact module extracts G's upper-arm patch from its side triangles
and the stud's outer polygon from its actual turned mesh. The upper patch is
convex and begins at a local forward coordinate of 0.6. Every solved contact
stays at least 0.554844 beyond that artificial cut. The stud bore does not
participate in these exterior contacts. Both solids overlap in Z throughout
the checked contacts.

Separating-axis roots include the polygonal stud rotating with E. There are
129 positions on each lifting stroke. At every position, an advance toward
G changes the gap from positive to negative and supplies a useful push.
The maximum contact residual is 1.34e-14 world units. Native wheel-angle
corrections from the smooth circle/capsule solution stay below 0.000177061
radians. Minimum useful unit-force moments on G are 1.154844 forward and
0.284559 on return; the latter is smaller than the smooth-curve estimate.

Independent central differences of the native gap verify both the E moment
and the force transmitted through the fixed-length rod. Maximum discrepancies
are 1.09e-8 and 1.47e-8, respectively. The least useful generalized moment on
F is 0.0639721. This verifies local force directions and mechanical advantage,
not positive reactions under a specified mass, speed or impact law.

Four full-solid triangle-distance queries at each of the 258 contact pairs
confirm that the witnesses lie on both rendered surfaces, with maximum
residual 1.34e-14. This also checks the actual E and G transforms independently
of the planar patch construction.

## Rotating hardware and inspected views

E and the output shaft now rotate to the solved contact positions during the
hardware screen. The motor phase preserves C/D engagement on forward lifting
and B/D engagement on return lifting. Each branch's angles are unwrapped in
its traversal direction; the two branches have not yet been joined through
the free fall and clutch transition.

All 213 solids retain valid topology. Eighteen lifting positions, nine per
direction, consider all 18,971 independent pairs each. Disjoint mesh bounds
and reused relative transforms exclude some pairs; the rest receive 26,588,934
bidirectional surface samples without intrusion beyond 1e-6. The active stud/G
pair additionally uses its exact native contact calculation. Other pairs
still have sampled evidence, with the narrow-edge limitation described above.
This is not a continuous-clearance result.

All thirteen new browser views are inspected: six full front lifting poses,
the source overlay, an oblique source view, a rear return view and four close
contact views. There are no browser errors or unexpected warnings. The close
views show forward contact along G's upper edge and return contact around its
rounded tip. The overlay still exposes the changed pin positions. No runtime
speed or performance qualification is claimed for these individually posed
stills.

Local evidence is indexed by `087-native-contact-checkpoint.json`:

- `087-first-free-pin-placement.json` preserves the fitting search.
- `087-first-native-stud.json` records exact polygon contacts and the initial
  overlap, with its complete source snapshots.
- `087-first-stud-gradients.json` checks the contact/rod force derivatives.
- `087-confirmed-stud-witnesses.json` checks full 3D surface witnesses and
  independently confirms the overlap in the original 207-part candidate.
- `087-first-stud-lifts.json` records the rotating hardware screen.
- `087-native-lifting-captures.json` and `087-native-lifting-inspections.json`
  preserve the thirteen rendered views and their assessments.

The next mechanical work at this checkpoint was to connect these lifting branches through
unilateral contact, inertia, gravity, the free slot travel and loaded clutch
reversal. Contact release and impact behavior must follow that solution;
positive geometric leverage alone cannot prescribe a valid timed motion.
Source fidelity, full motion clearance, playback and production integration
remain pending. The original 087 factories, all 1,097 frozen production inputs
and the 082/083 study sources remain unchanged. No new production build,
full-suite test or all-507 browser pass is claimed. The complete review remains
active.

The subsequent [inertia and first-flight study](087-first-flight-notes.md)
now supplies unilateral lift, release and gravity flight in both directions,
ending just before each opposite slot-end impact. Loaded shifter/clutch
reversal and source fidelity remain unresolved.
