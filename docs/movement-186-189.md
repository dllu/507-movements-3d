# Gab disengagers 186–189: joints and cam contact

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

## Finite cam contact in 186–187

The former nose sphere was centered on the shoe midplane. Its measured overlap
was about 0.080 model units in 186 and 0.079 in 187; checking only the two nominal
contact coordinates had missed the finite thickness. The shoe also cut through
the visible handle web and, in some poses, the gab rod and cam pivot.

Both mechanisms now use a finite circular toe on the **upper face** of a rear
shoulder. A rigid axial neck joins the toe to the visible front handle. The
valve lever, shoulder, moving rod, and handle occupy separate compatible depth
layers. The shoulder still connects to its valve lever, and the toe overlaps
its shoulder in depth; this is functional contact, not an axial separation of
the contacting surfaces. The handle is a flat curved plate with a real pivot
bore. Movement 186's shoulder is long enough to retain the toe during the
released rod's full stroke.

The operator's nominal lift law remains prescribed. A circle/line constraint
solves the small additional handle rotation required by the rocking valve lever
and translating eccentric rod. The largest correction is about 3.8 degrees in
186 and 8.1 degrees in 187. `handleAngle` and its derivatives describe the
operator's reference command; `camAngle` is the solved physical orientation.
`camSurfacePoint` is the actual round-toe/shoulder contact, while the historical
`camContactPoint` field retains the source-measured toe-center datum. Contact
remains active throughout playback; `camLiftActive` selects the operator-lift
stage and its diagnostic marker.

This contact geometry is an explicit reconstruction of the obscured depth
stack; the engraving does not determine the rear toe or shoulder dimensions.
The shoulder's upward reaction opposes the operator's lifting torque. The
analytically determined pose needs no live physics engine. Spring flexure,
latch capture and operator forcing remain scripted, so this does not establish
passive release dynamics or frictional behavior.

Validation: the complete family command plus `tests/gab-cam-contact.test.mjs`
passes **26 tests**. The new test checks 1,025 poses per mechanism against the
actual polygonal toe and shoe: no overlap, less than 0.00005 model units of
facet gap, a tangent inside the finite shoe, and positive axial overlap. A
control that suppresses the solved handle rocking restores penetration. The
[rendered-solid audit](validation/186-187-cam-solids.json) checks 585 corrected
part/other-body pairs at 129 poses per mechanism, using 2,755,116 bidirectional
surface queries, with no detected intersections. Reproduce it with
`node scripts/review-gab-cam-solids.mjs`. This qualifies the sampled contact
neighborhood, not the entire assembly or unsampled time. Source/default and
rear raised views were inspected in Chrome; default framing clears 65 sampled
poses for both movements.

Open work: the thin reconstructed cam rail in 188, spring capture, and gab-drive
contact remain prescribed or inferred. A broader before/after audit still
finds the pre-existing gab-pin/rod-crown overlap in 186 and 187, and a pin/spring
overlap in 186; those were unchanged by this pass. Added support frames,
indices/contact markers, and camera envelopes differ from the original
sectional engravings. The automatic stop-and-operate sequence is explanatory;
the source does not specify its timing. The 16–18 second cycles include multiple
input turns plus lifting and lowering, and should not be compressed to a
two-second complete operator sequence.
