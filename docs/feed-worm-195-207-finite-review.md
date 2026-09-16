# 195/207: finite worm wheels and shaft interfaces

This follows [the earlier worm pass](movement-195-207.md). The primary [195 plate and caption](https://507movements.com/mm_195.html) specify identical wheels with opposed working faces around one screw. [207](https://507movements.com/mm_207.html) uses two screws on one shaft. Both fetched pages mark animation unavailable and contain no inline `add_model` or `mm_present` registration. There is no official motion oracle for this pass.

195's painted tooth spaces and uncut disks are replaced visibly by actual face recesses. `scripts/generate-face-worm-195.mjs` sweeps the **rendered solid worm triangles** through the synchronized 24:1 relation and records the lower face envelope over one tooth. The 64-angular by 24-radial grid is generated offline through 2,400 cutter poses. Its 15,021-byte module is instantiated around each wheel; the second identical wheel reverses its working-face orientation and retains the existing half-tooth assembly phase. The backing remains at least 0.1148 thick. A continuous bored rear facing preserves the source's smooth concealed-tooth wheel back and suppresses artificial sector shading seams. The original uncut disks and painted slots are retained only as hidden legacy metadata, not visible working geometry.

207 retains the previously audited opposite-hand generated wheel flanks. Both models now have actual shaft bores through the hubs. 195's central wheel stock and continuous rear facings are bored too. Face indexes sit on their wheel faces and clear the hubs; floating input dots are hidden. Output shafts are shorter, and the unpictured invented bearing frames are omitted. Bearings beyond the source detail remain unspecified rather than being represented by solid posts crossing the shafts. A returned near-frontal camera, full-turn visible bounds, fogless materials and hidden ground reproduce the plate arrangement more clearly. The complete 207 wheels continue the source's dotted upper arcs.

## Finite evidence

The selected-interface checks use rendered triangles, not nominal pitch metadata:

- **195:** both directions of the worm/closed-sector surface test at 17 input phases: **1,195,020 queries**, no sampled penetration, minimum gap **0.00348288** model units. The same phase sample includes both opposed working faces.
- **207:** unchanged working geometry repeated at 17 phases: **1,185,462 queries**, no sampled penetration, minimum gap **0.000344619**. The earlier 65-pose report remains applicable to these unchanged tooth flanks.
- At every sampled phase, independent wheel triangle centers have nearby actual worm triangles with opposing outward normals, a resisting input torque and the intended signed output torque. Maximum qualified working-face gap is **0.00667309** for 195 and **0.00159263** for 207. This prevents accepting a cleared wheel whose remaining faces cannot act in the useful direction.
- Seventeen actual shaft-surface sweeps check the new hub, center, rear-facing and existing worm bores. Full wheel-turn vertex bounds and stable geometry buffers also pass. Tests verify positive signed sector volume, periodic profile seams and remaining backing stock.

The first 96×32 face grid rendered too densely. The final 64×24 grid also removes unnecessary radial subdivision of each planar back and passed the same clearance and useful-face tests. Its slightly larger running gap is a disclosed accuracy/performance tradeoff, not an exemption from nonpenetration.

## Limits

These are finite geometric corrections with **prescribed** 24:1 motion. Positive running gaps require backlash take-up before loaded contact; proximity and useful normal direction do not establish simultaneous zero-gap engagement, actual load sharing, friction, wear, efficiency or passive dynamics. No MuJoCo result is claimed. The wheel counts, pressure angle, thread section, axial depths, backing and fits are inferred. 195's generated scalloped face valleys differ from the engraving's schematic straight spaces. The checks are sampled selected-interface evidence, not an exhaustive continuous all-pairs proof or manufacturing design.

## Reproduction

```sh
node scripts/generate-face-worm-195.mjs --check
POSES=17 node scripts/review-feed-face-worm-solids.mjs
MOVEMENT=207 POSES=17 REPORT=/dev/shm/feed-worm47-207-solids.json node scripts/review-feed-face-worm-solids.mjs
node scripts/review-feed-worm-working-faces.mjs
MOVEMENT=207 node scripts/review-feed-worm-working-faces.mjs
node --test tests/feed-worm-assembly.test.mjs tests/solid-worm.test.mjs tests/feed-worm-wheel.test.mjs tests/movement-195.test.mjs tests/movement-207.test.mjs
```

Use the repository's installed Node dependencies; no Python, browser or physics runtime is needed. The generator's `--check` is byte-identical. Expected focused result: **25 tests**. Final logs are `/dev/shm/feed-worm47-final-tests.log`, `/dev/shm/feed-worm47-final-clear.log`, `/dev/shm/feed-worm47-final-faces.log`, `/dev/shm/feed-worm47-207-faces.log`, and `/dev/shm/feed-worm47-repro.log`. Working-face reports and the new 195 clearance report are in `docs/validation/feed-worm-*.json`; they describe this bounded geometric scope only.

Root's final source/default/oblique review accepted the continuous 195 back and the retained 207 arrangement. Neither view had browser errors or clipping (maximum normalized extents 0.871 and 0.889). 195 dropped from 1,245,058 to **360,322 rendered triangles including shadows**; 207 remains approximately 523,844. These are renderer observations, not contact evidence.

Final integration: the production build, CPU screen and packaged desktop/playback/
mobile checks pass. See the forty-seventh pass in [review progress](review-progress.md)
for the combined validation record.
