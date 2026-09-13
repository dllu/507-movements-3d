# Movement 088 — production diagnosis

The current reconstruction needs a source fit and finite-stop review. Production has not changed and movement 088 is not qualified.

A circle fitted to eight outer-disk centerline points has a maximum residual of 1.64 source pixels. Using that single translation and uniform scale for the entire mechanism, 23 traced cam points miss the production profile by 24.14 pixels on average (28.08 RMS, 49.54 maximum). The input-axis displacement is 22.93 pixels; the stop-body center displacements are 17.23 and 36.01 pixels. Manual point uncertainty is approximately ±3 pixels. The comparison uses the planar generated profile, excluding the small bevel; no separate cam alignment hides the difference. The source overlay is in `088-production-source-fit.svg` and the measurements in `088-production-source-fit.json`.

The initial missing-contact suspicion was rejected. Across 258 driven states, the actual Float32 cone apex reaches the native cam edge within 1.36e-8 model units. Tied nearest triangles include bevel normals with the required in-plane driving component and clockwise torque arm of 1.209–1.221. The retained axial-only normal check exits 1 because its hypothesis is false. The corrected edge-contact check passes; this is not a complete finite-contact or dynamics qualification.

The square stop bodies are far forward of the cam, with axial cone noses and very thin mounts, unlike the source's simple blocks. Prescribed wheel speed jumps from −0.98 to zero at drive end and from zero to −0.74 at the next drive start. These observations identify construction and transition assumptions requiring review; they do not by themselves establish a dynamically impossible mechanism. A corrected source-derived cam, finite stops, drive/release/dwell constraints, clearances and final playback remain outstanding.

Four corrected production views and one registered overlay were opened. The final capture has no errors or unexpected warnings and matches Node angles to 1e-12. Earlier attempts remain explicit: a duplicate Three.js warning, a navigation timeout, and four manually rejected oversized/cropped canvas frames. The isolated capture now supplies the required canvas CSS and asserts its display dimensions.

All 1,097 frozen production inputs and prior 087 second-transfer sources remain unchanged. The 507-movement goal remains active. This read-only diagnosis is independent of the continuing 087 repeated-sequence jobs.
