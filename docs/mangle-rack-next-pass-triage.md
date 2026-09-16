# Mangle racks 197–199: finite-contact triage

The next shared rack lane can reuse the finite envelope cutters and guide
construction from 192–194. The sources describe a rising/falling pinion in
[197](https://507movements.com/mm_197.html), a fixed pinion with a suspended
rack in [198](https://507movements.com/mm_198.html), and a partial lantern
pinion switching between opposed racks in
[199](https://507movements.com/mm_199.html).

All three full HTML pages register their matching `mm_197`, `mm_198` or
`mm_199` animation. These are motion references; their displayed profiles are
not proof of finite tooth contact. No production changes are made by this
triage.

A short 33-pose sweep samples rendered tooth/pin surface vertices and triangle
centers against the opposing actual solid. It finds the following penetration
witnesses in model units. These establish defects, not exhaustive maxima.

| Movement | Penetration | Authored time | Cycle phase | Moving object |
| --- | ---: | ---: | ---: | --- |
| 197 | 0.10275282 | 12.43547092 | 0.59375 | Rack pin 4 |
| 198 | 0.10282703 | 4.36332313 | 0.125 | Rack tooth 34 |
| 199 | 0.00963768 | 2.61799388 | 0.375 | Lantern pin 0 |

Witness coordinates in the tested opposing solid's local frame are:

- 197: `(-0.19123526, -0.60273776, -0.04333334)`.
- 198: `(-0.19169478, -0.33222738, -0.11333333)`.
- 199: `(0.60125033, 0.76403600, -1.18e-17)`.

197/198 use ordinary pinion profiles against quite different finite rack
elements. Generate compatible working surfaces through both straight runs and
terminal turns, keeping their distinct rising-pinion/suspended-rack topology.
199's special entry teeth must remain capable of driving the reversal; reducing
them solely for clearance would not establish correct pickup. Check actual
load faces, reaction directions and continuous transfer alongside the source
animations. Preserve useful finite tooth depth and engagement.

The scoped factories are `capsuleGuidedMangleRack`,
`fixedPinionLiftedMangleRack` and `partialLanternPinionMangleRack` in
`authored-gears.js`. Shared work should use isolated helpers and coordinate
factory/import edits. The temporary witness script and JSON are
`/dev/shm/mangle38-triage.mjs` and `/dev/shm/mangle38-triage.json`.
