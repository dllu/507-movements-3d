# Pass 102, lane p102-b: remaining minor rows 236, 278, 366, 411, 433, 442, 462

- **Reviewer:** Claude Opus 5.5, lane p102-b, 2026-09-28. No git writes.
- **Server:** Vite on port 46062.
- **Captures:** `/dev/shm/p102/b/`, outside Git. `mNNN.png` shows the plate, the default view and a rotated view before the fix. The `aNNN*` and `A*` files are after the fix.
- **Claims:** authored-intermittent-core.js (236 function only), alternating-pawl-236-working-parts.js (claimed, not edited), authored-safety-stops.js, authored-treadle-drills.js, authored-self-recording-levels.js, authored-horizontal-overshot-water-wheels.js, source-presentation.js, authored-eisach-pot-wheels.js and authored-chain-pumps.js (the last two claimed, not edited).

## 236: no flick at the lever reversals
- **Finding confirmed.** A 2000-sample probe of `stateAtCycleCoordinate` put the lever's peak speed at 0.604 rad/s against a median of 0.205, a ratio of 2.94. The peak fell in the backlash after each reversal, where the returning pawl slides into its root.
- **Cause.** Each reversal was one quintic between the separating pawl's and the catching pawl's driving states. Its duration was solved so that it turns exactly at Brown's top (or at the bottom of the swing). A quintic with fixed end states puts most of its travel late, so the lever flicked.
- **Change** (inside `alternatingTwoPawlContinuousRatchet` only):
  - Each reversal is the same quintic plus a shaping term, swing·u³(1−u)³(α+βu). The term leaves position, speed and acceleration unchanged at both ends, so the joins stay C2. The duration is still solved to turn exactly at the drawn extremes.
  - (α, β) were found offline for the lowest peak lever speed, subject to three conditions: the reversal turns once, c keeps at least 0.15 pitch of drive, and the flywheel dip is at most 0.15. The values are top (−20, 27.5) and bottom (24, −32.5). They are fixed constants because the search costs about 3 s at load; with them, load time is unchanged at about 0.4 s.
  - The recovery after the catch spans 60% of the catching pawl's drive. Before, it was half the reversal's duration, which could exceed the drive.
- **Result:**
  - Peak/median lever speed is 1.68 (was 2.94). The largest lever step per 1/2000 cycle is 0.046°.
  - The lever still turns exactly at Brown's top and at the bottom of the swing.
  - The wheel never stands. Its slowest speed is 0.85 of the driving speed (was 0.88).
- **Why not 1.0 (proof).** Each returning pawl's backlash is about 28° of the 59° of lever travel per cycle: 16.7° after the top reversal and 11.4° after the bottom. Suppose the flywheel coasts at a fraction k of the drive speed, and the lever closes a backlash B at r times its driving rate. The lost travel then satisfies L(1 − k/r) = B. That has a solution with drive remaining (L < 59°) only when r > k/(1 − B/L). With k ≈ 0.9 and B/L ≈ 0.6, r must be about 2. The unloaded return running faster than the loaded drive is therefore forced by the plate's backlash. It no longer reads as a flick: the return is a steady run, not a spike.
- **Captures:** `a236.png` (plate plus seven phases and a rotated view).
- **Tests:**
  - `movement-236` and `alternating-pawl-236-contact` pass 15/15.
  - The dip bound in `movement-236` is now 0.85. c's minimum drive share is now 0.15 of its half, and the contact test now requires more than 20 engaged samples.
  - New test: the lever peak/median ratio is below 1.75, the lever path is continuous, each fixed shape turns once and keeps its minimum drive, and no ±1 grid neighbour is flatter.

## 278: the loop opens on Brown's pose
- **Change.** The timeline is rotated so that phase 0 is the catch instant, with the same durations as before:
  - arrested dwell 0–3.1
  - reset 3.1–4.1
  - hoist to 5.7
  - lower to 6.8
  - drop 6.8–8, which closes on the catch
- **Rope.** The rope state is now two values:
  - `ropeBreak` opens the gap as the upper piece recoils during the drop.
  - `ropeSlack` is how limp the lower stub is.
  - During the drop, the stub stays straight and falls with the platform. A falling body carries its rope with it, so this is not a rigid standing rope. It goes limp onto B over the first 0.55 s after the catch, and both pieces re-join through the reset.
