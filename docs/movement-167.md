# Movement 167 — reversing spiral drum (review open)

The current reconstruction needs replacement contact geometry. Its ideal
centerline equations agree internally, but the visible follower penetrates
the drum and raised track. This is not a qualified reconstruction.

## Source evidence

The [source page](https://507movements.com/mm_167.html), inspected September 15,
2026, describes a single closed groove with opposite pitches on its two halves.
A stud on a rectilinearly reciprocating rod drives the drum. This page has the
unavailable animation tab and no movement animation script; there is no working
2D oracle to execute here. The engraving is the geometric reference.

The engraving shows an approximately 80-pixel-wide, 340-pixel-long vertical
drum, a narrow shaft above and below, and the long rod immediately to its right.
The existing factory already records these source measurements. Its large
external frame, separate guide rail, end caps and index decorations are added
details that obscure the simple source silhouette. The default oblique view
also prevents direct comparison with the drawing's nearly frontal view.

## Confirmed defects

Run `node scripts/review-groove-drum-existing.mjs` to reproduce the
[selected-interface audit](validation/167-existing-contact.json). Across 97
poses and 4,890,546 bidirectional surface queries, maximum sampled penetration
depths are:

| Interface | Depth (world units) |
| --- | ---: |
| Stud tip / solid drum | 0.0734083 |
| Stud tip / raised groove tube | 0.1000484 |
| Moving sleeve / guide rail | 0.129922 |
| Shaft / each fixed bearing | 0.0839376 |

The model reports at most 6.67e-16 centerline error over the same poses. That
only checks its prescribed point trajectory; it does not establish that a
finite stud fits. The tube is solid material instead of a cut groove, and the
bearings/sleeve use solid cylinders despite storing nominal bore radii in
metadata. The bearing axes are also offset in depth from the shaft.

## Remaining implementation

Replace the drum surface with a real recessed closed channel, sized around
the finite follower through both reversals. Restore the source silhouette,
use actual coaxial bores for any retained bearings, and fit the full moving
rod envelope without a rendered invisible box. Preserve the source distinction
between reciprocating input and rotary output.

The current harmonic input plus constant-pitch halves makes the output stop
at each reversal; continued rotation through each dead center is prescribed.
The caption does not supply reversal rounding, loading or inertia. A replacement
must state those assumptions and validate finite contact rather than claim
dynamic correctness from a centerline identity. Analytic playback remains an
option if the chosen channel and motion are fully determined; use an offline
contact solve if they require it. Review the current 9.52-second cycle after
the contact path is settled. Fog is already disabled in this factory.

This report is a diagnostic checkpoint. No replacement, browser qualification
or full-assembly clearance pass is claimed. Movement 167 remains the next
implementation task, and the full 507-movement review remains active.
