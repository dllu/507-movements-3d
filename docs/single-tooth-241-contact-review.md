# Movement 241: single-tooth indexing drive

The [official engraving and caption](https://507movements.com/mm_241.html) show a continuously counterclockwise lower one-tooth driver, a clockwise indexing wheel A, and an upper holding click. Direct inspection of the page on 2026-09-16 found the unavailable marker and no canvas, `add_model` or `mm_present` animation registration. There is no official 2D motion oracle for this review.

## Correction

The existing point-contact construction correctly advances one of nineteen output teeth per driver revolution, with opposite input/output directions. Its curved tooth and click outlines already clear each other in the plane. However, the generic extrusion enlarged both profiles with a 0.0216 outward bevel, causing actual-solid penetrations of **0.029534** at the driver and **0.030547** at the click.

The replacement extrusions retain those same outlines and sharp working corners without expanding them into the wheel. No load face or tooth was cut away. Both parts overlap the wheel depth by **0.10**. Actual triangle normals at the contacts give clockwise driving moment magnitude at least **1.83016**, and the holding radial face supplies a **1.7** clockwise moment opposing counterclockwise backslip. These reaction directions lie in the normal cones of the actual finite driver and click corners.

The driver disk/hub and click eye have real shaft passages; the output hub now fits its shaft. Face indexes lie flush on their disks and inside the wheel root circle. The driver disk is recessed behind the curved tooth so it does not hide the source curl. Source-facing framing, an eight-second minimum playback cycle, and disabled ground/fog make the short engagement easier to inspect. Updates retain all geometry buffers.

## Validation and limits

`node --test tests/movement-241.test.mjs tests/single-tooth-241-contact.test.mjs` passes **13 tests**. Existing tests cover 32,769 nominal contact states, all profile edges, exact indexing ratio and analytic velocities. New tests independently inspect actual triangle normals, selected working surfaces at 129 full-cycle plus 129 engagement poses, finite bores at 17 poses, repeated-cycle handoffs, 65-pose swept bounds, attached indicators and retained buffers. Minimum measured working-body separation is **−6.89e−8**, within float32 surface rounding; the original approximately 0.03 intrusions are closed.

The laws preserve **continuous positions**, not impact-free dynamics: the output velocity changes at driver entry/release, and the ideal sharp click approaches final seating with singular speed. The viewer explicitly identifies these rigid-impact assumptions. Gravity seating, hinge forces, loaded holding capacity, wear and impact compliance are not simulated. No MuJoCo result or exhaustive all-pairs collision certification is claimed. No expensive runtime cutter or bake was required for this bounded geometry correction.

## Integrated browser check

Final Chrome source/default/oblique views load without page errors. A 17-pose
visible-vertex sweep has maximum normalized extent 0.851, with no camera
clipping. The default scene uses 24 draws and 8,200 triangles including
shadow passes. The final production build passes in 24.51 seconds, and all three
packaged desktop/playback/mobile cases pass in 9.6 seconds. These browser checks
verify presentation and interaction, not passive contact dynamics. Artifacts
remain outside Git under /dev/shm/family41-*.
