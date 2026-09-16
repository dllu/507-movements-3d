# 363: source-proportioned fulcrum and finite bearings

The [primary page](https://507movements.com/mm_363.html) and engraving describe a seesaw. Its inline `mm_present` / `ae.add_model` animation contains a cosine interpolation between the ±30-degree beam rays. That motion is retained unchanged, including the four-second cycle.

The source model puts the pivot four units above the base's top and the beam end 4.5 units from the pivot. The former reconstruction used a 1.34-high pivot with a 2.82 half-span, making the stand much too short. Its plank reached approximately −0.135, below the nominal ground at −0.09. The corrected pivot is 0.18 + 2.82 × 4/4.5 = 2.68667, with the base width scaled consistently. The source's lower brace attachments replace the previous near-axle A-frame apex.

Finite interfaces are corrected together:

- The central cross-depth post ends 0.36 below the pivot, clear of the moving beam and boss. Two rounded front/rear cheeks connect the foundation to the axle.
- Both fixed cheeks have actual 0.108-radius axle bores around the 0.105-radius shaft. The moving boss, plank and edge rails all have 0.109-radius apertures; opening only the boss would leave the plank and rails intersecting the axle.
- The boss length is 0.54 and the cheeks' inside planes are at ±0.34, leaving 0.07 axial clearance. The cheeks are closed finite plates, not transparent sleeves.
- Seats now meet the plank instead of floating 0.02 above it. The fixed axle reaches its retaining caps, and the shortened lower post joins the cheeks.

At 129 full-cycle poses the minimum moving-body height is **1.16055**. A 65-pose finite surface audit finds minimum axle/moving-bearing clearance **0.0038688**, and minimum moving-body/fixed-support clearance **0.0700000**. The fixed cheek bore has approximately 0.003 radial clearance. These checks include both surface-query directions for moving/fixed pairs; they are bounded geometric checks, not an exhaustive collision proof.

The official cosine law remains prescribed. Rider forces, masses, bearing friction and balance dynamics are not solved, and the viewer's `reconstructionNote` says so. The paired cheeks and depth stack reconstruct interfaces not specified by the 2D source. No MuJoCo study is necessary to reproduce this single determinate display angle. The source-facing camera fits a sampled full-cycle envelope, the ground and fog are disabled, and `minimumDisplayCycleSeconds=4` prevents the global timing layer from accelerating the swing.

Validation:

```sh
node --test tests/movement-363.test.mjs tests/seesaw-finite-supports.test.mjs
```

All 11 checks pass: seven retained source/motion regressions and four new finite support, swept framing, stability and timing checks. Root integration performs the shared browser/source comparison; this lane did not launch Chrome.
