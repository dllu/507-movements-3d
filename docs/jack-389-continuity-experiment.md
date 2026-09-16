# Parked 389 contact pass

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
