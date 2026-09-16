# Piston engines 424–426: finite working geometry

Reviewed the original plates and captions for [424](https://507movements.com/mm_424.html), [425](https://507movements.com/mm_425.html) and [426](https://507movements.com/mm_426.html), including their usable inline `ae.add_model` / `mm_present` animation definitions. The existing official dimensions and motion laws are retained. No tracing or new physics solver was needed for these determined geometric constraints.

## Corrections

- **424:** The fixed shaft and crank formerly intersected the translating piston C, and its wrist bearing was solid. C now has a real wrist bore and annular bearing. The crank is in front of C, with an inferred front shaft stub that does not pass through the translating piston. The crank-path reference clears the solids, and the foundation meets the housing. Both nested sliding guide contacts remain intact.
- **425:** A thick tube was centered on the ideal inner radius, intruding into the piston. A closed annular sector now supplies the actual working wall, with 0.00003 units of radial running clearance. The top opening uses the official half-unit abutment width rather than the previous excessive gap. The abutment nose is the source 60-degree circular cap, joined to its blade, rather than a full roller. Guide rails and cap clear the blade's complete stroke, and the external port neck outlines no longer intrude into the chamber. The foundation meets the casing.
- **426:** The exact source arc solver previously drove pistons against unrelated rendered boxes/circles. The same eight joined source arcs now bound the closed chamber and its two abutments. The source 60-degree piston nose caps replace full circular noses. The hub has a real shaft bore and two radial slots with a connected rear web; the dark groove floor is behind the sliding blades. Piston indexes sit on their front faces. The outside shell uses the official radius-7 circular envelope rather than the oversized radius-8.65 reconstruction. A 1.00002 radial scale on the working boundary provides a small, explicit running clearance for source rounding and polygon approximation.

All three disable fog and ground. Default/front/advanced views were inspected alongside the engravings; 65-pose default-camera sweeps found zero clipped visible vertices.

## Validation

```sh
node --test tests/movement-424.test.mjs tests/movement-425.test.mjs tests/movement-426.test.mjs tests/piston-engine-solids.test.mjs
```

The 30 existing source and kinematic regressions remain applicable. Three new finite-surface regressions sample actual rendered surfaces in both directions over 65 poses: the 424 shaft/wrist/crank and both sliding guides; 425 piston/abutment versus chamber, necks and guides; and 426 blades/noses/hub versus chamber, abutments, grooves and shaft. The tests check actual voids in the wrist bearing and hub slots, plus retention of the rear hub web. These are bounded mesh regressions, not a proof of continuous collision freedom for every ornament.

A fourth new regression verifies that the corrections retain working engagement. For 425, the sum of distances from the ideal shared contact point to the actual piston and abutment meshes is at most 0.00004228 units, and the cylinder working wall is within 0.00003010. The reaction has a vertical component above 0.94. For 426, a local angular refinement against the actual chamber triangles finds both nose caps between 0.00002553 and 0.00005718 units from the working boundary throughout the sampled cycle. Thus the clearance fixes do not erase the intended contacts.

Bulk captures, fetched source pages and logs remain in `/dev/shm/piston-engine-*`, `/dev/shm/mm_424.html` through `mm_426.html`, and `/dev/shm/424426-*`.

## Remaining assumptions

Motion remains prescribed from the official planar constraints. In 425 the abutment is assumed to remain loaded against its eccentric; in 426 an unspecified outward load maintains the radial followers against the chamber. Contact forces, passive return, inertia, friction, wear and leakage are not simulated. Axial depths, guides, the 424 front crank arrangement and small running clearances are inferred. The open front is a cutaway; pressure-tight end covers and seals are not supplied. Port shapes and flow indicators remain explanatory graphics rather than validated fluid passages or valve timing. The 426 outer casing omits the engraving's detailed side-port neck outline while its working inner profile is now correct. No thermodynamic or self-running engine claim is made.
