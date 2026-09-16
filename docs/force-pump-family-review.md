# Force pumps 450–451: shared working passages

Sources: [450](https://507movements.com/mm_450.html) and
[451](https://507movements.com/mm_451.html), captions and engravings. The ordinary
force pump has a solid piston and separate inlet/delivery checks. The second
adds an air chamber and shows alternative outlet arrangements. Both source
pages supply static illustrations, not a working animation oracle.

The nineteenth pass reuses the lift-pump family's finite ported barrel, bored
links and turned seats, plus finite curved pipe walls. Rods are lengthened to
place the pistons within the source barrels; each short lever link has two real
pin bores and a separate front layer. The lever support has an actual journal.
Delivery water passes through open barrel ports and hollow bends rather than
crossing solid walls. Check disks meet annular seats with open central passages.

451's delivery check is now on the air-chamber neck axis. The reconstructed
chamber is raised to match its relation to the pump in the source, with a lower
side outlet and a capped alternative dip pipe. Its water and air share a
piecewise-linear radial envelope inside the finite chamber wall. An exact
frustum-volume integral places their horizontal interface according to the
existing prescribed volume fraction. The two persistent geometries deform in
place; playback does not allocate new meshes or geometry. The hidden decorative
well/base and low-opacity contents expose the working mechanism.

The 5.2-second authored periods survive the production display wrapper. Both
models have full-cycle camera bounds, disabled fog and no ground intersection.
Default and oblique browser captures have no page errors; sampled full-cycle
maximum screen coordinates are 0.868 and 0.861. Render counts including shadows
are 57/87 calls and approximately 96k/161k triangles respectively.

`tests/force-pump-working-solids.test.mjs` checks 65 poses of selected actual
piston/rod/link/pin/support and valve interfaces, delivery-water openings, and
33 poses of 451's water/air envelopes against the chamber walls. Triangulated
content fractions agree with the prescribed fraction within 0.004; exact
frustum integration is tighter. Legacy kinematic tests and the unchanged shared
lift-pump passage tests also pass (28 tests together).

This is a geometric and prescribed-motion reconstruction. Check timing is phase
driven; valve masses, pressure-induced opening, priming, leakage and sealing
have not been validated. Water/air fractions use an idealized volume law and do
not subtract all immersed solid volumes. The chamber profile, obscured pipe
junctions and support depths are reconstructed rather than exact historical
measurements. Clear sampled surfaces do not establish passive hydraulic behavior.
