# 246: pantograph joints and drawing contact

The [official caption and engraving](https://507movements.com/mm_246.html)
describe an adjustable copying pantograph with fixed C, ivory tracer B and pencil
A. The page has an inline `ae.add_model("mm_246")` animation, verified on
2026-09-16. It confirms the topology and doubled copy. The existing smooth
six-second demonstration trace is an independently prescribed input; it is not
the source animation's five-segment sample outline. The exact parallelogram
closure, 2:1 position/velocity/acceleration laws and adjustment formula are
unchanged.

The old pencil cone extended 0.030 below the paper; the tracer sphere penetrated
by 0.037. Both now meet the paper at their actual lowest point. Their shafts
terminate inside their tips rather than reaching the paper as flat-ended rods.
The tracer knob is raised enough to clear its compound joint pin while remaining
attached to the tracer shaft.

Four fixed-length plates replace solid bars at the working joints. Their real
pin bores have 0.004 nominal radial clearance; local enlarged eyes preserve
material around the original full-radius pins. The compound pin at B is hollow
for the tracer. The adjustable C and A carriers now have longitudinal rail
passages and bored upper/lower covers. C's fixed post spans the complete carrier,
and retainers capture the joint layers without clipping them. Hidden depth,
retainers and slide construction are inferred; adjustment is described by the
existing analytical setting law, not animated as a sliding/clamping operation.

The source-facing camera retains the complete paper and mechanism through the
trace. Ground and material fog are disabled. A reconstruction note explicitly
qualifies the prescribed path, friction, pencil pressure and manual adjustment.

## Validation

```sh
node --test tests/movement-246.test.mjs tests/pantograph-working-parts.test.mjs
```

All 12 checks pass: eight existing source/constraint/locus/render tests and four
finite-part tests. A 33-pose bidirectional surface audit checks bars against
pins, slides and retainers, bar pairs, both slide pins, and the hollow B pin
against the tracer and knob. Minimum sampled clearances are 0.003942 for
bar/pin, 0.010000 for bar/slide and bar/retainer, 0.075000 between bar layers,
0.003947 for fixed slide/post, 0.003998 for pencil slide/shaft and 0.003995 for
compound pin/tracer. Separate checks verify actual bore centers, axial capture
and retained close running clearance at 65 poses, so remote clearance cannot
substitute for a connected joint. Both finite drawing tips meet the paper to
1e-7 model units at all 33 sampled poses. Geometry identities remain unchanged
under repeated updates.

These are bounded finite samples, not a continuous collision or loaded-friction
proof. The exact kinematic copy does not establish manual forces, wear, pencil
pressure or clamp holding strength. Root integration supplies the final shared
source/default/oblique and portable browser checks.
