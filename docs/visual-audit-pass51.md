# Pass-51 visual audit of all 507 movements

Three read-only reviewers captured every movement with
`node scripts/review-movement-source-views.mjs` (production route, default view
composited beside `public/engravings/mm_NNN.png`) and listed concrete, fixable
mismatches against AGENTS.md's rule: initial camera angle, part shapes, and no
parts the plate does not draw. Physics limits and small proportion differences
are excluded. Items are the queue for the pass-51 fix lanes; the ledger rows
record what each lane actually corrected.

## Cross-cutting findings

- White phase-index stripes, dots and beads that Brown never draws appear on many
  wheels, hubs and ropes (for example 1–23, 32, 45, 48, 53, 134, 145, 150, 151,
  191–195, 201–215, 222–245, 267–291, 312–321, 434, 435). White is also used for
  real pins, washers and scales, so they are removed per factory, not by colour.
- Ground shadows appear under face-on views the plates draw without a ground
  (216, 234, 277, 299–304, 310–312). `hideGround` removes them per movement.
- Base slabs, gallows posts and guide frames the plates do not draw remain in
  much of 352–507, and several 83–154 factories.
- Oblique or elevated default cameras where the plate is a flat elevation or
  section: 7, 74, 95, 108, 109, 113, 116, 136, 147, 150, 190, 196, 208, 226, 260,
  264, 266, 271, 284, 285, 286, 357, 361, 366, 368, 375, 376, 377, 387, 389, 393,
  413, 417, 436, 440, 441, 442, 466, 477, 479, 480, 481, 482, 491, 493, 507.
- Spoked wheels where the plate draws plain discs: 199, 243, 291, 313, 314, 396,
  398, 402, 415, 416, 419.

## Per-movement items (H high, M medium, L low)

1–170:
- H 83 undrawn frame, posts, base and rod-A slide guide; 90 undrawn pedestal stand, lumpy yoke; 91 undrawn guide frame and collars; 95 oblique camera, undrawn L gantry, wall as a box instead of a hatched corner; 136 undrawn pedestal, rail and bracket, oblique; 145 beam pivots on an undrawn centre post (plate pivots at its right end), white dots; 150 side-on camera where the plate looks nearly end-on down the shaft, markers, subject small; 154 undrawn gantry for the top pulley, missing front pedestal.
- M 7 elevated camera, three discs where the plate draws two pulleys; 14 upper block has 3 sheaves (plate 4), open cheeks; 18 middle pulley half size; 31 worm oversized and coarse; 32 white stripes; 37 right body pointed where the plate draws a frustum; 48 square jaws where the plate's are rounded waves; 53 white wedges, perspective; 58 cluster clipped; 61, 62 cutaway where the plate draws a closed drum; 63 spring a detached stub and a stray piece; 67 wheel B in front of plate E (plate: behind, dotted); 74 elevated; 76 sector leaves the frame; 85 undrawn anvil; 86 undrawn pump rod/guide, missing right rope runs; 88 disc clips frame; 94 undrawn lugs; 96 undrawn spring and collars; 98 grooved arm in front of the disc (plate: dashed behind); 105 undrawn lower jaw, base, die; 107 zigzag groove where the plate's is sinuous; 108 elevated, groove reads as chevrons; 109 elevated oblique; 116 oblique, frame overflow; 118, 119, 123 subject small (119 rack undersized); 127 rack rods run across the pinion; 135 undrawn guide rods and rail; 139 undrawn post; 142 long rod; 146 extended stems and collars; 147 elevated, ramp as two blocks; 149 undrawn guide block and bar; 156 arm leaves the frame, rod ends in a block; 163 legged table where the plate draws nested U-brackets; 166 undrawn slide guide, disc off-centre.
- L 6 sector spokes 2 vs ≈5; 10 lower cone too large; 24 empty bores; 29, 34, 55, 69, 78, 82, 143 edge clipping; 30 rounded squares; 45, 134, 151 white markers; 52 plain discs where the plate draws teeth; 56 disc where the plate draws a ring; 70, 71 translucent C, 71 rim thick; 79 perspective; 97 collars; 101, 113 small/elevated; 104 heavy thread; 129 yaw, loose coils; 162 bevels oversized; 168, 169 fat beams.

