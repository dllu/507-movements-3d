# 389 continuous pawl candidate — outside production

This experiment is preserved on `codex/389-continuous-pawl`, rebased onto main
4142086. It supersedes the initial diagnostic on `codex/389-finite-pawl-wip`;
the original remote branch remains unchanged.

## New bounded result

A configuration-space scan explains the old teleport: after one tooth pitch,
the seated and retracted holding-pawl poses belong to disconnected collision-free
intervals. With .06 rack overtravel the forbidden angular gap remains about .0039
radian. At .07 it is still about .0011; by .08 it closes. Independently projecting
each frame to the first clear pose jumps between these intervals.

The candidate now uses .10 overtravel and .04 return undershoot. It stays on the
upper clear branch until .08 extra lift, then eases the pawl down before the
rack settles. The resulting tooth pitch is .2124706003, versus .2324706003 in the
previous candidate. This is a prescribed explanatory trajectory, not passive
contact dynamics.

Three experimental tests pass: 257 rendered pawl/rack poses, 65 hardware
clearance poses, and full-cycle pawl travel bounded below 4.3 world units/second
at both 32,768 and 65,536 samples. The largest step at 32,768 samples is .00127965,
in the deliberate unloaded reset, rather than the previous .014 tooth-corner
jump. These samples support continuity; they do not prove all unsampled contacts.

## Still required before integration

- Review the reduced pitch and fixed tooth count against the engraving. The new
  operating law changes source proportions; a larger eccentric or different pawl
  nose may preserve them better.
- Review timing, contact annotations, complete rendered motion and loop reset.
- Update and rerun four legacy assertions that still assume zero overtravel,
  zero settling time, or the old reset midpoint. They currently fail and have
  deliberately not been weakened merely to publish the candidate.
- Keep production 389 unchanged until these questions are settled.


This branch already applies the candidate module, helper and legacy test changes. The two finite checks are in `tests/jack-389-experimental-solids.test.mjs`. Rebase onto current main before resuming; this candidate is deliberately not part of the published production branch.

The proposed finite geometry passed both a 257-pose actual pawl/rack triangle-surface check and 65-pose disk/strap/shaft/support/rack clearance check. Browser /dev/shm/lifting-389-{default,front,advanced}.png predates the overtravel changes. Default max NDC .9075; no browser errors.

BLOCKER: finite-clearance projection changes feasible branches at a tooth corner. It can avoid interpenetration while teleporting ~.014 world units at transfer. Original mechanism had zero follower overtravel/undershoot, so the parked patch adds .06 of each, a slightly inset nose, an operating settling phase, a parked input for unloaded reset, and staged unloaded clearance lift/return. These last motion changes are NOT qualified and must not be described as finished or physical simulation.

The minimal-clear pawl angle can switch from above-ramp to below-underside once rack travel crosses a tooth pitch; selecting the nearest clear angle independently per frame does not ensure a continuous configuration path. A continuous finite pawl/rack trajectory with sufficient overtravel (or contact dynamics/baked motion) is needed. The source has no canvas animation. Possible bounded next step: establish a continuous prescribed tip path through a complete tooth cycle first, then attach the finite pawl and derive compatible eccentric/rack geometry rather than repeatedly projecting a point-law pose.

Runtime benchmark before latest changes: about .05 ms/model.update averaged over 2000 evenly spaced poses in Node. Performance was not the blocker.

Diagnostic used:
  const d=model.root.userData; let prev=d.stateAtTime(0),max=0,event;
  for(let i=1;i<=8192;i++) {
    const t=d.timeline.cycleDuration*i/8192,s=d.stateAtTime(t);
    const jump=Math.max(s.driveNose.distanceTo(prev.driveNose),s.holdingTip.distanceTo(prev.holdingTip));
    if(jump>max){max=jump;event=t;} prev=s;
  }
  console.log({max,event});

Latest known jump was ~.014 around t=2.753 s as the holding pawl switched branches. The parked patch includes tests modified only for machine epsilon; legacy expected stroke/pitch assertions still need revision if the new law is retained. The production HEAD and original 389 test have been restored for the current batch.
