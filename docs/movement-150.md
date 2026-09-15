# Movement 150: selectable valve cams (review open)

The [source](https://507movements.com/mm_150.html) describes cams of different
throw sliding lengthwise along a shaft to change valve travel. The source HTML
marks the animation tab unavailable, so there is no 2D motion oracle for 150.

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

Cam bevels now inset the mathematical outline. Decorative tubes are thinner
and sit 0.04 units inward along the profile normal. [The updated check](validation/150-contact.json)
compares the actual tread against all four cam plates, their outlines and the
common-heel sleeve through 97 demonstration poses: 720,292 bidirectional
point/solid checks, no penetration above 1e-6. This checks working pairs only,
not whole-assembly interference or continuous motion. Run
`REQUIRE_CLEAR=1 node scripts/review-selectable-cam-contact.mjs`.

The default camera is lower and less oblique, fog remains disabled, the ground
plane is hidden, and Restart is now enabled. The focused movement-150 test
passes; its expected camera direction was updated to match the authored view.
The production build and packaged Chrome desktop/mobile test also pass,
including play/pause, exact restart, orbit/reset and no WASM request.

## Remaining source reconstruction

The engraving's hatched shaft end has an approximate 36-pixel radius. The current
shaft radius is 0.13 / 0.016 = 8.125 pixels at the model's source scale. Its
carrier hub, common sleeve, cam bores and bearings need coordinated review;
merely enlarging the shaft would intersect the currently solid components.
The cam-stack projection and relative silhouettes also need tracing rather than
assuming the current polar profiles and camera reproduce their printed outlines.

The rectangular slotted output head replaces an ordinary-looking source pin,
and the large frame/supports are invented. Review the valve connection and
whole assembly together. The working-pair correction does not validate those
features. The local constructor takes about 135 ms, including roller-spin
precomputation; decide on offline baking after the geometry and mechanics are
settled. Do not mark 150 complete from the contact check alone.
