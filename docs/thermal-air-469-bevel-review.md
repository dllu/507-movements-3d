# Movement 469: finite bevel transmission follow-up

This resolves the smooth-cone transmission residual from [the thermal/steam family review](thermal-steam-family-review.md). The [official 469 engraving and caption](https://507movements.com/mm_469.html) show the inclined screw geared to the wheel across perpendicular shaft directions. The source supplies no tooth count, cone section or dimensions; the previously checked page has no inline animated model.

## Change

Two 24-tooth, equal 45-degree miter gears replace the toothless cones. They reuse `bevelToothGeometry` / `bevelBodyGeometry`: finite straight-bevel teeth with the shared Tredgold back-cone involute approximation. Outer pitch radius and axial distance are both 0.32; inner axial distance is 0.20. Tooth height is 0.06, with 0.96 thickness factor for a small clearance. These inferred sections are not generated octoid flanks or manufacturing data.

Both gears now share one cone apex, 0.56 units beyond the barrel mouth along the existing screw axis. This lets the input gear clear the barrel. The output shaft and water-wheel center move with that apex, keeping the existing 18:54 spur center spacing. The spur gears move to the rear plane at z=-0.56, leaving space behind the output bevel's conical teeth. The wheel hub extends back to join that layer; the small spur gear also receives a real shaft bore.

Each bevel body and hub has a 0.067 bore around its 0.065-radius shaft. The finite shaft ends stop before their perpendicular intersection, so they do not pass through one another. Both bores and the rear spur layer remain visible from the oblique/rear views. A white tooth identifies rotation.

The host shafts retain their existing equal opposite rotations. Initial tooth phases are calculated from the common pitch generator: a tooth center on one gear meets a space center on the other. This preserves the rotation direction, 1:1 bevel ratio, 3:1 spur ratio, screw hand and air-transport schedule. No thermal or hydraulic behavior was expanded.

## Validation

The independent finite-surface audit transforms the actual rendered tooth, body and hub meshes through 49 uniformly spaced poses over one tooth period, in both directions. Minimum separation is **0.0009845**; the closest opposing tooth flanks stay within **0.0012** at every sample. These checks bound both interference and an excessive disengagement gap; the small residual is intentional geometric clearance, not a simulated loaded tooth contact.

Focused checks also verify the common world-space apex and perpendicular shaft axes, both outer pitch generators, actual bore clearance, separated shaft ends, input-gear clearance above the barrel and separation from the rear spur layer. The prior spur, gland, wheel-axle and 474 checks remain included as guards against changes in the shared helper.

`node --test tests/movement-469.test.mjs tests/movement-474.test.mjs tests/temperature-air-469-bevel.test.mjs tests/thermal-steam-469-474-solids.test.mjs`: **31 tests pass**. Browser default/front/rear views were compared with the engraving; zero visible vertices leave the default viewport across 65 sampled poses. Artifacts remain in `/dev/shm`.

The mesh study is sampled, not an exhaustive manufacturing or contact-force validation. Rotation remains an analytical gear constraint. Torque, backlash under load, shaft/key stresses, bearing loads, pressure, bubble dynamics and thermal startup remain unsolved. The existing 13.8-second readable cycle and explicit external thermal reset are unchanged.