171–340:
- H 190 oblique with a base block (plate: flat side elevation, plank section); 196 oblique, undrawn rail and post, gear A should be an elongated lobed gear; 208 oblique, protruding pins, spur pinion where the plate draws a lantern edge-on; 213 upper wheel slot and teeth wrong, coarse ratchet, stray stud; 226 oblique jumbled layout vs sectional elevation with knob B; 247 seabed slab skews framing; 260, 264 oblique where the plate is an edge-on elevation (264 shows face gears and pinion); 262 undrawn pedestal and spring, plate is a low footed cradle; 266 oblique, open frame where the plate draws a plank; 271 oblique, coarse ratchet, missing left pulley and cord; 284 oblique with added posts; 285 oblique, handwheel where the plate draws a T crank; 295 full wheel where the plate is a rim-arc close-up with semicircular pallets; 333 beam pose half a cycle from the plate's; 183, 184 solid wedges and undrawn weights; 217 groove not a heart.
- M 178 undrawn slide rail; 181, 182 undrawn weights and ball ends; 186, 188 loop handles; 191, 192 slight oblique, hubs missing, 192 undrawn pinion; 195 scalloped valleys where the plate has rectangular slots; 199 spoked pin wheel and rollers where the plate draws a solid disc; 201 oblique; 202 worm oversized, cropped; 203 wide spiral plate where the plate draws a narrow J-slotted arm; 205 uniform pegs where the plate alternates long and short; 206 coarse teeth; 214 translucent cone fingers; 215 driven star too large and spiky, gold strip; 216 tilted; 218 detent G shape; 219 spur where the plate draws a lantern, web; 221 dashed path drawn as a solid plate; 224 missing slotted cam plate; 227 round-wire chain where the plate draws flat plate links; 228 camera too frontal; 229 chain legs too long; 231 missing long rod, bulky links; 233 undrawn stop blocks; 234 ghost disc under the crown; 237 camera low, extra collar; 243 spoked pulleys; 246 layout, trace curves, C as a gear; 251 undrawn anvil, small weight W; 253 undrawn spring rings; 261 undrawn slab and frame; 263 undrawn post, spring and wheel; 265 straight cone where the plate's is concave; 268 undrawn post; 270 two figures merged; 274 X arms where the plate draws lyre loops; 275 comb rack, oversized worm; 276 tilted bar, undrawn blocks; 278 closed frame bars, rope gap; 279 small, undrawn blocks; 280 saw teeth on a plain wheel; 282 rack too long; 283 long translucent barrels; 286 undrawn screw rod, oblique; 287 extra weight; 290 teeth count/form; 292, 293 full wheel where the plate is a rim close-up; 299 ground shadow; 300 spokes where the plate draws a triangular yoke; 302 coarse crown; 303 undrawn bob, 4 spokes vs 6; 309 centre rod overflow; 310, 311 cut off; 313, 314 spoked wheels; 315 undrawn cage and orbit marker; 318 end balls, tick scale; 321 undrawn top beam; 327 cropped; 329 small, cutaway piston.

