# Pass 57 · lane p57-c (262–378 rotated-view findings)

Scope: the pass-57 audit findings in `/dev/shm/audit57/c/findings.json` for 262, 263, 272, 277, 286,
290, 292, 295, 304, 305, 318, 321, 332, 333, 336, 351, 353, 367, 377 and 378.

Method: a non-watching Vite server on port 44473, restarted after every edit. The captures are
default at phase 0 and 0.5, oblique, yaw ±60°, back, and top (`/dev/shm/n57c/cap.mjs`, tiles
`t<ID>-<tag>.jpg`). Zoomed and far views came from `/dev/shm/n57c/zc.mjs` (`Z<ID>-<tag>.jpg`). The final
fresh-server capture of all 20 IDs is the `-f` set; it reported no page errors. The intersection
screen is `show-body-intersections.mjs --spacing=0.01 --samples=129`. 378 needed
`NODE_OPTIONS=--max-old-space-size=10000`.

Support convention: plain frame-colour back bars or plates behind the moving parts, with bosses or
bores for fixed pivots, kept small in the default view.

| ID | Change | Seen in | Intersections |
|---|---|---|---|
| 262, 263 | A head standard (the same flared/splayed standard as E) with a plain bush on D's input journal beyond B's large end. The journal is lengthened (−3.24 → −4.1) so it stays in the bush over the whole 0.57 traverse; B's large end is 0.78 clear. In 262's end view the bush reads as Brown's circle round D, and its legs as his feet. | t262-b, t263-b (r60, rm60, top) | Only the cone/roller working contact (0.0000). |
| 272 | The cam is one solid plate colour: the working band keeps a coincident skin for the contact checks, so the plate is no longer a two-tone yellow/red target. A 0.18 cylindrical rim land between the wavy trough edge and the bevel removes the knife edge; Brown's band between the two S lines now reads as a thick rim. A front hub is added, so the shaft has a hub on both faces. Brown's side silhouette is the trough, top and bottom forward and middle recessed, and it is kept, so the motion law is unchanged. | Z272-b (def, rm60, obl) | No solid pairs. |
| 277 | One lock plate replaces the straps: the convex hull round the tumbler arbor, spring-c block, mainspring clamp and a new arbor lug, kept clear of the ratchet crests. The lug stands from the plate to just behind the dog's plane. The cylinder arbor now runs out through a bore in ratchet b's centre (inner radius 0.03 → 0.102) into the lug. | Z277-b (back, r60, obl), Z277-c (lug and arbor close-ups) | No pairs. |
| 286 | One back bar standing on the base, hidden behind the rod in the default view. It carries two bored rod guides, one above and one below the lifter's sweep, and an arm to a bored bearing boss for the rock shaft. The shaft now runs back into that boss. The rod runs 0.7 past Brown's break, still inside the crop, so it stays in its upper guide. | t286-b (def, r60, rm60, back) | Only the existing zero-depth toe/shoe and valve/seat contacts. |
| 290 | Rod K runs on 2.2 past Brown's crop to a lens bob. Both are flagged `cameraFitExclude` (honoured in `annular-stud-working-parts.js`), so the default framing is unchanged. | t290-c (framing), z290-far-far (whole pendulum) | No pairs. |
| 292 | The studs are steel instead of rim colour. From behind, the rear-face studs pointing at the camera had shaded dark like the rim and showed only as pale side slivers; they now read as standing studs from either face. The studs themselves were already correct (alternate front and rear). | Z292-b (back, back-oblique, front) | No pairs. |
| 304 | The replaceable pin stems screw into blind holes in the rim instead of poking 0.05 out of the back face as a ring of dots. | t304-b (back) | No pairs. |
| 305 | One plain back bar, hidden behind the pendulum rod in the default view. At its head is a cock boss with the suspension pin, now run back through the eye into it with a retaining head in front. Lower down, the disc-arbor bush is seated on its face. | Z305-b (eye close-up, r60, rm60, back) | No pairs. |
| 318 | A back bar behind the balance carries the staff's lower bearing and the scale plate, and has an arm to a post under stud R. The post stands where the spokes never reach at the ±24° swing. A small front cock bar from R's head over the fixed ring bears the staff's upper end above the regulator lever. | t318-b (obl, r60, top, back) | Only the existing spring/collet seat (0.009). |
| 321 | A back bar hidden behind G carries a bored rear bearing for the barrel arbor and a bored stud boss round T's journal pin. | t321-b (back, r60, top) | Only the existing seated spring ends (0.091) and the rope. |
| 332 | Shaft A is steel instead of black, so it no longer reads as an empty bore. It runs back into a boss on a flat tie that goes up into the vessel's base, mostly behind the side lever. | Z332-c (def, under, back) | No pairs. |
| 333 | The pale ground slabs become frame blocks. O's block and post keep the lug plane, in front of the O-M bar that dips below O; R's stand behind the R-W rocker. Two posts run down to a cross bar on the P cylinder's head, beyond the crop. O's post also hides the P rod below O, as Brown draws. | t333-b (def, r60, back, top) | No pairs. |
| 336 | A bed bar level with the cylinder's bottom flange runs left behind the side lever. On it are a pedestal taking shaft O (steel, run back into it) and a column up to the diagonal member's flange, which no longer ends in the air. | t336-b (obl, r60, rm60, back) | No pairs. |
| 351 | The two open C-guides are kept and recoloured to the frame colour (they had dark ink lips). The lower guide is raised to −2.25 so the lower collar clears it at full lift. One back bar carries both guides and has an arm to the pinion bearing boss that stops clear of the turning shaft. The presentation entry now removes only the guides' white index. | Z351-c (def, back, obl), t351-b | Guides at −2.36 overlapped the collar by 0.013; after raising to −2.25, no pairs. |
| 353 | A plain post behind the helve from the fulcrum bearing bridge down to a foot level with the cam post's base. | t353-f (def, obl, r60, back) | Only the existing zero-depth anvil face/head (coaxial) contact. |
| 367 | The graduation grooves on the ivory strip are removed; it is now plain. At this scale, cut grooves still read as faint ticks. The calibration tick objects stay hidden. | Z367-b (default zoom, top, obl) | Unchanged pre-existing 0.0798 pin/arc overlap. |
| 377 | The rail's near end runs on to the top of the diagonal side plank, bolted to it by a short bracket. Its far end, beyond the drum's end ring, stands on a plain post with a foot. The tube's open ends lie inside the bracket and post. | t377-b (def, r60, back, top) | No pairs. |
| 378 | The log is centred on the saw's plane (z 0.34; length 2.62 → 2.0) between the posts, with the kerf across its middle. The saw now cuts into it from every rotated view, and a sawn end face was added at the far end too. The painted dark growth rings are removed. | Z378-b (def zoom, r60, rm60, top, back) | Only rope/anchor deformation (0.0017). |

