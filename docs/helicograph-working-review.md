# 384 helicograph: working screw, wheel and paper interfaces

Primary reference: [Brown's caption and engraving](https://507movements.com/mm_384.html), also inspected in the local scan. The page has no official canvas animation. Brown specifies a wheel that advances along a threaded radial axle while travelling around a fixed point and transfers a spiral through coloured transfer paper. The original provides no thread dimensions, force law or absolute timing.

## Correction

The old external thread was an open tubular helix with its inner surface 0.026 model units above the core. The female wire also floated inside its hub and did not form a load-bearing mating screw. Both now use the shared closed square-thread generator from `mujoco-screw/thread-geometry.js`. Male thread roots overlap the core; female thread roots overlap the bored hub. The nut's working thread is half a pitch from the male turn, with 0.004 radial and 0.003 nominal axial flank clearance. Its phase remains compatible with the unchanged relation `r-r0 = lead*wheelAngle/(2*pi)` throughout advance and return. Geometry is constructed once; no collision geometry is rebuilt during playback.

The wheel's actual nominal bottom now lies on the transfer-sheet surface at Y=0.008, eliminating the former 0.032 gap. A denser but still small circular rim limits polygonal contact separation. The completed spiral is a flat pigment graphic beneath the transparent transfer sheet, replacing a raised tube through which the wheel passed. A protruding tread index and contact-marker solid are hidden; the remaining face index sits on a spoke and still makes rotation visible.

Odd spokes previously faced tangentially because their rotation sign opposed their centre placement. All eight now run radially between the hub and wheel face. The orbiting bridge has a real bore around the fixed centre spindle. The centre cone points down onto the paper, and the spindle reaches its holding knob. Materials ignore fog, generic ground is hidden, and the full 12-second authored demonstration is the minimum display period.

## Analytical motion and limits

The existing logarithmic law is retained:

`r(theta) = r0 * exp[-lead*theta/(2*pi*wheelRadius)]`.

Wheel spin cancels circumferential velocity at the ideal circular contact, while radial advance produces unavoidable axial scrub. The smooth prescribed hand motion reverses and retraces the same curve. This is not pure rolling in both horizontal directions. Finite mesh tessellation leaves a small positive contact gap at some poses; the kinematic law uses the ideal circle.

The finite thread clearances represent a centred unloaded assembly, not a claim that loaded flanks touch simultaneously. Friction, contact force, backlash take-up under load, paper compression and pigment transfer are not solved. The transfer sheet remains an ideal thin surface; the trace is a visual record displayed throughout both passes. These limits are visible in the reconstruction note. No MuJoCo solve is needed to establish the determined unloaded geometry and analytic path.

## Validation

```sh
node --test tests/helicograph-working-parts.test.mjs tests/movement-384.test.mjs
```

**13 tests pass**: eight analytical/source/binding regressions and five new finite/interface checks. Final log: `/dev/shm/helicograph-tests.log`, approximately 4.51 seconds. The old reference-helix assertion now requires half-pitch interleaving rather than coincident male/female tooth centre lines. A roundoff tolerance changed from 3e-16 to 8e-16 after lowering the drawing plane; all geometric tolerances are independently bounded.

| Study | Measured result, model units |
| --- | --- |
| Actual male/nut triangles, both directions, 33 full-cycle poses | Minimum separation 0.002182 |
| Male thread / hub bore | Minimum separation 0.003913 |
| Core / female thread | Minimum separation 0.003952 |
| Screw / wheel spokes | Minimum separation 0.0410 |
| Opposing axial working flanks, 65 poses | Maximum nearest gap 0.002642; axial normal component at least 0.8407 |
| Actual finite rim / transfer sheet, 65 poses | Gap 0–0.0001143; no sampled penetration |
| Fixed spindle / bored orbiting bridge, 17 poses | Minimum clearance 0.003891 |

The selected thread/hardware studies issue about 9.95 million bounded triangle queries. Shaft checks include intersections with interior bearing planes so shaft endpoints outside a thin bearing cannot conceal an interference. Tests also cover the downward needle point, spoke direction, spindle/knob attachment, outward thread and trace winding, all visible vertices inside the full-cycle camera bounds, fog flags and stable scene/geometry buffers.

The model has 21,238 visible triangles before shadows. Local construction measured 121 milliseconds on the first call and 39–69 milliseconds warm. These are ordinary analytic solids; no expensive contour extraction, live physics or runtime mesh regeneration is introduced. Final source/default/browser review is performed centrally with the batch.