341–507:
- H 357 oblique, arch-and-leg frame where the plate draws a scalloped cast frame; 358 side view with an invented gallows where the plate is a flat plan of the fusee traverse; 361 oblique with slab, handwheel face-on; 368 high oblique, small; 376 oblique, spokes where the plate draws a square lattice, added trestle and slab; 377 oblique squirrel cage where the plate draws a side elevation of a geared tread wheel on an A-frame; 410 top-down with an invented linkage where the plate draws an isometric board with clamp cheeks; 417 oblique, handwheel where the plate draws a crank, rails where the plate draws a pedestal; 441 oblique, thick channels, water box; 442 oblique with box and slab; 443 slab, posts, water box; 463 abstract boxes where the plate draws sluice-panel sections; 466 oblique block where the plate draws a section; 467 cube ears, base box, oblique; 468 plate draws two views; 470 rectangular gallows where the plate draws an arched cast standard; 471 gallows where the plate draws a single C-column; 495 exposed gears on rails where the plate draws a housed section on a cast foot, pulley on the right.
- M 342 pier and plank; 343 large cylinder where the plate draws a small table; 350 dashed line rendered as a toothed strip, small; 352 slab, crossed legs, two spools where the plate draws one stepped drum; 353 undrawn post, flag head, spiked cam; 354 disc where the plate draws a ring; 359 elevated, thin flywheel; 362 yaw, flanged drums; 363 mirrored phase, handles where the plate draws shoes; 366 oblique, open frame, plank lever, slab; 371 holes where the plate draws curved spokes; 373 dial where the plate draws a worm wheel; 374 lever horizontal where the plate's is diagonal; 375 oblique, slab, short runners; 382 thin mirror frame, cone pedestal; 383 tube frame where the plate draws a web plate; 384 small, off-centre; 385 stubby posts, big weight; 387 oblique with water plane; 389 oblique, slab, blocky buttresses; 391 rectangular guides, extra rod; 392 curved lever, spoked wheel; 393 oblique, post and slab; 396 spoked balance, squiggly lever; 402 spoked wheels, oversized escape wheel; 413 yaw, missing crank; 415, 416 spoked wheels (416 heavy treadle); 419 spoked wheels, post, slab; 420 gallows and slab; 422 tube casing; 423 loose tubes; 426 floating spheres, missing ports; 427 undrawn coil springs; 428 round casing; 429 T-stand, figure-8 casing; 430 slab, post, pipes, missing breast; 431 tank with spheres, slab; 433 paddles on a disc, small; 436 elevated; 440 elevated, slab, trough shape; 444 slab, box, missing lower tank; 455, 456 undrawn legs and arrows; 459 blade star, spur gears; 461 heavy troughs, water box; 465 level beam, blocks, slab; 469 thermometers, round hose; 477 oblique box; 479, 480 elevated (479 disc weights); 481 dial, slab, oblique; 482 box casing, oblique; 483 dials; 485 sails face-on, small tail, arrows; 486 6 arms vs 8; 488 small blades, arrows; 490 handwheel where the plate draws a bar lever; 493 oblique stone; 500 missing section; 504 tiny, off-centre; 507 elevated, small.
- L 341, 348, 355, 365, 369, 378, 379, 388, 390, 394, 397, 398, 401, 403–409, 418, 424, 425, 432, 434, 435, 437, 439, 447, 451, 453, 457, 458, 460, 462, 464, 473, 478, 484, 491, 496, 498, 501 (slabs, markers, arrows, small shape or framing items).

## Stale ledger claims found

137 (eye and rod now shown), 151 (no frame visible), 153 (bake now removes the
base), 217 (notch wheel F no longer shown), 297 (plain disc now), 304 (broad
plate now), 346 (claim reversed), 347, 372, 381, 395; and rows claiming undrawn
supports are removed while legs, tanks or guides remain (391, 394, 441, 455,
456, 467, 501).

## Second audit after three fix waves

A second read-only pass captured all 507 movements again beside their plates
and compared them with the updated ledger rows. About 155 of 1–253 and 193 of
254–507 read as faithful apart from disclosed limits. The remaining concrete
items, queued for wave 4, were:

- 1–253: 37 pointed cone and protruding studs (claimed frustum); 31 coarse worm;
  136 and 154 undrawn pedestals and gallows; 218 oblique with markers and a thin
  detent G; 203 still a broad C plate; 227 round-wire links; 237 thick drum crown;
  251 missing beam B; 185 missing wall; 73 oversized block; 86 cropped; 106/107
  slab ceilings, 107 zigzag groove; 116 ghost pinion; 63 detached spring stub;
  77/233 protruding pins; 214 translucent fingers; 219 spoked rim; 239 unbroken
  wheel; remaining white index marks on 171–245; small framing on 172, 177, 196–198.
- 254–507: 267 undrawn arrow; 377 oblique where the plate is a side elevation;
  468 whole-mains close-up where Brown draws one joint; 440 raised camera;
  441/461 heavy water blocks; 354 disc where the plate draws a ring; 394 extra
  wire loop; 417 thin head A; 423 translucent fans; 426 short vanes; 436 extra
  plate and disc; 447/455/456/487/489 flow arrows; 477 open frame for a cast
  casing; 500 missing section; 502/504 small framing; 280 missing standard;
  378 log placement; 408 missing construction; and low-level markers and slabs.
