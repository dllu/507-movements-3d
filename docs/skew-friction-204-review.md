# Movement 204: finite skew friction wheels

The [primary caption and engraving](https://507movements.com/mm_204.html) show motion between oblique shafts through rolling contact. The fetched page has no inline `add_model` or `mm_present` registration, in addition to its unavailable animation tab. The original reconstruction's equal hyperboloids remain useful: their nominal surfaces roll transversely but necessarily slide along their common straight generator. The source does not specify shaft angle, dimensions, preload, friction or a supporting frame; these remain inferred.

The former open lathe bodies now have closed ends and real 0.099-radius bores around the 0.095-radius shafts. Caps and hubs use the shared bored-lathe component. Bearing posts terminate in the lower portions of their stationary rings instead of intersecting the rotating shafts. The nominal contact line/spheres and the 0.036-radius generator stripes are hidden: these were physical solids occupying the mating surfaces. Rotation is visible through flush planar end-face inlays, shortened to clear the hubs and rims. Fog and ground are disabled, the existing camera/silhouettes are retained, and the display cycle has a six-second minimum.

Finite meridian chords slightly overestimate the smooth convex hyperboloid. A radial allowance of 0.0001 model units bounds that error while preserving the working surface. Testing also found a separate 0.003849 end-cap intrusion: the cylinder's inner edge exceeded the local hyperboloid radius. The corrected cap radius is the ideal radius at its innermost axial edge minus 0.002, leaving a small end-face step rather than clipping the other wheel.

## Evidence and limits

The actual rendered triangles, rather than only ideal equations, are checked at 17 phases across a full input turn. At 17 stations along the working generator, paired closest surface points remain within 0.001074 model units and their actual face normals oppose with cosine at least 0.998069. Their longitudinal relative speed remains approximately 0.4802; finite facets introduce up to 0.007527 normal-velocity residual. Equal opposite transverse traction has the appropriate resisting input and driving output moments. This establishes a plausible friction interface, not the force needed to maintain the prescribed ratio.

Surface vertices, edge midpoints and triangle centers are checked against the other body's closed solid, including the end caps, hubs and rims. End hardware is also checked against the opposite end hardware. The 904,884 proximity-filtered queries have minimum sampled separation 0.00009151 model units and no penetration. Separate checks cover real bores, shaft clearance at the posts, flush indicator geometry, shadow/fog flags, and stable objects and position buffers. These are bounded sampled geometric checks, not a continuous collision theorem.

The 1:−1 motion is still prescribed. The faceted bodies have a small running gap, not exact loaded contact. No preload, friction coefficient, available torque, elastic compliance, wear or thermal response has been solved. Longitudinal sliding is explicit in the viewer note; the caption's rolling description must not be read as pure rolling in all directions. Native dynamics were not added because this pass corrects determinate geometry and does not claim a validated friction drive.

Run the focused checks with:

```sh
node --test tests/skew-friction-working-solids.test.mjs tests/movement-204.test.mjs
node scripts/screen-movement-batches.mjs --ids=204 --out=/dev/shm/skew204-screen.json
```

CPU screening measured 164.4 ms construction, 0.234 ms update P95, 48 visible meshes/draw calls and 69,080 visible triangles, with no new geometry or scene growth. It excludes browser imports, GPU cost and source-fit review. Test log: `/dev/shm/skew204-final-tests.log`; browser review is integrated by the parent lane.

Final result: **9/9 tests pass**. Parent source/default/oblique browser review reports no errors or clipping (maximum normalized extent 0.7780), 96 rendered draw calls and 138,160 triangles including extra passes. Captures: `/dev/shm/family45-final-204-{default,oblique}.png`; report: `/dev/shm/family45-204-browser-review.json`.
