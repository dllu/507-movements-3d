# Pass 67, lane b: 387 and 388 user-review fixes

Scope: 387 (`authored-tide-ladders.js`) and 388 (`authored-planer-feeds.js`).
Both were checked against `public/engravings/mm_NNN.png` in fresh captures
(default, half-cycle, +60, -60, back, top and close views). The scratch captures
are under `/dev/shm/p67-b/{before,v}` and are not committed.

## 387: one animated ladder, joined rail panels, dinghy

User feedback: the grey rails on the right were disconnected, and the ladder was
drawn twice.

- **One model.** The half-cycle display copy is removed. The default pose
  (t = 0) is Brown's upper figure: the ladder level at high water. The animation
  carries it down to the boat at low water (Brown's lower figure) and back. The
  camera fits this single model's full motion envelope. Capture: `387-default`
  and `387-a45`.
- **Joined rail panels.** Before, the X panels stood at the rail plane
  (z = ±0.69). The fixed ladder posts stood outboard at ±0.9, so nothing joined
  the two and the far posts had no finials. Now each side is one panel in the
  fixed posts' plane:
  - Posts: the fixed ladder post and a far post, both 0.34 square (Brown's
    posts are stout), each with a ball finial.
  - Rails: a top rail at the handrail pivot and a bottom rail on the deck, both
    framed between the posts.
  - Braces: two crossed braces corner to corner, half-lapped so they do not cut
    each other.

  All of it stands on the wharf. The wharf is now one masonry block from deck
  to river bed. Its face lies under the fixed posts, as Brown draws it. Between
  the posts it has a recess, so the stringer eyes swing clear. The undrawn
  crossbars over the ladder ends (on the fixed and floating frames) are removed.
  Captures: `387-r60`, `387-rm60`, `387-back`, `387-rail`.
- **Boat.** The ladder is narrower (rails at ±0.46 instead of ±0.69); Brown's
  side view does not fix its width. The floating posts stand inboard of the
  rails, in the plane of the suspension rods. The boat hangs low under the
  stringer ends, as Brown draws it: its gunwale is 0.42 below the lower pivot.
  So the beam only has to take the posts. The boat is now 2.1 long and
  1.07 broad (before: 3.40 by 1.98). It has a raised pointed bow and a flat
  transom stern, like Brown's hatched square stern. The posts stand at 42% of
  its length from the bow. The water level follows, with the waterline 0.78
  below the pivot. The river bed is lowered to -1.4, so water remains at low
  tide.

Intersections (spacing 0.01, 129 samples), before: hull x water 0.50 (fluid).
After: hull x water 0.50 and wall x water 0.38 (fluid; the water runs into the
recess between the posts). There are no solid pairs. A 0.005 contact between a
floating post and a stringer was found during the pass and fixed by making the
post 0.16 deep. Face scan: 1 degenerate item (the hull's pinched stem), which
is harmless. A coplanar wall and post face was fixed by setting the wall face
back 0.03.

Residuals:
- The water is a deep volume from the surface to the bed. Brown draws only a
  few surface lines, so the volume dominates the lower half of the frame.
- The boat is still about 25% longer than Brown's.
- The clearance between the last tread's rods and the floating posts is
  smallest at low tide, about 0.03 to 0.07.

## 388: broad, blunt teeth

User feedback: the teeth were skinny and pointed. Before, 20 spikes rose from
the old root circle (r 0.96) to the tip (r 1.33). They were about 28% of the
radius deep and had needle points. Brown's plate measures tips at 67.5 px and
valleys at about 60 px. So the valleys lie at 0.89 of the tip radius, and each
tooth fills its whole pitch.

Each tooth is now a local `bluntFeedToothGeometry`, with the same count of 20.
The valley circle is 1.184, the roller body runs out to it, and the tips stay at
1.33. The flanks are slightly concave (radius rises as u^1.6 across the flank)
and end in a short rounded crown about 0.2 of the pitch wide. The crown's peak
stays at the same tip radius, so the bite calculation and the feed kinematics
are unchanged. The shared `woodFeedToothGeometry` is no longer imported by 388
and is left in place. Captures: `388-default`, `388-z` (close view beside the
plate), `388-r60`, `388-back`, `388-top`.

Intersections, after: tooth x plank 0.0499 (the prescribed bite, as before) and
tooth x grain face 0.0185 (deforming contact). Faces: only the unchanged plank
grain sheets and degenerates.

Residual: Brown draws an inner circle on the roller face (at about 0.75 of the
tip radius). The model's face is plain.

## Tests

`node --test tests/movement-387.test.mjs tests/movement-388.test.mjs
tests/folding-pipe-solids.test.mjs`: 20 pass, 0 fail.
