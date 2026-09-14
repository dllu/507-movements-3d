# 136: toothed axial face cam — partial review

The [source engraving and caption](https://507movements.com/mm_136.html)
show a spring-held rod following a toothed axial rim. The existing sixteen
teeth, unequal smooth flanks and engraving-based wheel dimensions are retained.

The old rod motion sampled the cam at the follower axis and then added the
spherical tip radius. This is only correct at zero slope. Comparing that motion
with the actual cam triangles shows approximately 0.123 units of penetration
for the 0.16-radius tip.

The follower now uses the axial envelope of its sphere against the radially
extruded face profile. For contact-angle offset delta, the nearest radius is
r = R cos(delta), and the sphere's axial support is
sqrt(tipRadius² - R² sin(delta)²). The solver maximizes face height plus that
support, brackets the maximum, then refines its stationary point. Tests ensure
the radial minimizer stays within the cam annulus. Velocity and acceleration
come from the envelope derivatives; contact points and normals now refer to
the actual off-axis contact rather than the follower's axial pole.

The working rim uses 128 angular samples per tooth. Tests sweep 721 positions
against the actual triangles, check a penetrating old-motion control, compare
motion derivatives with finite differences and verify normal relative velocity.
The original profile/topology tests remain; point-follower trajectory assertions
are replaced by these finite-tip checks.

Playback prescribes the geometrically constrained trajectory and shows spring
compression. It does not solve follower inertia, load or loss of contact; positive
spring preload alone is not a dynamic contact certificate. This is an analytical
geometric reconstruction rather than a live physics simulation. The small solver
runs on the CPU; the cam mesh is created once.

Default playback is one tooth stroke per second (16 seconds per wheel revolution).
Restart is enabled, diagnostic markers are hidden, and fog/ground are disabled.
Packaged desktop/mobile checks cover play, pause, restart, errors and absence
of a WASM request.

```sh
node --test tests/spherical-face-follower.test.mjs
node --test --test-name-pattern='movement 136 drives' tests/models.test.mjs
```

The guide post, spring seats, spring wire deformation, bearings and final
engraving/camera comparison still need review. Continue with 136.
