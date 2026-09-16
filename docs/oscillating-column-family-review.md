# D'Ectol oscillating-column family: 445–446

[445](https://507movements.com/mm_445.html) and [446](https://507movements.com/mm_446.html) share Brown's caption: **all solid parts are fixed**. Water from a continuously supplied smaller upper tube spreads over a concentric circular plate in a larger lower receiver. A water cone forms, checks the throat and raises the upper column before collapsing. The two engravings show different phases of that fluid-only action. Neither official page supplies a canvas animation; both mark the animation unavailable. Sources checked 2026-09-16.

The existing 5.6-second prescribed cone/storage schedule and the two initial source phases are retained. There is no new moving valve or mechanical drive. Minimum production playback duration is 5.6 seconds rather than compressing the entire demonstration to two seconds.

## Corrections

- The smaller tube now has a finite wall and open bore. The receiver has a finite wall with a genuine round side discharge opening. Its outlet is a hollow pipe built with the shared `curvedPipeWall` helper.
- The upper reservoir has one floor with a circular throat, replacing an open full-depth slit between two blocks. Reservoir and nozzle water meet through that passage and clear the solid floor.
- A thin film carries water across the fixed plate into an annular curtain. The former heavy raised plate rim moves to the side edge; it no longer intersects the depicted film. The curtain's footprint remains inside the receiver, while opacity indicates relative discharge. It no longer expands through the plate and receiver during a surge.
- The lower water region reaches the floor with small geometric clearance and leaves space for the plate stem and tapered foot. Outlet-water radius changes with the illustrative discharge while its length remains fixed, avoiding an incorrectly stretching discharge stream and pipe-wall penetration.
- Descending tracers follow continuous curved paths from the throat, over the plate and into the receiver. Their travel uses the integral `phase - V_upper/(Q_supply*period)` rather than `phase*instantaneous_flow`; it therefore remains continuous and forward-moving through flow changes. Outlet tracers share that integrated timing and pass through the actual bore. Cyclic resets fade to zero size.
- Rising tracers now move upward during storage filling; the former decreasing phase moved them downward. Their appearance follows the smooth storage-rate envelope. The cone crown also grows from zero instead of popping into view at a finite size.
- Transparent fluid and vessel materials do not cast/receive opaque shadows. Tracers do not cast mechanical shadows. Fog and scene ground are disabled, the display foundation is hidden, and the default camera is near the source section view.

The shared bored-lathe, finite-plate and fluid-passage components are reused. Only the fixed receiver's round side opening is baked offline; it has 1,076 triangles and 26,800 bytes, with no browser CSG.

## Validation

```sh
node --test tests/oscillating-column-working-interfaces.test.mjs \
  tests/movement-445.test.mjs tests/movement-446.test.mjs
```

21 tests pass: 15 existing source/phase/storage/continuity tests and six scoped tests. A legacy fluid-description assertion now distinguishes scalar storage bookkeeping from a volume-conserving fluid solve.

The finite tests use actual rendered vertices, edge midpoints and face centroids at 18 phases, including the two source states, cone transitions and maximum storage-rise/discharge rates. Extra sections through the long outlet-water triangles prevent a thin receiver wall from falling between ordinary sample points. They compare visible fluid envelopes and tracers against the receiver, floor, nozzle, discharge pipe, circular plate, stem/foot, upper reservoir and fixed rims.

Each model executes 11,995,956 selected queries. No penetration exceeds the 1e-5 tolerance. The minimum sampled distance is approximately zero at the intended water-on-plate boundary. This is selected finite surface evidence, not continuous collision certification or hydrodynamic validation. Separate checks establish forward integrated discharge travel, upward rising tracers, no visible marker jumps at phase joins, fixed hardware, stable geometry/GPU arrays, material fog and timing disclosures.

Representative local construction costs: 42 ms (445) and 37 ms (446). Mean updates over 1,000 calls: 0.015 and 0.010 ms. Initial visible geometry: 19,272/21,608 triangles. No geometry is allocated during playback.

Chrome source/default/front/advanced captures show the circular plate, open throat, receiving vessel and side outlet clearly. Seventeen poses spanning each full authored cycle stay within the camera frame (maximum projected absolute X/Y coordinate 0.832 for both models); no browser errors occurred. The captured default scenes render 67/73 draw calls and 33,396/38,068 triangles, including renderer passes. The transparent full vessels are explanatory replacements for the engraving's cut sections; they retain the fixed-part arrangement without claiming exact source dimensions.

## Reproducing the receiver port

Use Python with `manifold3d==3.5.3` and its numpy dependency, outside the repository environment:

```sh
python -m venv /dev/shm/column-port-venv
/dev/shm/column-port-venv/bin/pip install manifold3d==3.5.3
/dev/shm/column-port-venv/bin/python scripts/generate-oscillating-column-port.py
```

Two successive generations of `src/simulation/generated/oscillating-column-port.js` were byte-identical: SHA256 `8a6917c922a2d326599c2395941ed902cb1ac6ea8062dbc8d2b16134041e745c`. Bulk review artifacts remain in `/dev/shm`.

## Limits

The scalar relation `Q_down = Q_supply - dV_upper/dt` closes exactly over a cycle. It does **not** demonstrate conservation of the combined rendered cone, curtain, plume and reservoir volumes: those meshes illustrate the source narrative and can overlap each other. Cone formation, stability, pressure recovery, water hammer, entrained air, breakup, fluid losses and the device's real operating threshold are unvalidated. The source gives no dimensions, head, pressure, flow rate or timing; those values remain inferred.

Pipe-to-casing and pipe-to-floor interfaces use roughly 0.005 scene-unit construction clearances; seals and leakage are not solved. Marker paths and radial flow-envelope dimensions are explanatory reconstructions. No MuJoCo or CFD claim is made for this fluid-only mechanism.
