# Movement 389 — continuous finite-pawl handoff

The [official caption and engraving](https://507movements.com/mm_389.html) identify an eccentric-driven lifting jack and a separate upper stop. The current HTML has no `ae.add_model` or `mm_present` model and marks animation unavailable. Brown supplies neither dimensions nor a motion schedule.

This pass incorporates and qualifies the useful contact work preserved in `codex/389-continuous-pawl` (`1a4025d`), following the earlier handoff recorded in `docs/lifting-contact-review.md`. The isolated WIP worktree and branch are preserved. Its first-collision projection had previously jumped between disconnected pawl-angle intervals; its later overtravel trajectory provides the continuous route used here.

## Working corrections

- Both pawls now have finite pointed plates, with a real bored stop-pawl pivot. The eccentric disk has an offset shaft bore and runs in an actual finite annular strap. Bored journals, rear bridges and guide cheeks provide fixed supports.
- The rack rises one pitch **plus 0.10 overtravel**. The upper stop stays on its clear retreat branch until enough extra lift connects that branch to the seated pose. The rack then settles onto the stop while the driving pawl remains in contact. Only after transfer does the lower pawl retreat. The follower also has 0.04 return undershoot.
- Three such strokes retain exactly three pitches. The disclosed unloaded reset first lifts the rack clear, retracts the pawls, lowers it, then reseats them. The eccentric parks during reset and recovers continuously afterward. This avoids both the old handoff jump and a reset teleport.
- A source review moved the eccentric closer to the rack, increased its eccentricity, shortened the driving arm and reduced the oversized strap wall. The upper stop pivot is 0.48 below its seat rather than 0.18, giving a 35.8° seated arm slope rather than 12.7°, closer to the roughly 45° hand-drawn arm, while preserving the same tooth seat and finite handoff. The rack has 18 teeth, a wider body, shallower teeth and less bare bar above the tooth row. Its main guide ends near the eccentric rather than above the upper stop. The saddle stem now enters the rack by 0.02 instead of floating 0.065 above it.
- The full ten-second demonstration is a minimum display duration. Full-cycle framing, no ground plane and fog-free materials keep the work visible.

## Source pitch review and changed assertions

Simple black-pixel column runs and circular-edge detection on the 525-pixel engraving give a typical tooth pitch around **17 pixels**, an outer eccentric/strap radius around **35 pixels**, and roughly **18 visible teeth**. The shaft pin is near (287,197), not the previously recorded (286,166); the outer ring center is near (289,211). The source is hand-drawn, with visibly uneven tooth spacing and unspecified hidden depths. These are approximate measurements, not a CAD trace.

The final radius is 0.48, eccentricity 0.16, driving-arm length 1.20 and computed pitch **0.27029911**. Thus pitch/radius is 0.563, within the deliberately approximate source comparison band (0.40–0.65). The final geometry improves the eccentric offset and steepness of the driving arm while retaining the experimentally established finite handoff. The upper stop's exact bent outline and hidden support depths remain reconstructed.

Four legacy expectations described the old ideal point law, not source requirements: follower excursion equaled pitch, maximum lift already equaled retained lift, the upper stop held immediately after maximum lift, and reset midpoint had no preparatory clearance lift. The revised tests explicitly require the extra travel, supported settling interval, completed one-pitch storage and staged reset height. They retain exact orbit, rigid-arm, tooth-seat and renderer binding checks; finite-clearance tests are independent of those point equations.

## Validation

`node --test tests/movement-389.test.mjs tests/jack-389-contact.test.mjs`

15 checks cover source/topology, analytical closure, real tooth-face engagement, finite pawl/rack/strap interference, shaft bores and supports, continuous handoff/reset, geometry identity, timing and the saddle load path. The surface sweep checks 257 operating/reset poses for pawls and strap, and 65 poses for the fixed hardware. Independent time scans at **32,768 and 65,536 poses** bound the maximum pawl-tip travel speed at **4.19318 units/second**, with convergence as resolution doubles; the former discrete branch jump is absent. The largest step occurs in the deliberately unloaded reset. A downward reaction at the actual upper tooth seat turns the stop toward its seated position, not toward release.

The final source/default/front/reverse browser review, including the steeper upper stop and joined saddle, found no errors or clipping over 65 full-cycle poses (maximum absolute screen NDC 0.92593). Bulk screenshots and diagnostic outputs remain in `/dev/shm`.

## Limits

This is an analytically prescribed geometric reconstruction. Eccentric rotation, pawl preload/retreat, settling and unloaded reset are prescribed; gravity, contact forces, impacts, friction, elasticity and lifting capacity are not solved or certified. The finite path and actual engagement are qualified by bounded samples and exact rigid constraints, not an exhaustive collision proof or a passive MuJoCo simulation. In particular, the deliberate reset assumes external unloading and manipulation rather than demonstrating safe loaded lowering.
