# Movement 284: crank-rocker saw feed

Primary source: [Brown's movement 284](https://507movements.com/mm_284.html). The caption describes a crank-driven bell crank, a screw-adjusted catch driving a ratchet, and a coaxial pinion advancing the carriage rack. The complete 4,037-byte HTML marks animation unavailable and contains neither `add_model` nor `mm_present` definitions; there is no registered official animation oracle. Geometry follows the engraving's broad layout, without ornamental tracing.

## Working corrections

The previous driving nose followed a radial outer-corner contact. At cycle coordinate 0.3 (authored time 0.07794713 s), it reported zero contact error while penetrating the visible ratchet by 0.00204153 model units. Its radial contact normal produced zero wheel torque, and its projection onto the claimed working flank was −0.23275, outside that segment.

The nose now follows a fixed interior point 32% along the actual asymmetric driving flank. A 0.0002 nominal running gap offsets the finite 0.085-radius nose from that face. The existing circle-intersection construction solves the hinged pawl on the resulting center radius; the crank-rocker closure is unchanged. The screw position is recomputed to preserve one tooth of output per input revolution, moving from the old 65.1837-pixel inferred setting to 65.1097 pixels, within the engraving's dimensional uncertainty. The visible ratchet uses the same asymmetric polygon without an interfering bevel. Its actual working-face normal gives a clockwise output moment arm of **−1.14449 model units**, confirmed against rendered triangles.

The holding click previously occupied a plane in front of the wheel. It now has a finite working nose in the ratchet layer and a bored cheek in front. A small offline table follows the real tooth envelope with a continuous, bounded-rate lift/drop path. During the output dwell the holding face has the correct resisting torque direction. There is no angular teleport at the envelope's tooth-tip discontinuity. This is prescribed click motion, not a passive spring/contact simulation.

The coaxial pinion and rack reuse `rack-pinion-parts.js`: 12 teeth, pitch radius 0.58, addendum 0.075, 25° pressure angle and matched pitch. The theoretical contact ratio is **1.1740**. The finite sweep checks both proximity and nonpenetration, not only the pitch-speed relation. The common hub, output journal, driving hinge and holding hinge have real bores. The adjustable slider sits behind the pawl cheek, with a connecting pin spanning the layers. A bored output journal connects to the existing carriage guide. The input crank now has actual spindle and crank-pin bores, removing its visible coplanar overlap with the black spindle cap.

The source camera remains returned by the factory. Full-input-cycle bounds include the raised rocker and lowest crank pose. New meshes cast and receive shadows; materials ignore fog, the ground is hidden, and minimum display duration is eight seconds per input turn.

## Reproduction and checks

```sh
node scripts/generate-saw-feed-holding-path.mjs --check
node --test tests/saw-feed-working-parts.test.mjs tests/movement-284.test.mjs
```

**13 tests pass**: five finite-interface tests plus eight existing regressions, in 2.52 seconds. Final integration log: `/dev/shm/saw-feed-tests.log` (temporary, not committed).

The generator needs Node 18+ and the installed project dependencies. Without `--check` it deterministically writes `src/simulation/baked/saw-feed-holding-path.js`; with `--check` it verifies byte-identical regeneration without writing. The 513 samples occupy about 10 KB. The generator uses a periodic Lipschitz minorant of the finite nose-clearance envelope, limiting angle change to four radians per tooth phase. An independent 8,193-pose interpolation check reports minimum nose clearance **0.00054190**. The maximum adjacent baked step is **0.0078125 radians**, and playback interpolates continuously.

| Actual mesh interface | Measured result, model units |
| --- | --- |
| Driving nose / ratchet | Minimum 0.00020002; maximum active nearest gap 0.00021232 |
| Holding nose / ratchet | Minimum 0.00062348; maximum dwell nearest gap 0.00066324 |
| Pawl cheeks / ratchet | Minimum 0.03022 |
| Rack / involute pinion, both directions | Minimum 0.00090631; maximum nearest working gap 0.00134095 |
| Pinion / rack backing | Minimum 0.00500006 |
| Driving hinge / pawl bore | Minimum 0.00391086 |
| Holding hinge / click bore | Minimum 0.00399518 |
| Common shaft / hub, pinion and journal | Minimum 0.00391218 |
| Input spindle / crank bore | Minimum 0.00387530 |
| Input crank pin / bore | Minimum 0.00382728 |

The mesh checks cover 65 contact poses, 33 rack/pinion poses and 17 journal poses. They transform actual visible surface samples and check shaft sections through journals. Actual ratchet face normals are checked at both drive and hold contacts. Another 4,097 poses check nose/profile clearance and click continuity. Tests retain one-tooth feed, four-bar closure and pitch-speed regressions, and verify outward new surfaces, stable buffers and full-cycle framing.

Root's final default/oblique browser review confirmed that the crank flicker is fixed, with no errors or clipping (maximum NDC 0.86237). Rendering used 156 draw calls and 44,600 triangles including shadows. The final production build passed in 22.18 seconds, and the CPU screen reported no flags. Root integration owns the packaged checks. CPU construction measured 101 ms first / 29–38 ms warm; visible geometry is 22,300 triangles. Mean update cost was 0.037 ms across 1,000 updates. No geometry or clearance-envelope generation occurs during playback.

## Explicit limits

Pawl bias, holding torque balance about the pawl hinge, friction, impact and transfer of a loaded carriage between the two catches are **not dynamically validated**. The finite working gaps represent an unloaded geometric reconstruction, not force-solved closure. The baked click path bounds angular rate but does not prescribe a physically validated acceleration or spring law. No MuJoCo qualification is claimed.

The adjustable screw's thread contact and the remaining crank-rocker bearing details are outside this bounded working-contact pass. Carriage travel remains an unbounded feed viewed through a finite observation window; it does not physically reset after one input turn. The source's curved catches are simplified, and the frame dimensions and layer offsets are inferred. These limits are retained in the model's reconstruction note and dynamics metadata rather than disguised as contact validation.
