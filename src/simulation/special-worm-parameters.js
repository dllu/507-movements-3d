// Reconstruction dimensions, shared by the offline cutters and the visible solids.
export const specialWormParameters = {
  202: { teeth: 60, pitchRadius: 2.1, outerRadius: 2.175, depth: .48,
    wormRadius: .4, wormPitch: 2*Math.PI*2.1/60, wormLength: 2*2.1*Math.sin(.6),
    distance: 2.5, wheelPhase: -2*Math.PI/60*7/8, offset: 0, globoidal: true },
  264100: { teeth: 100, pitchRadius: 1.7, outerRadius: 1.735, depth: .3,
    wormRadius: .5, wormPitch: 2*Math.PI*1.7/100, wormLength: 1.1,
    distance: 1.7+Math.sqrt(.5**2-.19**2), wheelPhase: 0, offset: .19 },
  264101: { teeth: 101, pitchRadius: 1.7, outerRadius: 1.735, depth: .3,
    wormRadius: .5, wormPitch: 2*Math.PI*1.7/100, wormLength: 1.1,
    distance: 1.7+Math.sqrt(.5**2-.19**2), wheelPhase: 0, offset: -.19 },
};
