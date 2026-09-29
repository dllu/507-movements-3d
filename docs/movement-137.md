# 137: baked shaped expansion eccentric

Browser 137 now uses a shaped cam and passive fork/roller/valve-rod motion
recorded from MuJoCo. It no longer loads the preceding circular-cam model or
runs physics in the browser. The gzip bundle is approximately 1.03 MB, including
geometry and 15,875 trajectory samples. Playback preserves the simulated startup,
then repeats an eight-second settled cycle. Restart restores the initial state.

The [engraving and caption](https://507movements.com/mm_137.html) show a shaped
expansion eccentric driving a forked arm, with the valve rod pinned to its lower
end. The reconstruction interpolates 25 visible-edge landmarks with a closed
centripetal spline. Visible-edge error is below 0.15 engraving pixels. The arcs
hidden behind the rollers are inferred, not measured.

The preceding circular model missed the visible contour by as much as 23.94
pixels. Even a best-fit circle left 14.50 pixels of error. That diagnosis is
preserved in the [legacy circular-model overlay](validation/137-outline-review.svg)
and [measurement report](validation/137-outline-review.json); the review script
still reads the legacy registry factory, not the new browser loader.

## Contact reconstruction and assumptions

The measured roller centres and approximate 31/32-pixel radii interfere with
the traced cam during a complete turn. A geometric sweep finds about 23.5 pixels
of incompatible travel at the worst orientation. Each roller is therefore moved
12 pixels outward from the fork centreline. This is an explicit reconstruction
compromise, not agreement with those measured dimensions. The fork casting is
adapted at its ends to meet the displaced axles.

Only the cam is actuated. The fork and both rollers have passive hinges; a
separately hinged valve rod hangs from the lower axle. Gravity takes up the
variable free travel between contacts. No fork-angle handoff is scripted.
Fork/rod masses, inertia, damping, friction, axial depths and the connected rear
bearing mount are inferred. The valve rod is unloaded; no downstream steam-valve
mechanism is modeled. Cam collision uses 384 triangular prisms and spherical
roller proxies for contact in the mechanism plane; visible rollers are cylinders
with the same working radius. The fork sits behind the cam/rollers, the rod
in front, and axles pass through real bores.

## Validation and reproduction

Separate timestep and tessellation checks, plus their combined refinement,
compare motion from 8–19.99 seconds. Maximum roller-position sensitivity is
0.0323 pixels for the timestep, 0.1542 pixels for the mesh and 0.1410 pixels for
both. All runs finish without resets. The selected 0.00025-second, 384-cell run
has maximum contact penetration of 0.0726 engraving pixels. Source hashes and
results are in the [physics report](validation/137-physics-prototype.json).

Pass 97: the rollers carry solid-disk inertia (mass 0.3, axial inertia 0.015)
and the roller spread is 4.05 pixels (was 4), which removes a 0.03-pixel pinch
that stalled the cam by up to 0.08 radians once a turn. The bake keeps only one
steady-state cycle, from 16.25 seconds (cam at the engraved pose), so playback
starts and loops at steady state. The lower roller runs 0.07–1.18 pixels clear
of the cam while the upper roller bears on it, so in the simulation it barely
touches the cam and would stand still; its angle is integrated kinematically
from no-slip rolling on the nearest cam point. The same integration reproduces
the upper roller's simulated spin to 0.04% (slip at most 0.3 pixels/second).
Its maximum position seam is 0.0067 pixels and velocity seam is 0.17
pixels/second for the cam, fork, upper roller and rod.
Roller angle winding is preserved across loops; roller faces are rotationally
symmetric. Tests independently check interpolated cam/roller clearance, rod-pin
alignment, motion bounds, restart, serialization and source provenance. The
packaged desktop/mobile test checks play/pause/restart and absence of WASM
requests. No ground plane or fog intersects the mechanism.

```sh
PROBE_SECONDS=32 PROBE_REPORT=/dev/shm/137-coarse.json node scripts/probe-expansion-eccentric.mjs
SIM_OPTIONS='{"timestep":0.00025,"samples":192}' PROBE_SECONDS=20 PROBE_REPORT=/dev/shm/137-time-refined.json node scripts/probe-expansion-eccentric.mjs
SIM_OPTIONS='{"timestep":0.0005,"samples":384}' PROBE_SECONDS=20 PROBE_REPORT=/dev/shm/137-mesh-refined.json node scripts/probe-expansion-eccentric.mjs
SIM_OPTIONS='{"timestep":0.00025,"samples":384}' PROBE_SECONDS=32 PROBE_REPORT=/dev/shm/137-fine.json node scripts/probe-expansion-eccentric.mjs
node scripts/compare-expansion-eccentric-prototype.mjs
node scripts/bake-expansion-eccentric.mjs
node --test tests/expansion-eccentric-profile.test.mjs tests/expansion-eccentric-bake.test.mjs
```

The earlier circular factory remains in the legacy registry for its historical
measurement script. Browser loading routes 137 directly to the baked model.
Continue the review at 138, retaining the spacing/hidden-contour qualifications
above rather than claiming an exact reconstruction of the drawing.

## Pass 99: dimples kept

The cam is redesigned from its pitch curve. The upper roller's centre path has a polar radius about the shaft built from the constant term and odd harmonics only (1, 3, 5, 7), so the pitch diameter is constant at 218.3 px. The edge is the inner envelope of the 31 px roller rolled round that path.

- **Fit.** Brown's visible landmarks fit to 3.62 px RMS, 7.9 px maximum.
- **Dimples.** His three dimples are kept as concave hollows with a concave radius of at least 122 px.
- **Lower roller.** It runs 0.07–1.65 px clear.

See `docs/p99-c-review.md`.
