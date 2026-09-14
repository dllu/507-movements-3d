# 134: single-wrap rope drum — partial review

The [source engraving and caption](https://507movements.com/mm_134.html) show
one rope or band wound around a drum, converting uniform rotation to linear
travel. Frontal dimensions retain measurements from the 525-pixel engraving.

The previous rope occupied one planar circle with coincident entry and exit
points. Its axial placement was outside the cylindrical contact bed and
intersected the front flange. It now follows a one-turn helix of radius 1.73
and axial lead 0.14, centred on the drum. Rope radius is 0.045. Both straight
spans continue the helix's end tangents, so the entire path is C1 and the ends
remain separate. Arc lengths include the axial component; material markers
move at constant arc-length speed without rebuilding geometry during playback.
The helical lead and hidden depths are reconstructed, not measured from the
frontal drawing.

Playback prescribes the mean traction law v = R omega. A helical path on a
rotating cylindrical drum has axial creep: its material velocity is not equal
to the drum's purely circumferential velocity. The contact diagnostics now
report this difference rather than manufacture a zero-slip result. This is
an idealized kinematic capstan demonstration; tension, friction capacity and
rope cross-section deformation are not dynamically solved. The legacy
`noSlipVelocityError` field contains the actual relative-velocity vector.

Checks cover tangent continuity, arc-length travel, uniform material speed,
finite rope separation, radial seating and flange clearance, and the reported
relative velocity. The original unsupported wrap fails the depth check.
Desktop/mobile packaged playback checks cover play, pause, exact restart,
JavaScript errors and absence of a WASM request. One drum turn takes four
seconds at default display speed; fog and the ground plane are disabled.

```sh
node --test tests/single-wrap-drum.test.mjs tests/rope-drum-hardware.test.mjs
node --test --test-name-pattern='movement 134 carries' tests/models.test.mjs
```

The upper-right spoke is now traced from the engraving and repeated by quarter
turns. Its ends overlap the hub and rim rather than stopping at isolated tips.
Raised black torus outlines are hidden and the eight divider plates sit flush
in the front rim. The shaft now uses the engraved 25-pixel radius. A real hub
bore and fitted rear sleeve replace the solid hub/decorative bearing; the
pedestal stops below the shaft and joins the sleeve and foot. Hidden bearing
and support depths remain reconstructed. Casting-contact and shaft-clearance
checks pass.

The tracing regularizes the engraving's small asymmetries, and the unseen
support is an inferred mounting rather than part of the drawing. Axial shaft
retention and rope traction remain idealized as described above. Packaged desktop/mobile playback and silhouette checks pass. Continue to 135.
