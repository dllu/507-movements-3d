# Pass 62, lane p62-supports-b: supports, stubs and hull shapes

Reviewer: Claude Opus 5.5 (lane p62-supports-b), 2026-09-26.

Captures come from a private Vite server (port 44603), restarted after every
batch of edits. Each tile shows the plate, the default view at two phases,
rotated +60 and -60 degrees about vertical, the back view and a far oblique
view at 2.2x. They are in `/dev/shm/p62-supports-b/tiles/<ID>-{a,b,c}.png`
(`a` before this pass, `b`/`c` after; use the latest letter). 440 also has a
2:1 wide-frame check (`440-cw`), and 387 and 447 have oblique and close
oblique views (`<ID>-b2`). These scratch files are not committed.

Every flaw was first confirmed in a fresh `a` capture.

## Per-ID decisions

| ID | Change | Why / residual | Capture |
|---|---|---|---|
| 262, 263 | Factory no longer builds roller C's guide post, foot, sleeve and arm. C rides on its short spindle only (0.62 long, centred on the roller). The shared model is unchanged otherwise. | Brown draws C only on its spindle: the cross bar in 263 and the small circle in 262. The pressing spring or weight and C's carrier are not drawn. C's spindle now ends cleanly either side of the roller, which is exactly Brown's cross in 263. Residual: C has no visible carrier, as in the plates. | 262-b, 263-b |
| 277 | Removed the undrawn mainspring root block and the lock-plate arm and boss that ran to it. | The leaf ends cleanly where Brown breaks it off, at the lower right. The lock plate keeps only the tumbler boss, spring c's block arm and the cylinder-arbor lug, all behind the hammer. | 277-b |
| 333 | Removed the p57 frame posts, the cross bar and the closed cylinder below P. The lugs O and R stand on small frame blocks for Brown's hatched ground. P's rod runs straight on and ends 1.2 below the framed bottom at the top of its stroke. | This matches 181 and 182 (piston rods run past the plate). The rod passes behind O's lug in the default view, because P's locus lies above O. In far views the rod hangs free below. | 333-c |
| 396 | Presentation now hides the three staff bearing bosses. The staffs end as plain stubs. | Brown draws no watch plate. Only the small banking pins l remain fixed parts. | 396-b |
| 405 | The drawing board's face is not tone-mapped, and it is tinted so the default key light shades it to exactly the page colour (243,240,233 measured, against 226,224,217 before). | Brown draws the branches straight on his page. The board is still the solid support for the pins and the traced lines, and it still receives the rule's shadow. Its edge and back show in rotated views, and its face reads as the page. The shared `drawing-board-parts.js` (403, 406) is unchanged. | 405-t |
| 418 | Removed the dark port stub below the seat. The seat plate is now bored through with a plain 0.36 x 0.60 port under A. | Brown's port is a cavity, not a part. A covers the port at mid-stroke. | 418-b |
| 419 | Removed the rear mast. The A and B axles are plain stubs ending 0.12 behind the discs. | Brown draws no support for the axles, so they follow the gear-family stub convention. The floor block stays, because Brown hatches the floor and the rocker rolls on it. | 419-b |
| 440 | The flume carries a shallow water sheet down to its lip. It is lengthened from 3.72 to 5.25, so its upper end lies just beyond the default crop: past the right edge in the square review frame, and just past the top edge in a 2:1 frame. The dead post and sill code and their `remove` entries are deleted. | Residual: in far and rotated views the flume's upper end still ends in free space, because Brown breaks it off. No structure is invented to hold it. | 440-c, 440-cw |
| 423 | The round pipe for the right-hand passage is replaced by an inner cast wall. The wall is a capsule band the full casting depth, running from under valve a's chest round the right pivot boss, about 0.2 inside the casing. It stops about 0.7 above the foot, so the passage turns under it into the bottom quadrant's outer steam space. | This matches Brown's double wall. Residual: the wall follows the casing a little more closely round the boss than Brown's does. | 423-b |
| 443 | Disc B takes the shared see-through style (`makeSeeThrough`). | Brown dots the casing, the spiral and the far floats where the disc covers them. The floats behind the disc now show through it. The disc is still Brown's plain disc. | 443-b |
| 447 | The lower hull is now lofted (`reaction-ferry-parts.js`). Below the 0.17 gunwale band, round-bilged sides turn in to a flat bottom at half the beam, 0.47 below the deck. The stem rakes back to 0.72 of the length. A flat transom stands at x 2.44, forward of the rudder stock and its bearing. | The hull draws about 0.27 below the water and reads as a boat in the oblique views. The plan view is unchanged. | 447-b, 447-b2 |
| 387 | The boat is centred on the end-frame posts, about 45% from the bow as Brown draws it: bow -1.55, stern +1.85. The thwart now lies at the widest section. | Now 3.40 long by 1.98 wide (it was 2.55 by 2.4, nearly round). The beam cannot shrink further without narrowing the ladder, because the posts stand outboard of the rails. The stern runs under the ladder's low end. | 387-b, 387-b2 |
| 467 | No change. | Brown hatches the jack body, the ram and the base: it is a section. The model is one clean cutaway: the body, ram and base are cut on one plane, the pipe is whole, and the pump and lever are whole outside. This is correct for the plate. | 467-a |

## Intersections (spacing 0.01, 129 samples)

The screens ran one at a time, from a HEAD export (before) and from the
working tree (after). No new solid intersections appear. The removed parts
only drop mesh counts.

| ID | Before | After |
|---|---|---|
| 262, 263 | cone B x roller C at 0.0000 (rolling contact) | unchanged |
| 277, 333, 418 | clean | clean |
| 396 | impulse pin x fork 0.0709; wheel x pallet g at 0.0000 | unchanged (a known limit) |
| 405 | traced-curve fluid overlaps only | unchanged |
| 419 | band cords in their attachments (deforming, 0.108) | unchanged |
| 423 | clean, with the tube listed open | clean, no open mesh |
| 440 | water-stream fluid overlaps only | unchanged; the new flume water adds none |
| 443 | water-body fluid overlaps only | unchanged |
| 447 | river-water fluid overlaps; hull x river 0.11 | river x hull 0.24 (the deeper draft); otherwise unchanged. Hull, deck and anchor arm were already listed open. |
| 387 | hull x tide-level reference plane 0.50 (fluid) | unchanged |

## Faces

`scan-bad-faces` before and after:

- 423 has one more degenerate triangle, from the new wall's capsule chain.
  Degenerate triangles are harmless.
- 262, 277, 333 and 419 lose meshes, because the removed parts are gone.
- No new inward, shading, mixed or sheet faces.
