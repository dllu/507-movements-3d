# Pass 83 lane p83-c: pawl seating (491), stropped block (492), C and d lowered (391), horse mane and elbows (376), walker shoes (377)

Captures (scratch, not in the repo): `/dev/shm/p83-c/{before,after}` (default at several phases beside the plate, ±60°
about vertical, top, back), close-ups `/dev/shm/p83-c/c491/{z,n}.png` (pawl), `/dev/shm/p83-c/a1/c492.png` (strop),
`/dev/shm/p83-c/after/{z391,391-cc}.png` (C and d beside the plate), `/dev/shm/p83-c/h/{before,after}.png` (horse with
the wheel hidden), `/dev/shm/p83-c/s/shoes.png` (shoes), comparisons `after/{376,391,491,492}-cmp.png`.

## 491 capstan: the pawl seats in the tooth root
- Brown draws the held pose: the nose in the root against the tooth face. A gravity pawl hauled over vertical faces
  cannot land there: dropping about its radial pin the nose moves forward about 19 % of a tooth, and the prescribed
  12.5 % drop time adds the rest, so it lands about a third of a tooth up the next ramp. Undercutting the faces to catch
  it would change the face slant Brown draws, so the phasing was changed instead.
- Each 8 s cycle now opens in Brown's held pose. The capstan hauls one turn and 0.397 of a tooth, with its speed easing
  in and out over 6.9 s. The hands then ease off: in 0.6 s the capstan backs 0.397 of a tooth (7.9°) while the nose
  slides down the ramp it landed on, then it holds, seated, to the loop point. Net motion is one turn per cycle.
- `scripts/generate-capstan-pawl-contact.mjs` bakes a second branch (`capstanPawlSeatPhase`, `capstanPawlRecoilSamples`
  in `capstan-pawl-profile.js`). It covers the pawl lying below the crest line, from the seat up to the release, and
  uses the same finite-outline/crown-triangle clearance search as the hauling table. The hauling table regenerates
  byte-identically. Seat = −0.2371 of a tooth from the crest release.
- Seated: clearance to the crown is 0.0005, the generator's contact allowance. Backing the capstan another 0.004 rad
  drives the pawl 0.0027 into the face, so the face arrests any further recoil. The nose bottom is 0.043 above the root
  line; a 0.05-radius round nose touching both the vertical face and the ramp cannot go lower. Pawl pitch is continuous
  through all stage changes and the loop seam.
- Residual (physics, not a defect): while hauling, each drop still lands about a third up the ramp, as a real gravity
  pawl would. The recoil and hold are prescribed.

## 492 boat-detaching hook: stropped block
- The ellipsoid shell now carries a laid-rope strop in a score cut round it across the sheave, between the two falls.
  The score is cut exactly clear of the strop's own path, so it runs out under the arse where the legs leave the shell.
  Below the shell the two legs are seized side by side. The bight wraps the top bar of a forged eye on the hook shank,
  replacing the swivel cup; the hook hangs from the strop.
- The block frame turns on the hook axis (15.6° from the drawing) so the strop runs edge-on down the middle of the
  shell, as Brown's converging lines do. The eye is forged square to the bight. The hook's S-neck is 0.10 shorter, so the
  block rises only 0.36.
- Measured (test): strop-to-shell gap ≥ +0.0014 over 4000 centreline samples, 3029 of which lie in the score. The bight
  bears on the eye's top bar (gap −0.00008). The legs are side by side in the seizing.
- Residual: the seizing is a plain wrapped band, and Brown's sheave slot on the shell's end is not modelled.

## 391: C and spring d lowered to Brown's height
- C's pivot now stands 0.45 above A1's upper guide corner (was 1.05). In the default view it is 33 px above the right
  guide's top; the plate shows about 34 px, and the previous build showed 73 px.
- C, its link and spring d keep their shapes. The roller they bear on moves correspondingly lower on A1: 0.75 below
  the guide arm, on a thin collar on A1's front face. So the strut loads spring d before the corner and pushes A1
  outward exactly as before (the assist and torque tests are unchanged).
- C's pivot moves 0.06 left, so the roller lies within A1's width; before, its lug boss stood 0.11 past the rack's edge.
- Spring d's anchor rises 0.36, so d rises to the right as drawn and runs just above guide b's top. The spring
  still pulls in the same sense (positive torque test).
- Release now happens about 0.05 s later (test sample moved from 5.0 to 5.1 s). The loop-seam period mismatch is 0.153
  (was 0.146), within tolerance.

## 376 horse (Blender)
- Mane: 23 flattened hair locks now stand up and back along the crest from the poll to the withers, with jagged tips as
  Brown hatches them. They are the body's second material group, in the tail's hair colour
  (`export_grouped`, `groupStarts`).
- Raised foreleg: each side of the body gains an upper-arm mass. It runs from the point of the shoulder down to an
  elbow centred on the foreleg's pivot, so the forearm's top turns inside it at any swing. The stump that stood out
  behind the raised forearm is gone. What shows now is a smooth elbow joined into the chest.
- Body 0 non-manifold edges. The hand, cuff, forearm, legs, tail, jacket, head, cap and arms regenerate byte-identical.

## 377 walker
- Shoes (Blender): a lofted laced shoe replaces the flat sole box. It has a rounded toe box, a vamp over the instep and
  a heel counter and quarters closing round the ankle under the trouser cuff, over a welted sole and heel. The factory
  clamps it to the old 0.28 × 0.11 footprint with a flat sole at y = −0.05, as before; the height limit rose from 0.02
  to 0.10. 1100 triangles, 0 non-manifold edges. Board, body and rail clearance tests pass.
- Gait left unchanged: the seated read is forced by the treadmill design, quantified here:
  - The 14 radial boards make each step rise 0.82, which is 57 % of the 1.44 leg. Brown's closely spaced boards are
    about 30 %.
  - The stance leg can only stand near vertical with the hips within about 0.25 of the boards (hip x ≤ 1.75 from the
    axis). With the current boards there, the raised knee passes through the board above for most of the stance
    (full 0.052 penetration in a 350-pose sweep). Hip positions between 1.85 and 2.3 do the same, and so do 24 boards
    at a Brown-like step.
  - Fixing it needs a stepped drum (treads with risers) rather than radial paddles, which is a redesign.

## Tests
`node --test` on movement-376, -377, -391, -491, -492, treadmill-gait-solids, treadwheel-working-solids,
weighted-rack-selector-contact, alternating-drive-solids, weighted-rack-handoff-solids, capstan-491-finite,
boat-detacher-contact, authored-loader, source-presentation and rotation-indicator: 88 pass, 0 fail.
`node scripts/check-loop-seams.mjs --ids=376,377,391,491,492 --all`: 0 seams above tolerance.
