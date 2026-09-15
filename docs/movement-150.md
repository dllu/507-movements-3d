# Movement 150: selectable valve cams (review open)

The [source](https://507movements.com/mm_150.html) describes cams of different
throw sliding lengthwise along a shaft to change valve travel. The source HTML
marks the animation tab unavailable, so there is no 2D motion oracle for 150.

## Pinned valve connection and adjacent-cam clearance

The app now loads `makeSelectableCamValve`, which retains the analytic cam
selection schedule and replaces the slotted valve head with an ordinary pin.
The rod reaches the engraved lower endpoint near Y=354 pixels. A second pin
connects it to an inferred vertical output slide. The rod tilts to accommodate
the lever arc; its lower pin follows a straight vertical path. The guide and
its supporting base member are reconstructed and disclosed in the model note.

The new lever, follower roller and rod heads have actual bores. The right pivot
shaft and retainer now fit the source-sized lever boss. A complete moving-body
check exposed a problem missed by the earlier working-pair tests: larger
unselected cams could strike the old lever and long roller axle when a smaller
throw was selected. The lever now occupies the 0.06-unit gap beside the selected
cam, with a 0.03-unit plate depth. Its axle and retainer stop before the next cam.
This hidden depth is an engineering choice, not a measured engraving dimension.

[Assembly evidence](validation/150-pinned-valve-assembly.json) compares all
visible meshes on different rigid bodies: 53 parts, 934 pairs, 65 poses across
all selections and 21,961,090 bidirectional point/solid checks, with no
penetration above 1e-6. Same-body mating interfaces are excluded. This is sampled
clearance evidence, not continuous collision proof.

The new focused test checks both rendered pin centers, constant output X, the
source endpoint, restart and analytic output velocity against finite differences
at 2,049 demonstration times. The original large mechanism test continues to
exercise the underlying cam solver; it describes the retained legacy constructor,
not the new valve geometry. Reproduce current checks with
`node --test tests/selectable-cam-valve.test.mjs` and
`node scripts/review-selectable-cam-valve.mjs`.
The production build and packaged desktop/mobile test pass, including the new
model note, animation, exact restart, orbit/reset and absence of WASM requests.

Cam contact and return are still prescribed analytically. Passive loading,
source cam-stack projection and exposed shaft length remain under review before
settling the full reconstruction and any offline bake.

## Working-contact correction

The existing analytical model stops at the common heel, shifts the entire cam
carrier axially, and resumes rotation. Four revolutions and selection transitions
take 27.255 seconds; operating shaft speed is 1.15 rad/s, about 5.46 seconds per
revolution. This timing is retained. The model prescribes follower contact and
roller spin; gravity return and external valve loads are not dynamically verified.

[Baseline mesh evidence](validation/150-legacy-contact.json) found seven failing
cam/roller pairs: bevels penetrated the tread by about 0.012 world units and
outline tubes by up to 0.02321 units. Mathematical contact metadata missed these
rendered additions. The baseline report records the earlier source hashes.

The first correction inset the bevels. The subsequent bored carrier rebuild
uses finite cam-lobe plates without outward bevels, meeting an annular common
sleeve. Decorative tubes sit 0.04 units inward along the profile normal. [The updated check](validation/150-contact.json)
compares the actual tread against all four cam plates, their outlines and the
common-heel sleeve through 97 demonstration poses: 1,038,508 bidirectional
point/solid checks, no penetration above 1e-6. This checks working pairs only,
not whole-assembly interference or continuous motion. Run
`REQUIRE_CLEAR=1 node scripts/review-selectable-cam-contact.mjs`.

The default camera is lower and less oblique, fog remains disabled, the ground
plane is hidden, and Restart is now enabled. The focused movement-150 test
passes; its expected camera direction was updated to match the authored view.
The production build and packaged Chrome desktop/mobile test also pass,
including play/pause, exact restart, orbit/reset and no WASM request.

## Remaining source reconstruction

The shaft radius is now 0.56 / 0.016 = 35 source pixels, close to the approximately
36-pixel hatched end in the engraving (previously 8.125 pixels). The hub has a
real axial bore and keyway, the sleeve and end collars are annular, and the cam
plates contain only the lobes outside the common sleeve. Bearings have matching
bores and sit beyond the complete carrier stroke. Posts end below the enlarged
bearing housings; base rails extend under the relocated posts. Throw markers
were moved outward onto the lobes to keep them out of the enlarged bore.

[The shaft assembly check](validation/150-shaft-clearance.json) compares the shaft
and key against the carrier and fixed bearings/posts, plus the carrier against
those fixed parts: 164 pairs, 97 poses and 20,039,716 point/solid checks, with no
penetration above 1e-6. Rigid carrier internal interfaces and the rest of the
mechanism are excluded; this is not whole-assembly validation.
Run `node scripts/review-selectable-cam-shaft.mjs`.

The cam-stack projection, exposed shaft length and relative silhouettes still
need tracing rather than assuming the current polar profiles and camera
reproduce the engraving. The enlarged bore is a dimensional correction, not
proof that the axial arrangement matches the source.

The earlier rectangular slotted output head has been replaced as described
above. The frame/supports remain engineering interpretations, and source
projection still needs review. The local constructor takes about 178 ms, including roller-spin
precomputation; decide on offline baking after the geometry and mechanics are
settled. Do not mark 150 complete from the contact check alone.
