# Movement 143: generated keyed-worm traverse

143 uses a generated worm wheel, a keyed sliding worm, bored bearings and
carriage, and a fixed-length rod attached directly to the wheel wrist.
Geometry is built offline; playback uses the analytic 22:1 gear relationship
and rod closure. One complete traverse takes twelve seconds, with 22 shaft
revolutions. No physics engine or mesh generation runs in the browser.

The [source page](https://507movements.com/mm_143.html) has no animation
(checked 2026-09-14). The 525-pixel engraving supplies the wheel center
`[269.5,338.75]`, shaft ordinate `273.5`, wrist `[251,364.25]`, and fixed rod
pivot `[472.5,332.5]`. A lower-arc raster scan favors 22 regularized teeth,
with 21 close behind in the irregular drawing. The nominal generated outside
radius is 56 pixels; the old implementation mistakenly used a 55-pixel pitch
radius and consequently a 60-pixel outside radius. See the
[measurement](validation/143-wheel-measurement.json) and
[generated-profile overlay](validation/143-generated-overlay.svg).

The axial trapezoidal worm generates a throated wheel with 20-degree flanks.
The offline reference grid has 512 angular samples per tooth and 64 axial
intervals. At 12,130 regular generating-flank points, the analytic
normal-force power residual is at most `1.73e-8` at the nominal ratio.
[Envelope evidence](validation/143-envelope.json) excludes uncut blank,
cutter-tip/root relief and axial end boundaries. It validates the regular
generating envelope; it is not a friction or loaded-backlash simulation.

The displayed wheel stores one closed tooth sector and instances it 22 times.
Decimation preserves the periodic boundaries, then sampled radial correction
removes outward excursions. Each sector has 2,850 triangles. The initial
display relief is 0.003 world units (0.2 engraving pixels); additional local
correction reaches 0.0141 units (0.94 pixels) near sharp transitions. The
worm uses a smaller display mesh with 0.001 units of radial relief. These
rendering allowances are explicit approximations, not a claim that every
displayed facet is an exact manufactured contact surface. Wheel width,
bearing depths and hidden supports are reconstructed.

The actual baked drive meshes pass 65 offset poses over one input turn, which
advances the periodic wheel by one tooth. The check includes all caps and
sector walls, finds no intersections, and establishes separation of at least
`1e-5` units at those poses. Both meshes are closed, have positive volume,
and have no opposed stored normals. See
[rendered contact evidence](validation/143-render-contact.json).

The actual baked assembly also passes 65 poses over the full traverse:
666 independent part pairs and 34,598,925 surface-point checks find no
penetrations. Same-body joins and the separately checked driving surfaces
are excluded. [Assembly evidence](validation/143-assembly.json) records
the scope; these sampled checks are not continuous swept-volume proofs.
Focused tests cover the measured rod closure, shaft/key bores, oriented
closed sectors, serialized pin alignment, framing bounds and restart.

Ten focused tests and the production build pass. Packaged desktop and mobile
checks cover playback, exact restart and orbit without requesting WASM;
front and oblique screenshots were also reviewed. The compressed asset is
1,158,769 bytes. In the headless software-rendering comparison, simplifying
the wheel reduced median frame time from roughly 212 ms to 40 ms; this is
not a native-GPU frame-rate guarantee. The loader disables fog, and disposal
releases the wheel's instance buffers as well as its geometry and materials.

The old wire-coil worm penetrated its wheel at every tested pose, by up to
4.795 engraving pixels. Its analytic pitch/phase metadata did not detect
that defect. The [legacy diagnostic](validation/143-legacy-contact.json)
remains as evidence; the old factory is no longer the application path.

To regenerate, run `scripts/refine-sliding-worm-profile.mjs`, then
`scripts/bake-sliding-worm-candidate.mjs`. Run the envelope, rendered-contact
and assembly review scripts against that private bundle; use `POSES=65` for
the assembly review. `scripts/publish-sliding-worm.mjs` checks the recorded
asset and source hashes and successful geometry reports before copying the
bundle to the application assets. Private profiles and screenshots stay
under `/dev/shm`; the shipped asset carries provenance.
