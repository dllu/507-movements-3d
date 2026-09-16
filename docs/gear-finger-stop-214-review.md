# 214: generated gears and finite stop fingers

The [source](https://507movements.com/mm_214.html) depicts a geared winding
stop. Its registered 2D animation provides the open starting pose and opposing
10:12 rotation. The continuous forward/reverse demonstration retains the
existing terminal holds; the source animation resets after its forward run.

The previous nearly trapezoidal teeth overlapped through ordinary meshing.
The shared rounded-rack cutter now generates the two profiles offline, retaining
their pitch radii, tooth counts and phases. A reconstructed 30-degree pressure
angle supports these small gears. A 20-degree trial cleared geometrically but
lost close working engagement through the undercut root transition; a 25-degree
trial exceeded the selected virtual-work residual bound. Neither is shipped.

The finite fingers have unbeveled working faces. Their square apertures continue
through the gears and clamp hubs, and matching keyed arbors replace loose
axis-aligned blocks. The hubs now connect the gears to their fingers. Fixed
supports and bearings have real shaft bores. The decorative sphere in the tooth
mesh is removed, and the two terminal contact markers clear the finger faces.
Actual swept vertices determine framing; ground and fog are disabled.

## Evidence

`node --test tests/movement-214.test.mjs tests/gear-finger-stop-working-parts.test.mjs`
passes all 10 checks. The offline generator regenerates byte-identically.

- Across 97 poses, actual opposing tooth boundaries have minimum clearance
  0.000956879 and maximum nearest working gap 0.000971652.
- Both working flank directions are checked at 33 poses. Maximum gap is
  0.000974999, with maximum normalized virtual-work residual 0.00209218;
  the contact normals give opposite shaft torques.
- Across 65 poses, finite finger overlap is at numerical scale (3.31e-8).
  Both terminal faces meet, and attempted 0.002-radian overtravel intersects
  the stopping face. Opposing gear clearance remains 0.075.
- Keyed faces retain 0.000882 clearance, and shaft/support bore clearances
  remain between 0.0038 and 0.0041 over 17 poses.
- Source/default/oblique browser inspection finds no errors or clipping;
  maximum normalized screen extent is 0.8672.

These are sampled geometric and transmission checks. Motion, reversal, loads,
friction, impact and clearance take-up remain prescribed. Pressure angle, hidden
support depth and keyed attachments are reconstruction assumptions, disclosed
in the viewer. The generated involutes preserve mechanical intent rather than
the engraving's hand-drawn square tooth outline.
