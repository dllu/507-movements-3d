# Elastic pressure gauges: 499–500

This bounded family pass repairs the visible pressure passages and transmission interfaces while preserving the existing exact linkage laws. It does not solve elasticity, pressure flow or bearing dynamics.

## Primary references

- [499 — Bourdon gauge](https://507movements.com/mm_499.html): the flattened tube is fixed and fed at its middle; both sealed free ends move the sector through links. The caption and engraving define this topology, rather than a generic one-ended Bourdon gauge.
- [500 — diaphragm gauge](https://507movements.com/mm_500.html): the rim-fixed corrugated disk deflects axially and drives a sector and pointer pinion. The engraving includes a side section showing that spatial conversion.

Both official pages mark their animations unavailable. The engraving and caption therefore remain the motion references. Tooth counts, tooth profile, detailed bearing construction, elastic deflection magnitude, pressure scale and demonstration timing are reconstruction choices.

## Corrections

Both mechanisms previously displayed five independent box teeth in an axial plane separated from the pointer gear. The sector rim also lacked a continuous load path to its hub. They now use matching finite involute sector/pinion outlines in the same plane, with real journal bores and a connected rim, spoke and input arms. The sector has an open center and a finite supporting spoke. Movement 500's matched gear pair sits ahead of its short-stud spatial linkage, clearing the rod and avoiding an extended diaphragm stud through the pointer pinion. The original pitch ratios and analytical rod closures are unchanged.

The links now have constant-length shanks and hollow spherical eyes containing captured balls. Their throats clear the finite input studs throughout articulation. The spatial eye frames follow the rod's tilt without introducing arbitrary twist; visible rod depth and studs separate them from the sector web. The free-end caps of 499 seal the newly hollow, flattened tube branches. Their wall vertices update in retained buffers with the existing inextensible centerline law.

The inlet pipes and collars now have real bores. Movement 500 has a finite chamber wall with an inlet opening and a finite rear cover. The chamber opening accommodates its inlet pipe; its diaphragm remains a prescribed corrugated membrane surface. Ground/fog are disabled, the source-facing camera covers the full pressure cycle, and a minimum eight-second display cycle keeps pointer motion readable.

## Qualification

`tests/elastic-gauge-working-solids.test.mjs` checks selected actual rendered solids in both directions over 33 cycle poses: gear teeth, journal bores, spherical eyes/balls/studs, shanks and nearby sector material. It also requires the finite gear surfaces to remain close through the entire sweep; merely separating the gears does not pass. Independent hollow-passage checks verify the pressure-core envelopes, and deforming-tube checks rebuild the triangle surface for every pose rather than reusing stale vertices. Scene and GPU geometry identities remain stable during playback.

The new seven checks and fourteen existing movement tests pass. Initial browser review captured default, front and advanced poses and swept 17 poses for framing, with no console errors or clipping. A final repeat capture after the socket/sector corrections also passes: maximum projected coordinate is 0.861 for 499 and 0.850 for 500, below the viewport edge at 1.0. Review artifacts are kept in `/dev/shm/gauge24-*`, outside Git.

## Remaining assumptions

Pressure history, tube straightening and diaphragm displacement are prescribed. Constant-length linkage closure and ideal gear ratios are analytical; friction, gear backlash dynamics, joint preload, elastic stress, hysteresis, sealing and pressure transients are not simulated. The spherical joints and sector spoke are inferred practical constructions, not claimed historical detailing. Small gear clearances are intentional; they do not validate loaded tooth contact or backlash response.

The fixed middle feed connection of 499 is still a schematic sealed attachment, not a reconstructed watertight branched manifold. Movement 500's diaphragm has no finite elastic thickness, and its tinted chamber fill is an illustrative pressure envelope rather than a deformed fluid mesh. This selected-interface pass does not claim exhaustive collision qualification of the housing, pointer, decorative dial, fluid volumes and supports.
