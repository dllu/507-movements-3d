# Cylinder escapements 294–295: finite working geometry

This replaces the intersecting point-driven reconstruction documented in the [earlier support review](cylinder-escapement-family-review.md) and [rejected first-contact study](cylinder-escapement-contact-study.md). Both views now share the same curved teeth, rounded cylinder and offline motion. **This is a surface-near geometric qualification with running clearance, not a zero-gap loaded simulation or a validated watch oscillator.**

## Sources and construction

[Brown 294](https://507movements.com/mm_294.html) supplies the perspective cylinder; [Brown 295](https://507movements.com/mm_295.html) shows successive outside/inside engagements. Neither page has a registered animation. The three plan outlines are still represented as successive states of one physical cylinder.

The construction follows the primary [1904 Keystone, *Watch and Clock Escapements*, Figs 129–131](https://www.gutenberg.org/files/17021/17021-h/17021-h.htm). Its decisive feature is a locking point on a **smaller wheel radius than the heel**, joined by a circular impulse face. The earlier teeth had that relation reversed. Analytical circles and intersections replace outline tracing. The chosen face spans 10° of wheel angle, with inferred drop allowance; the historical construction permits varying lift. The impulse-face circle radius equals the point-orbit radius, and the cylinder center lies on the face chord's perpendicular bisector. A unit-vector and shared-endpoint check prevents accidental distortion of the compass construction.

The resulting point/heel radii are about 2.852/3.05 model units. The cylinder has a 196° working extent with rounded lips. Its inner bore has a **0.002 model-unit running allowance**, under 1% of its radius: an exact diametral fit made clearance at the point drive the opposite heel into the bore. Cylinder radius and center now follow the tooth construction; Brown's undimensioned proportions therefore remain inferred. The source-facing perspective/plan arrangements and complete wheel are retained.

Raised stems and their wheel feet move with the corrected tooth centroid. The stems lie inside the finite head footprint, and the old unrelated lip bars and nominal contact traces are hidden. Previously corrected hollow passages and bored bearings remain. Replaced shared head/foot geometries are disposed once. The white marks sit on the new tooth faces.

## Motion and qualification

An offline first-obstacle search determines the clockwise wheel position from the finite shapes and an imposed 60° balance half-swing. It includes neighboring teeth. The two release jumps are replaced by finite quintic drops while the balance briefly pauses beyond release. Shape-preserving cubic interpolation gives continuous positions and velocities at every knot and cycle boundary. The wheel advances exactly one 24° tooth pitch per 4-second authored cycle; displayed playback takes at least 6 seconds. The current entry and exit advances are approximately 11.085° and 9.814°, with about 3.101° combined drop. This does not claim equal work or equal spring-energy transfer.

The baked profile and path total about 126 KB. No collision solve or contour generation runs in the browser. The generator refuses output if profiles are invalid, any sampled overlap remains, clearance falls below 0.0005, wheel reactions have the wrong sign, entry/exit reactions have the same sign, or circular-rest moments cease to be approximately radial.

Evidence:

- **1,025 interpolated poses, all 15 teeth:** zero planar overlap; minimum separation **0.00063562** model units. Actual opposing impulse reactions are retained; the profile was not cleared by deleting the drive faces.
- **129 poses of the rendered solids:** all teeth and stems against the working shell, including the reverse shell-to-tooth test, pass 83,806 proximity-filtered signed-distance queries. Minimum measured separation **0.00075247**. Existing tube-end, journal and finite attachment checks also pass.
- **Independent closest finite pairs and normal cones:** representative entry gaps are 0.000999–0.001000, resisting wheel moments 1.056–1.061, and cylinder moments −0.295 to −0.309. Exit gaps are 0.001001–0.001005, wheel moments 1.063–1.064, and cylinder moments +0.228 to +0.276. Thus both impulses oppose the clockwise wheel torque and act in opposite balance directions. Vertex contacts are checked against the incident finite-edge normal cone. Outer/inner rests have wheel moments about 2.797/2.744 and cylinder moments within 0.00111 of zero.
- Playback retains geometry buffers and scene objects. The 129-pose solid checks include preceding teeth; they do not rely on the active index selected by a point law. The model has 23,856 visible triangles in 294.
- Root inspected final source/default/oblique views: no errors or clipping, maximum normalized extent **0.77164 for 294**, **0.88365 for 295**. Captures: `/dev/shm/family44-final-{294,295}-{default,oblique}.png`; report: `/dev/shm/family44-cylinder-browser-review.json`.

The roughly 0.001 gap is intentional numerical running clearance. Force transmission at actual zero gap, spring-energy closure, friction, impacts, passive locking, rate stability and balance regulation remain unvalidated. The balance pause and drop timing are prescribed. No native dynamics result is claimed. The viewer and runtime metadata make these limits explicit.

## Reproduction

Requires Node 18/project npm dependencies and Python 3 with NumPy, SciPy 1.11.4 and Shapely 2.0.3. Bulk reports are written to `/dev/shm`.

```sh
python3 scripts/generate-cylinder-contact.py
python3 scripts/generate-cylinder-contact.py --check
node --test tests/movement-294.test.mjs tests/movement-295.test.mjs tests/cylinder-escapement-support-solids.test.mjs tests/cylinder-escapement-contact-limits.test.mjs
```

**13/13 focused tests pass** in 1.96 seconds (`/dev/shm/cylinder44-tests.log`). Obsolete tests asserting zero residual for a point inside the old tooth were replaced with actual finite-surface, neighboring-tooth, reaction-direction and continuity checks. The byte-identical generator check passes (`/dev/shm/cylinder44-bake-check.log`); its independently sampled qualification is included in the bake and `/dev/shm/cylinder44-audit.json`.
