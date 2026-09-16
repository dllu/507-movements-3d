# Friction drives 267, 280 and 413

Primary sources: [267](https://507movements.com/mm_267.html), [280](https://507movements.com/mm_280.html), [413](https://507movements.com/mm_413.html), and their local engravings. All three official pages mark the animation unavailable. No 2D motion oracle is available for these IDs.

## 267: actual eccentric-arm engagement

The former arm bodies sat in front of the main rim, while their nominal point contacts reported engagement. Their beveled tips could also extend beyond the stated inner radius. The rim now spans the working arm depth, and closed, un-beveled arm profiles have real pivot bores and finite contact tips trimmed against the intended inner circle. A collar attaches the four-arm carrier to the shaft; the deeper rim also meets its rear spokes.

A 65-pose independent actual-solid sweep finds no arm/rim penetration, and engaged separation is about 0.000022, within the stated circular tessellation tolerance. The prescribed reverse rotation retracts the arms; their pivot bores clear the pins. The existing eccentric force-direction argument is retained. Spring preload, traction threshold, release under load and self-actuation remain prescribed, rather than results of a passive friction simulation.

## 280: replace the grounded jaw with the source's travelling clamp

The source fixes the short lever's pin **in the cast block**, not in the ground. The previous model grounded both that block and its pin, placed the shoe in front of the wheel and applied an unrelated lever-arc speed ratio. Its claimed inner rim was part of a solid disk.

The cast jaw now travels circumferentially around a true annular rim. Circle intersection closes the upper crank/coupler against the lower pin on that moving jaw. A small relative rotation of the short lever provides take-up and release. Its finite eccentric shoe contacts the outside of the rim while two cast flanges contact the inner cylindrical surface, on opposite sides of the wheel's thin central web. Separate bored cheek journals leave an actual gap for the lever; a bored coupler connects both moving pins.

When clamped, jaw, shoe and wheel have the same angular velocity. On return the wheel is held and the released jaw slides around it. The inferred handle endpoint gives half a ratchet tooth per stroke; unwrapped wheel angle remains continuous through repeated cycles and one complete marked wheel revolution. The reconstruction advances counterclockwise for the depicted upward pull. Brown does not specify clockwise output; the old clockwise law was a consequence of the incorrect grounded pivot.

The actual shoe normal and tangential driving reaction produce a moment that wedges the shoe inward. Its sampled engaged finite gap is about 0.000008. Inner flange/rim tessellation produces at most 0.0000104 overlap; tests use a 0.000012 numerical bound, separately from other clearance checks. Jaw cheeks, web, ratchet carrier, pivot and coupler neighbours clear through 65 poses. The assembled flanges, cheeks and split journals have verified interior attachment witnesses.

**Remaining scope:** take-up, clamp/release and holding-pawl selection are still prescribed. The backstop now has asymmetric teeth with a steep radial face opposing clockwise motion and a ramp permitting counterclockwise overrun. Its formerly inward pawl gestures are replaced by an offline 256-sample periodic outward-clearance envelope, evaluated by cheap interpolation. A 129-pose actual-solid check includes both spherical tips and their bored arms, and cycle-boundary checks rule out an interpolation teleport. The conservative envelope deliberately leaves seating gaps at some phases; it is not a passive seating or holding-load result. No friction coefficient, torque capacity, passive holding or loaded release is claimed. The exact circle closure and finite friction fit are independent of those unsolved force questions. The old grounded four-bar remains only as implementation scaffolding for its smooth input schedule; obsolete public four-bar and output-ratio claims are removed.

## 413: mating screw and unloaded V geometry

The decorative open coil did not have the lead used by the nut's advance. It is replaced by a closed square thread and matching internal nut thread with actual bored nut body, handle and clamp plate. One inferred nut revolution supplies the 0.08 axial adjustment, rather than four turns of a geometrically inconsistent coil. The journals are bored and connected to their rear standard. The two lower V flanks now use the same axial stations as the uncompressed upper V; decorative overlapping crown/root tori and nominal contact markers are hidden.

Thirteen actual-solid poses qualify the mating threads and their adjacent shaft, nut, handle and clamp plate. Unloaded V profiles mate without overlap. **Loaded rubber remains a free-expansion volume proxy**: the visible rubber is not deformed against the groove, and the new check measures about 0.0741 penetration at full compression (roughly 0.075 in the separate 13-pose audit). This does not establish actual pressure, friction traction or stress. Resolving that compliant contact is a separate task; the screw and unloaded geometry corrections are independently useful.

## Tests and presentation

Final integrated source/default/oblique views pass without browser errors or
clipping, including the corrected 280 backstop and 413 nut-facing camera. Maximum
normalized screen extents are 0.750/0.887/0.740 for 267/280/413. The offline
backstop generator reproduces the checked-in data byte-for-byte. Production and
packaged playback results are recorded in the central progress ledger.

`node --test tests/movement-267.test.mjs tests/movement-280.test.mjs tests/movement-413.test.mjs tests/friction-family-working-solids.test.mjs` — **35 checks pass**. The new 280 tests replace assumptions of a grounded four-bar with moving-jaw closure, velocity, force direction, render binding and repeated-cycle checks. Nine focused actual-solid tests separately cover finite contacts, bores, structural attachment, mating threads and retained buffers.

Display cycles are at least 9.2 seconds for 267, eight seconds per 280 stroke and nine seconds for 413. Ground/fog are disabled and bounds are measured over representative complete authored cycles. Root performs the final shared browser review. RAM diagnostics are `/dev/shm/friction33-audit.mjs`, `/dev/shm/friction33-413-audit.mjs` and `/dev/shm/friction33-tests.txt`; no review images or bulk data are checked in.

Final source review removed 413’s obsolete floating compression guide and restored a negative-X view to expose its nut. 267’s face index is seated on the enlarged rim face. Reproduce the bounded backstop bake with `node scripts/generate-friction-windlass-backstop.mjs`; the small data module is checked in, with no browser contact search.