- **Default view.** The arrested pose now has stub a upright in the eye, as Brown draws it. The recoiled break shows near the top of the frame.
- **Captures:** `m278a.png` (plate, phases 0, .03 and .07, rotated) and `m278b.png` (phases .3 to .99).
- **Tests:**
  - `movement-278` passes 10/10. The hard-coded hoist and lower times now come from the timeline, and the rope check keys on `ropeBreak`.
  - New test: the loop opens arrested, with slack 0 and break 1 and the stub on the rope line. The stub stays straight through the drop and is fully limp by `stubCollapseEnd`.
- **Loop seams.** 0 seams. There is one intended pop at phase 0.85, where the rope parts; it was at 0.563 before.

## 366: arm/post lip and pinion/hub shared face
- **Lip.**
  - The upper post's head overhung the top arm's end. It was clipped at the arm top (y 3.34) beyond the end, which left a ledge.
  - The top arm now runs left under the whole post, to the head's left tangent.
  - The post's left side is a vertical tangent to its head, and its back face is flush with the arm's back (z −0.82). The post stands on the arm top (y 3.34), so the flush sides meet only at an edge.
  - The fulcrum pin now starts 0.02 behind the post (z −0.84).
- **Shared face.**
  - The keyed hub started inside the keyed cone (at `pinionOuterDistance`), so the two bores shared a length of wall. The hub now starts at the cone's back face (`pinionRootZ1`) and uses the cone's material.
  - The two axial retainers were keyed bores lying along the hub's own. They are now plain rings on the hub's outside, in the same material.
- **Screens:**
  - coincident faces: 1 flagged pair before, 0 after
  - lips: 2 before, 1 after. The one left is the feather key in its groove, which is pre-existing and intended.
- **Captures:** `y366.png` (the post and arm from six angles, lever hidden) and `z366.png`.
- **Tests:** `movement-366` and `drill-feed-solids` pass 19/19.

## 411: the pencil trace is a ribbon
- **Change.** `chartTrace` is now a mesh: a ribbon 0.024 wide on the paper, 0.0007 outside the pencil's contact radius, with polygon offset and no shadow.
  - It is built round the same centre-line samples as before, which are kept in `userData.centerline`.
  - It grows with the recording through the index draw range, and it persists across loops as before.
- **Captures:** `m411a.png` and `a411-r.png`.
- **Tests:** `movement-411` passes 12/12. It now asserts a mesh with two vertices per sample. At every sampled pose it checks the ribbon's width at the pencil, that the ribbon's midpoint lies on the centre line, and the growing draw range.

## 433: board films without the pale sheen
- **Cause.** The films used the shared stream shader. That shader mixes up to 30% white at grazing angles and is glossy (roughness 0.16). At opacity 0.3 over the orange boards, the films read as pale, pinkish-grey labels.
- **Change.** The films get their own material, built from the same `waterStreamMaterial`:
  - Roughness is 0.6, metalness 0, and the environment map is off.
  - The fresnel term only thickens the tint and never whitens.
  - Opacity is 0.62, so the films read in the jet's own water blue.
  - The shared shader is untouched.
- **Captures:** `b433.png` and `a433.png` (default and five grazing views, before and after the material change), and `z433.png` (close-ups).
- **Tests:** `movement-433`, `turbine-433-435-solids` and `water-stream` pass 22/22.

## 442 and 462: camera
- **442.** The camera is now [1, 0.58, 0.30], looking down about 30° (it was 15°). Brown shows the trough's ruled top, and now the water running along the trough shows from the default view (`a442.png`).
- **462.** The camera is now [0.04, 0.37, 1], about 20° up from a near-level 3°. The delivery sheet on the bank top now reads as a water surface (`a462.png`, including a zoom), and the view stays close to Brown's elevation.
- **Tests:**
  - The 442/462 movement tests pass.
  - `source-presentation` has one failure. It belongs to 194 (`fixed-plain-frame-for-wheel-and-input-shaft removes a part`), is unrelated to this lane, and comes from another lane's concurrent edits.

## Screens and reports
- **Coincident faces (after):** 0 flagged pairs for all seven IDs. 433's one seam is in the impact spray and was there before.
- **Disconnected parts (after):**
  - There are no new detached parts.
  - 366's hand-crank near-miss is pre-existing.
  - 278's single lip is the pre-existing bossed-bar section.
  - 411's two lips are unchanged.
- **Loop seams:** 7 checked, 0 seams. 278 has its one intended pop.
- **Reports:** no validation report or bake fingerprints the edited files, so none was regenerated.
