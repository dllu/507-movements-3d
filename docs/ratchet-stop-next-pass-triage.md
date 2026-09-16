# Next ratchet and stop interfaces: 237, 240 and 241

A read-only screen on 2026-09-16 finds three independent corrections suitable
for the same finite-pawl, contact-path and bored-joint components.
These factories match baseline commit `c58cbab`; later corrections may change
the screen results below.

| Movement | Actual-solid witness | Next correction |
| --- | --- | --- |
| 237, crown ratchet | Rounded nose penetrates an actual axial tooth by `0.01135582` at phase `0.546875`; pawl body penetrates by `0.01058852` at `0.484375`. | Correct the finite axial ramp follower and body clearance, preserving drive/drop and the radial hinge. Check the tooth meshes, not only the disk beneath them. |
| 240, three alternative stops | All three working bodies sit `0.0484` in front of the wheel. No separate working nose reaches into the tooth plane. | Step each alternative into real engagement, then check its retaining normal and free-run release. Preserve the source's comparison of alternatives. |
| 241, single-tooth index | Curved driver penetrates by `0.02953357` at phase `0.03125`; holding click penetrates by `0.03054703` at `0.0625`. | Reconstruct finite drive/holding faces and continuous entry, handoff and return; retain the source's opposed rotation arrows and one-tooth index. |

The forty-first pass corrects these baseline defects; see the
[237](crown-pawl-237-contact-review.md), [240](ratchet-stop-240-review.md) and
[241](single-tooth-241-contact-review.md) reviews.

Run `node scripts/screen-ratchet-stop-interfaces.mjs` against the stated baseline
to reproduce these witnesses. On current code it measures the corrected parts;
240 now also has dedicated working toes covered by its focused suite. It samples vertices, triangle centers and edge
midpoints at 65 poses against actual mesh triangles. This is a defect screen,
not exhaustive collision or loaded-force qualification. A mere clearance cut
must not remove the working faces or hide a contact behind depth separation.

The [237](https://507movements.com/mm_237.html),
[240](https://507movements.com/mm_240.html) and
[241](https://507movements.com/mm_241.html) pages fetched on this date contain
no canvas, `add_model` registration or `mm_present` assignment. Use their
engraving/caption; reconstruct ideal tooth geometry and extract visible
irregular body contours with the existing CV tool where useful.
