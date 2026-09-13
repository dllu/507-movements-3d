# Movement 088: source cam and finite stop reconstruction

Movement 088 now uses a cam traced from the engraving and two solid stepped
stops. The broad feet behind the square faces replace the old axial point
noses and thin mounts. The cam drives the feet through their actual rendered
surfaces. Its offset edge is slightly nonradial, as drawn. Shaft seats have
zero-clearance press-fit geometry; the fixed bearings retain running clearance.
The old prescribed output rotation has been replaced by contact-integrated
playback with inertia, gravity, a dry bearing brake and inelastic drive impacts.

Wheel B is concentric with its own shaft. The hidden output axis is inferred
from the opposed stops at source coordinate `[284.5,275]`, while the input is
at `[277,282]`. This shifts the circular rear rim by `[9.4985,-4.9970]` source
pixels relative to its fitted tracing, a distance of about 10.73 pixels in
the 525-pixel image. A preliminary version kept the rim tracing exactly and
therefore made the disk wobble about its shaft; that version and its numerical
evidence are retained, but it is not the final model.

The 23 cam tracing points lie within 0.004 source pixels of the generated
native outline. This measures agreement with the manual trace, whose
uncertainty remains approximately ±3 pixels; it is not subpixel accuracy
against the original ink. The source overlay shows the cam, stops and shaft
closely aligned and exposes the rear-rim shift. The final model remains
**under review for the inferred hidden axis, rim alignment and stepped-foot
construction**.

The centered-wheel simulation contains 65,537 fine states over four input
revolutions. Its transverse mass centroid is below `1.3e-16` model units, so
gravity introduces no significant imbalance. Successive settled output
positions differ by exactly half a turn within `1e-10` radians. A complete
two-index period closes within `8e-15` radians, with zero settled speed.
The actual endpoint is retained. A short coast after release and a partial
startup index from the drawn initial rest pose remain in the motion.

Independent checks cover step halving, momentum, gravity impulse, the dry
brake bound, nonnegative contact impulse, impact energy and contact phase
derivatives. Seven full-solid poses pass 149,570 surface samples; all twelve
solids have closed, consistently oriented boundaries. These are sampled
clearance checks, not a proof of clearance for every time.

The application retains 6,522 of 39,323 startup/period states in a roughly
270 kB JavaScript table. Reduction error is at most `2e-8` radians against
the original linear interpolant. All 6,521 interval midpoints and additional
repeated-cycle poses pass native cam/foot clearance within `1e-6` model units.
The input and output angles accumulate continuously across the loop seam.
Two indexes take eight seconds at default speed, with roughly two seconds
of drive and two seconds of dwell per index after startup. The maximum
retained angular rate is 1.6400 rad/s. A full-rotation envelope of the native
meshes supplies the camera bounds; fog and ground rendering are disabled.

The production build passes. All 178 selected model, contact, playback and
camera tests pass. The 168 registry/model and all-507 camera tests were also
rerun after display metadata was finalized; the final bundle was checked to
contain those exact display values. The existing large-bundle warning remains.

The final browser run completed 17.816 seconds and 409 frames, including
startup and two repeating display periods, without errors or unexpected
warnings. It ran at 22.90 fps using software rendering, with a 0.10 ms
95th-percentile model update. All recorded browser states agree with Node
within `1e-12`. All fourteen screenshots were opened and inspected: source,
registered overlay, both drive/release/rest sequences, an oblique view, the
finite-foot detail, both seam poses, and actual desktop/mobile routes.

Earlier failed hypotheses are preserved separately. A fan triangulation
assumed the cam was star-shaped about its shaft; the nonradial offset defeats
that assumption. The contact solver now uses the actual rendered front
triangles. A first contact projection also used an arbitrary tied support
corner for an edge contact, giving the wrong moment arm; the corrected
feature witness passes independent finite-difference derivatives. Neither
failed run supports the final mechanics claims.

The authoritative local records are `088-centered-reconstruction-check.json`,
`088-centered-production-export.json`, `088-integrated-playback-captures.json`,
`088-integrated-playback-inspections.json` and
`088-integrated-playback-checkpoint.json`. The new
`088-integrated-source-hashes.json` records the final source state. Only 088's
entry changes in the display profiles; 087's geometry and trajectory remain
unchanged. Bulk trajectories, screenshots and build output stay outside Git.
This integration is progress toward the full 507-movement review, which
remains active.
