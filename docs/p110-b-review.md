# Pass 110, lane b: movement 454 water and centre-clamp lug

Reviewer: Claude Opus 5.5, pass-110 lane b. Scratch captures are in `/dev/shm/p110/b/`. The plate is `public/engravings/mm_454.png`.

Files claimed:
- `authored-diaphragm-pumps.js`
- `flexible-pump-working-parts.js` (shared with 453)
- the new `diaphragm-pump-water.js`

453 is byte-identical: its hash is `0adb2f87…` before and after, over all mesh positions and world matrices at t = 1.3.

## User complaint: "454 water is disconnected"

**Verified before the fix** (`before.png`: phases 0, 0.25, 0.5 and 0.75, plus two rotated views). The water was five separate proxies:
- **Chamber water:** a flat-topped cylinder of radius 1.15 at the average water height.
  - It stood 0.1 inside the 1.25 wall.
  - Its flat top broke through the dished diaphragm at the centre and left a dry wedge under the rim.
- **Suction tube:** stopped at the bottom of the check body. The check body held no water, and there was a 0.25 gap below the chamber water.
- **Branch tube:** started at x 1.15, about 0.07 outside the chamber water, and stopped at the delivery body. The delivery body held no water.
- **Riser tube:** radius 0.18 in a 0.265 bore, starting at the body's lip.
- **Flow:** nothing showed flow.

**Fix.** The water is now one continuous body, built in `diaphragm-pump-water.js`:
- **Standoff:** every surface stands 0.008 off the solid it fills.
- **Joins:** the pieces meet ring for ring, with open ends and no internal sheets.
- **Suction column:** one lathe about the suction axis covering the pipe, the flared check body, the seat's two ports (a plan stack), and the body above the seat up to its lip.
- **Chamber:**
  - **Lower part:** a plan stack round the suction body's footprint, in 0.01 steps through its cone, up to the lip. It opens onto the suction column's mouth.
  - **Upper part:** a lathe up the wall to under the clamping ring, then into the ring's bore.
  - **Top:** rebuilt every frame on the membrane (0.008 below it) and round the lower clamp plate.
  - **Branch port:** the wall is bored where the branch leaves, and the bore's rim is snapped onto the branch water's saddle (0.2167 to 0.2173 from the axis; the water radius is 0.217).
- **Branch:** a tube on the branch wall's own centreline. It starts in a saddle on the chamber water's wall and ends on the delivery body's inlet ring (same angles).
- **Delivery column:** one lathe covering the flared body, the seat's ports, the lip and the full 0.257 riser, up to the riser's cropped top. The riser is left open there, as 453's riser is.
- **Flow:** the suction, branch and delivery columns use the shared streak material (`waterStreamMaterial`).
  - The streak texture advances by displaced volume, so it runs slower in the wide check bodies.
  - Suction streaks move only while the diaphragm rises, and delivery streaks (branch and riser) only while it falls. Each advances 5 whole tiles per cycle, so the loop is seamless.
  - Measured on the riser crop: 4,056 px change over 5% of the cycle during delivery, and 0 px during suction (`fm.png`).
  - The cutaway clones water materials; the streak shader's fresnel hook is restored on the clones.

**Continuity certificate.** This is a new test in `movement-454.test.mjs`. At five phases, every open edge of all the water meshes lies either on the suction mouth or riser top (the intended open ends) or on the branch port saddle, which is closed by the other surface to chord sag. There are no other boundaries.

## Ledger residual: "the lug foot overhangs the centre clamp to the front by about 0.1"

**Verified.** The lug's plan was x ±0.10 by z 0.05 to 0.28, on a plate of radius 0.20. It overhung by 0.08 at the centre and 0.10 at the corners. The lug's eye (radius 0.209 at height 0.20) also dipped 0.009 below its own foot, through the plate's underside.

The plate cannot simply grow, because the link hangs at z 0.29 to 0.39 and its eye reached down into the plate's depth. The fix:
- **Link eye:** now 0.32 above the membrane (`linkEyeHeight` 0.20 → 0.32). The link clears the plate, and the diaphragm's stroke moves down 0.12 (centre 0.806 to 1.556; the rim is at 1.50).
- **Upper clamp plate:** radius 0.30, so the lug's foot (x ±0.10, z ≤ 0.28, corner radius 0.297) stands wholly on it.
- **Plate gap:** both clamp plates stand 0.003 off the zero-thickness membrane, so no faces coincide.
- **Membrane profile:** the membrane is now flat under the plate, which is how clamp plates grip it. It is a clamped quartic from r = 0.30 to the rim: p = (1 − s²)², with s = (r − a)/(R − a).
- **Effective area:** πa² + 2π(R − a)(8a/15 + (R − a)/6) = 1.894, where it was πR²/3. It is used for volume and flow, and the test checks it numerically.
- **Lug outline:** trimmed at its base in `plateJoint`. This is a no-op for 453.

## Captures

All in `/dev/shm/p110/b/`:
- `before.png`: before the fix.
- `after.png`:
  - the plate;
  - the default view at phases 0, 0.25, 0.5 and 0.75;
  - yaw +40 / pitch −25 and yaw −40 / pitch +25;
  - the side view;
  - two lug close-ups.
- `zm.png`: close-ups of the delivery body, suction body, branch port and membrane after the fix.
- `fm.png`: the streak motion check.

## Tests and screens

- **Tests:** `movement-454` (13, including the new lug and continuity tests), `movement-453`, `flexible-pump-452-454-solids`, `p88-pump-water-coincidence` and `p86-sliver-joints` all pass.
- **Wider suites:** `models.test.mjs` (163 pass) and the loader and route tests (5 pass) also pass.
- **Updated tests:** the profile test now asserts the flat-centre profile and its area, and the renderer test checks the water top against the membrane.
- **Coincident faces:** only the pre-allowed degenerate triangle pair on the delivery branch (3.7e-7) remains. Two seat-port faces (water on the seat's x = −0.175 edge) were found and fixed, as was the flat membrane on the clamp plate.
- **Disconnected parts:** 0 detached, 0 slivers, 0 lips. Near misses are down from 8 to 7, all pre-existing hinge-bore or frame clearances.
- **Saved reports:** none fingerprint these files.

## Residuals

- The riser's water is open at its cropped top: the delivery main continues beyond the plate's crop, as on 453.
- The small fixed seat lugs, the hinge knuckles and the flaps stand in the water, as submerged parts do. The water is not carved round them.
