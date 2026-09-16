# Cone friction drives: 262, 263 and 265

Primary sources: [paired end/side views 262–263](https://507movements.com/mm_262-263.html)
and [265](https://507movements.com/mm_265.html). The captions and local engravings
were reviewed. Both pages mark the animation unavailable and contain neither
`ae.add_model` nor `mm_present`; there is no usable source animation oracle.

## Eccentric cone and screw, 262–263

The existing eccentric edge-contact equations already include the roller
center's tangential velocity. Their unequal forward/backward output increments
are retained. The input formerly accelerated and decelerated throughout the
whole demonstration despite the caption specifying uniform rotation. It now
runs uniformly for 5.2 seconds of each six-second traverse, with 0.4-second
cosine ramps at the ends. The reverse return remains an explicitly inferred
way to repeat a finite screw stroke, not a source-prescribed part of the machine.
The minimum display cycle is twelve seconds; refreshed measured-speed limits
yield about 17.49 seconds at default playback, preserving readable reversals.

The wire-coil screw is replaced with integral square threads joined to its core,
using the existing screw-family helical solid helper. A stationary matching
internal thread now occupies the bored nut. Both retain the original 0.19-unit
lead and left hand. Radial and axial allowances provide running clearance;
thread form, width and clearances are inferred from the unsectioned engraving.
The fixed nut's pedestal now reaches its outer surface without filling its bore.

The former frame intruded into the eccentric cone's sweep, its carriage blocks
were detached from the axle, and the spring's lower end was unsupported. The
reconstructed vertical guides now stand beyond the cone's small end. Bored
sliding sleeves and a short bridge join the roller axle to the spring seat.
The base lies below the cone's complete sweep. The roller disk has a real axle
bore. A finite audit exposed a further 0.003-unit thread/axle penetration near
the lowest roller position; reducing the inferred axle radius from 0.075 to
0.065 clears that interface. The white generator tube is removed because it
protruded into the roller's working surface.

## Traversing roller, 265

The existing generator-aligned roller and radius-dependent angular-speed
integral are retained. The roller disk and sliding hub now have actual bores
around their guide shaft. Added support posts and their rings were absent from
the source and intersected the shaft assembly; they are removed from the view.
The minimum display traverse is eight seconds (four cone turns), rather than
compressing all four input turns into a nominal two-second loop.

Both families disable ground/fog, hide floating contact markers, and fit the
complete sampled motion with views close to the source elevations. Their notes
explain the prescribed traverse/return and circumferential rolling assumption.
The small field of view in 262 reduces perspective occlusion in its end view.

## Evidence and remaining scope

`node --test tests/cone-friction-solids.test.mjs tests/movement-262.test.mjs tests/movement-263.test.mjs tests/movement-265.test.mjs`
passes 27 tests. The new tests inspect actual rendered triangles bidirectionally
at 65 poses for the cone/roller, screw/nut and corrected support interfaces.
They also check finite bores, guide/spring connectivity, surface proximity at
the contact point, uniform middle-stroke input, continuity and motion bounds.
Default and advanced browser source comparisons report no page errors. The
17-pose projected bounds stay inside the viewport (maximum absolute coordinates
0.863, 0.885 and 0.844 for 262, 263 and 265). Rendered triangles including
shadows are 47,864 for each eccentric-cone view and 13,920 for 265.

The old rate test uses a smaller finite-difference step to resolve the new
end-ramp curvature while retaining its error bounds.

This is an ideal circumferential rolling model. The axial slide scrubs along
the cone; it is not no-slip contact in every direction. Spring force, friction
capacity and slip under load are not dynamically validated. 262/263 starts at
a later cone station than the engraving to show the direction reversals within
three turns; the roller can consequently be partly hidden by the large cone
face in the end view. Reconstructed guides, base and thread form remain source
uncertainties. The finite checks cover the named working interfaces rather
than every possible solid pair or continuous-time contact.
