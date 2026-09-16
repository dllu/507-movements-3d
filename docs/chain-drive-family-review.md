# Chain drives 227–229

This bounded family pass corrects finite chain/wheel interfaces while retaining the existing continuous, fixed-pitch chordal motion. It does not solve a loaded flexible chain.

## References and changes

Primary references: [227](https://507movements.com/mm_227.html), [228](https://507movements.com/mm_228.html), and [229](https://507movements.com/mm_229.html). The official inline animation scripts exist for 227 and 229; 228 has no animation. The existing 12-position/six-tooth 227 and 14-pitch 229 laws retain their source pitch circles, link lengths and tangent directions. Unlike the site's linearly interpolated chain advance, the authored path preserves every rigid link length through chordal entry and exit. No ornamental outlines were traced.

- **227:** widened the alternating perpendicular wire loops so adjacent links and the finite wheel slab fit. An offline sweep cuts only the portion of each wire loop that intersects the wheel's depth; projecting the entire perpendicular link would incorrectly erase the tooth that enters its opening. The six-lobed wheel is an inferred finite working contour, not an exact tracing of Brown's rounded visible silhouette.
- **228:** replaced the widely separated trapezoid flanks with swept transverse-rung pockets. Alternating side-row layers now clear one another, and the eyes fit their rungs. Disk and hub have genuine shaft passages.
- **229:** added the missing second hinge bore, corrected both bore-wall windings, removed bevel expansion from the working plates, and swept their finite profiles out of the wheel. The alternating plates retain actual axial overlap with the wheel.
- All three hubs fit their actual shafts with small journal clearance. Fog and ground are disabled; source-facing cameras and full-cycle bounds include the free chain ends rather than cropping them at the original page boundary. Four authored seconds per wheel turn remains the minimum display cycle.

## Reproducible geometry and checks

Run `node scripts/generate-chain-drive-profiles.mjs [output-path]` from the repository root. It requires the existing Node dependencies only (`three` and `polygon-clipping`). The deterministic bake uses 129 poses per repeated tooth sector, 0.0008 model-unit cutter clearance, and 0.00002 outline simplification tolerance; 227 includes both link planes. These are dimensionless reconstruction units, not physical millimetres. The resulting `chain-drive-profiles.js` is 24,979 bytes. Regenerating to `/dev/shm/chain-drive-profiles-repro.js` and comparing with `cmp` was byte-identical. Browser construction only extrudes those saved polygons and reuses the 228 tooth geometry.

Run:

```sh
node --test tests/chain-drive-working-parts.test.mjs tests/movement-227.test.mjs tests/movement-228.test.mjs tests/movement-229.test.mjs
```

The 28 checks cover existing 32,769-state rigid-pitch regressions and continuous handoffs, 65-pose rendered finite-solid sweeps, actual shaft/hinge passages, stable geometry buffers, visible triangle budgets, outward profile winding, and complete cycle bounds. Long-cylinder triangles are additionally intersected at the thin eye layers; checking only cylinder ends and triangle centroids missed 229's reversed bore walls.

| Movement | Minimum wheel/chain gap | Largest closest driving-flank gap | Minimum positive work component |
| --- | ---: | ---: | ---: |
| 227 | 0.001256 | 0.001256 | 0.20194 |
| 228 | 0.0007622 | 0.0007911 | 0.89126 |
| 229 | 0.0005358 | 0.0005359 | 0.80086 |

The driving-face check uses actual baked boundary segments and rendered link surface points within the wheel's axial layer. It requires a nearby face on an engaged wrapped link, with the wheel's outward normal doing positive work along the clockwise chain velocity (and therefore a resisting reaction on the wheel). Clearance alone is not accepted as evidence of useful engagement.

Local source/default/front/advanced browser captures produced no errors or cycle clipping. Maximum NDC extents were 0.850/0.835/0.864 for 227/228/229; rendered triangle counts including shadows were 35,136/84,336/36,144 with 34/114/82 draw calls. RAM evidence is `/dev/shm/chain-drive-final-{227,228,229}-{default,front,advanced}.png` and `/dev/shm/chain-drive-final-browser-review.json`. Warm factory construction was approximately 8–19/3–7/3–4 ms respectively on the review host (227's first cold call was 64 ms).

## Limits

The chain follows a prescribed open path. The tests qualify selected finite interfaces at sampled poses; they do not establish a continuous collision proof or load-bearing dynamics. The small working gaps require backlash take-up before force transfer. Tension, joint play, gravity-induced sag, elastic stretch, friction, load sharing and transient tooth loading are not simulated. The source does not dimension link depth or complete support structures; these dimensions are inferred. MuJoCo was not needed to establish the existing determinate path, and no passive-force validation is claimed.