## Not fixed

- 295: I did not fix this. The teeth heads on thin stalks are the real cylinder-wheel construction, but they
  still read as loose from ±60°. The stalks are fixed by the cylinder passage clearance. A stalk of radius
  0.085 (from 0.082) enters the cylinder by 0.019, and a 0.10 radius by 0.034. Even a foot flare 0.02 above
  the arm enters by 0.016. So the stalks cannot be thickened without reshaping the cylinder's passage. The
  change was reverted.
- 262: the head standard now stands in front of B's face in the end view (neck, bush and legs over B's lower
  face). This is a real support, not notation, but it is more than Brown draws there.
- 333: the two frame posts are prominent in the default view where Brown draws only hatched ground.
- 318: the small cock bar shows in the default view across the spring, from R to the centre.

## Files touched

`src/simulation/authored-pendulum-saws.js`, `authored-colt-ratchets.js`, `pin-escapement-working-parts.js` (305
only), `authored-beveled-cams.js`, `authored-parallel-rulers.js` (367 block), `authored-eccentric-cone-drives.js`,
`authored-poppet-valves.js`, `authored-annular-escapements.js`, `annular-stud-working-parts.js` (fit-exclude
flag), `authored-stud-escapements.js`, `watch-balance-parts.js` (`correctWatchRegulator` only),
`authored-going-barrels.js`, `authored-marine-parallel-motions.js`, `authored-stamps.js`, `authored-trip-hammers.js`,
`authored-person-treadmills.js`, `src/data/source-presentation.js` (351 entry). Tests: `movement-272`, `movement-277`,
`movement-304`, `annular-stud-working-solids`, `cam-281-286-solids`.
