# Marine rotors: paddle wheel 487 and screw propeller 488

Primary references: [487](https://507movements.com/mm_487.html) and
[488](https://507movements.com/mm_488.html), with their engravings. 487 supplies an
inline canvas model; 488 does not. Merely inspecting the initially unavailable
animation tab would miss 487's model.

The original 487 script was executed with its original animation library at six
phases. It rotates the whole eight-paddle outline as one body; the page controller
uses 15 cycles per minute. Hub, annulus and paddle-tip radii are 2.5, 9–10 and 13
source units. Those proportions and the four-second period are retained. The
3D model keeps its disclosed clockwise rotation and positive-X vessel direction;
the source animation rotates counterclockwise in its front elevation. Thus the
oracle confirms topology, rigid rotation and speed, not signed phase agreement.
The caption itself specifies no absolute direction.

## Corrected working parts

487 now has finite flat annular rims instead of round torus rims. Spokes extend
through each rim into the paddle boards, giving an actual attachment rather than
ending at the inner rim. The hub and shaft journals have finite bores. Both
stationary bearing frames are behind the wheel, leaving its source-facing outline
legible; this cantilever support arrangement is a reconstructed demonstration
fixture. The white hub-face index is in front of the hub face instead of buried
inside it.

488's helicoid was a zero-thickness open surface outlined with tubes. It now has
0.045-unit thickness and closed boundary walls, using the shared
`finite-surface-shell.js` helper also used by the wind family. Opposed surface
vertices retain the exact constant-lead helicoid as their midpoint. Hard boundary
normals and opaque faces replace the transparent sheet and bulky edge tubes.
Thickness and planform are inferred; the source gives the screw-thread principle,
not engineering dimensions.

The propeller previously swept through its demonstration base. The base is now
below the complete blade sweep, and taller bearing pedestals connect it to actual
bored shaft journals. The large translucent water box is hidden so it no longer
obscures the mechanism or sets its camera bounds. Wake paths and markers remain
visible explanatory overlays. Source-facing framing uses the visible geometry
through a full turn. Both movements disable ground/fog and retain a four-second
minimum display period; 488's representative 90-rpm law is slowed for viewing.

## Checks and remaining limits

24 focused tests pass: the 18 existing analytical/source tests plus six new
working-solid, shell and storage checks. Selected actual rotor surfaces clear
fixed bearings and supports at 33 off-grid poses. The blade shell has positive
signed volume, outward material winding and exactly two incident faces per
physical edge; sampled midpoint/thickness tests preserve the screw surface.
Spoke attachment, rim material and the exposed face index are checked. Playback
retains scene objects and GPU arrays. The camera regression now measures visible
vertices, so a deliberately hidden water box does not control framing.

Final source/default/oblique browser captures have no errors or clipping.
Maximum absolute projected vertex coordinates are .915 for 487 and .783 for 488.
The 487 oracle script, source copies and review images remain in `/dev/shm`.

Shaft speed remains prescribed. The pre-existing flat-paddle drag and propeller
open-water coefficient laws use representative values, not measured source data.
They do not validate CFD, wake geometry, slosh, cavitation, structural loading,
shaft deflection or propulsion under load. Flow markers can cross the swept
volume because they illustrate direction rather than solve fluid/solid contact.
These sampled working-interface checks are not an exhaustive collision proof.
