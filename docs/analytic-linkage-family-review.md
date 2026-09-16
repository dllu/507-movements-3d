# Analytic linkage correction pass: 231 and 273

Reviewed against the original engravings and captions on 2026-09-15:
[231](https://507movements.com/mm_231.html),
[273](https://507movements.com/mm_273.html).

231 remains an exact circle-intersection four-bar solution. Its two crank
shafts previously ended before reaching the fixed bearing plate, while large
solid hubs and misplaced bearing rings overlapped other bodies. Shafts now
extend through the fixed bearing bores; smaller axial hub depths and centered
fixed rings clear the rotating crank plates. The opposed exposed shaft ends
and existing Grashof proportions remain. The isolated mechanism hides ground.

273 now uses reusable `bored-planar-link.js` geometry for four rigid links and
four slider eyes. All eyes have real pin holes, and slider cylinders stop
outside those bores. Front and rear link layers clear the middle slider eyes
and rods. The invented rear cross, base, and brackets have been removed to
recover the engraving's four independently supported guides. The camera is
closer to frontal; its bounds cover the complete stroke, and ground is hidden.

Both retain analytical motion: 273 satisfies `x² + y² = L²`, with four equal
side lengths and opposed sliders. No contact uncertainty in this ideal
linkage calls for MuJoCo. Both currently display one cycle in two seconds
after the existing timing normalization.

## Source motion and reconstruction assumptions

231 has no original animation implementation. 273 **does** have one: its
inline script registers `mm_273` with the site's animation library. The static
HTML initially labels the animation tab unavailable even when that script
exists, so that label alone is not evidence of absence. The source motion
confirms the same equal-link constraint and opposed slider directions. It
uses a wider stroke and brief reversal dwells; our smooth sinusoidal input
retains the same geometric law and leaves that timing difference explicit.
The earlier incorrect unavailable-animation metadata is corrected.

Depths, pin clearances, supports outside the pictured guides and the input
actuator remain reconstruction assumptions. The linkage idealizes the hand
drawn 273 joint centers by at most seven source pixels; no contour tracing was
needed for these straight bars and round eyes. Rod lengths include enough
overtravel to stay within their guides for the chosen stroke. Joint backlash,
loading and elastic deflection are not simulated. This bounded pass does not
claim an exhaustive all-pairs collision audit.

231 still needs a source-proportion pass: the existing reconstructed output
crank is longer and lower in the initial view, and its coupler more diagonal,
than in the engraving. The repaired joints do not establish fidelity of those
pre-existing link lengths or of the source-pose camera projection. Its complete
rotation also occupies more area than the initial pose, requiring framing room.

## Validation

`node --test tests/movement-231.test.mjs tests/movement-273.test.mjs tests/analytic-linkage-joints.test.mjs`
passes 18 tests. Existing full-cycle position, velocity, acceleration and
closure checks are retained. New tests measure actual shaft and hub axial
bounds, verify 231's forward shaft clears its moving coupler through 721
poses, cast rays across each 273 pin cross-section through the actual mesh
holes, and check finite corner-eye clearance from guide jaws through 361
poses. The replacement joint geometry stays rigid; no per-frame deformation
or mesh generation is used.

Desktop browser source comparisons and seventeen full-cycle framing samples
report no errors or clipping. Maximum absolute projected coordinate is 0.838
for 231 and 0.886 for 273, where the viewport edge is 1. Default and frontal
screenshots were inspected; 273's four-eye rhombus silhouette and its individual
guides are now visible without the invented backing frame. Bulk images remain
outside Git in `/dev/shm/linkage-batch-*-{default,front}.png`.
