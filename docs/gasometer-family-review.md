# Gasometer family review: 479–480

The [479 caption and engraving](https://507movements.com/mm_479.html) show a single inverted, open-bottom bell in a water cistern, two independent counterweights, and two gas pipes through the cistern bottom. The [480 source](https://507movements.com/mm_480.html) replaces the external counterweight arrangement with an integral central sleeve sliding over a fixed central tube. Both official pages mark `id="ani"` as `class="unavailable"`; no official 2D motion oracle is supplied. Source references checked 2026-09-15.

## Bounded corrections

Both models retain their existing analytical eight-second fill/withdrawal cycle, gas inventory, water-head calculation, and source topology. The minimum production display cycle is now eight seconds. No separate output acceleration is introduced.

- Both cisterns and bell skirts now have closed finite walls, and the pipe shells have real bores. Pipe-sized holes penetrate each cistern floor. The 479 pipes extend to the displayed external inlet/outlet endpoints.
- 479's cistern radius decreases from 2.70 to 2.38 scene units, leaving its counterweights outside the wall and rim throughout descent. Its outer water annulus follows the narrower cistern and clears the bell rim; the inner water volume ends above the cistern floor.
- 479's pulley rims now have concave grooves around the actual rope section, bored hubs and stationary axles attached to the support posts. Tread index blocks that obstructed the rope are hidden; face indexes remain. Counterweight sockets meet the rope endpoints, and extended bell lugs join the crown seam.
- Both crowns have closed shell thickness. The 480 crown has a central aperture joining the moving sleeve, rather than allowing the fixed guide to pierce an unperforated roof. Both central guide tubes have finite bores; the tinted dome gas region also clears the guide sleeve.
- Near-front default views make the source relationships legible. Transparent vessel and fluid materials do not cast or receive opaque shadows, and the pipework remains visible through them. All materials ignore fog and the scene ground is hidden.

The shared `bored-lathe-geometry.js` and `finite-plate-geometry.js` components provide turned bores, grooves and floor apertures. There is no offline bake or browser collision generation; these simple surfaces are inexpensive deterministic primitives. All simulation updates preserve scene objects and GPU attribute arrays.

## Verification

Run:

```sh
node --test tests/gasometer-working-interfaces.test.mjs tests/movement-479.test.mjs tests/movement-480.test.mjs
```

25 tests pass, including 19 existing source/kinematic/pressure/inventory/framing tests. Six focused tests check finite interfaces, positive signed wall volume and outward winding, stable geometry and typed arrays, fog/ground settings and explicit timing/force disclosures.

The finite audit samples vertices, edge midpoints and face centroids from the actual rendered meshes at 17 poses spanning the complete eight-second cycle. Additional sections through actual pipe triangles at three floor heights catch the thin-floor crossing that coarse surface points alone could miss. It checks rope/groove surfaces, axle bores, descending weights against the cistern, bell skirt/rim against the cistern, pipe passages, and 480's guide against its moving sleeve, sleeve rims, roof aperture and gas dome. This is a selected surface audit, not a proof over every part or every continuous pose.

- 479: 716,312 queries; no penetration beyond the 1e-5 tolerance. Smallest sampled gap is 0.001996 scene unit.
- 480: 944,928 queries; no penetration beyond the tolerance. Smallest sampled gap is 0.001996 scene unit.
- Cold construction on this machine: 79 ms (479) and 23 ms (480). Mean update over 1,000 calls: 0.0155 ms and 0.0113 ms. Visible geometry: 48,596 and 34,048 triangles, before shadow/render-pass duplication.
- Chrome source/default/front/advanced-phase review checks 17 complete-cycle poses and reports no page errors or clipping. Maximum absolute projected vertex coordinates are 0.745 and 0.748. Bulk screenshots and logs remain in `/dev/shm`.

## Remaining limits

Motion is prescribed, not the result of integrated gas pressure, water displacement or passive pulley dynamics. Pressure uses an illustrative quasi-static weight balance with assumed dimensions/masses; bell buoyancy detail, guide friction, rope elasticity, pulley inertia, gas temperature changes, pipe pressure losses and liquid slosh remain unvalidated. The grooved ropes have a small positive construction clearance and prescribed no-slip pulley rotation; this is not a force-contact qualification. The ideal rope length law is unchanged.

Tinted water and gas regions and flow markers communicate state, not a resolved fluid domain: they do not subtract every immersed pipe or socket volume, and the external water level remains prescribed. The visible vessel proportions and pipe layouts are source-informed reconstructions rather than dimensioned historical manufacture. No MuJoCo claim is made because this pass corrects determined paths and finite interfaces without resolving a new passive degree of freedom.
