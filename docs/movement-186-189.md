# Gab disengagers 186–189: bored-joint pass

Sources: [186](https://507movements.com/mm_186.html),
[187](https://507movements.com/mm_187.html),
[188](https://507movements.com/mm_188.html), and
[189](https://507movements.com/mm_189.html). The official pages mark all four
animations unavailable; their HTML contains no `ae.add_model`, `mm_present`,
or animation/canvas assets (only advertising and analytics/social scripts).
The caption describes lifting the eccentric rod's gab
clear of the valve pin; 187–189 are alternative operating arrangements.

This bounded pass repairs visible joint solids. The valve levers in 186, 187,
and 189 previously used solid rectangular beams pierced by solid shafts and
pins. They now use tapered finite plates with bored eyes, and their visible
shaft bosses have matching bores. Movement 188's guided pin boss and supporting
web also clear the pin. In 189, the operating bell crank, its fixed bearing and
face, the hanging link, and the eccentric-rod hanger eye have real bores. The
rod tail is now a flat plate with a continuous bored eye instead of a round tube
passing through the hanger pin. Existing `bored-planar-link.js` geometry serves
the hanger and bosses; the finite-plate helper forms the tapered levers.

A 65-pose browser projection check keeps every visible mesh bounding-box corner
inside the default camera frustum for all four mechanisms.

The joint centers, rigid lengths, and analytical four-bar closure in 189 are
unchanged. Hanger playback changes its position and angle, never its length.
The bores have 0.012 model-unit radial clearance (about 0.8 source pixels) so
finite polygonal shafts do not cut into the rotating plates. All four sectional
mechanisms now hide the ground and ignore scene fog.

Validation: `node --test tests/gab-joint-solids.test.mjs
 tests/movement-186.test.mjs tests/movement-187.test.mjs
 tests/movement-188.test.mjs tests/movement-189.test.mjs` passes 24 tests.
The new solid test samples actual shaft/pin surfaces against the rendered plate
meshes at 33 full-cycle poses. It covers the corrected joint pairs, not every
pair in the assembly. Existing tests retain rigid closure, sequence continuity,
release clearance, and analytical state checks; those are not passive-contact
qualification.

Open work: a separate 65-pose surface sampling of the cam nose against the
support-shoe beam detects about 0.080 model units of penetration in 186 and
0.079 in 187, already present in the initial pose. The nominal contact-point
checks omit finite nose/shoe thickness and do not establish surface clearance.
These working faces need a contact-envelope reconstruction. The thin
reconstructed cam rail in 188, spring capture, and gab-drive contact also remain
prescribed or inferred. Their
finite contacting surfaces require further review; these corrections do not
establish passive latch dynamics. Added support frames, indices/contact markers,
axial spacing, and camera envelopes still differ from the original sectional
engravings. The automatic stop-and-operate sequence is an explanatory motion
assumption; the source does not specify its timing. The 18-second cycle includes
multiple input turns plus lifting and lowering, and should not be compressed to
a two-second complete operator sequence.
