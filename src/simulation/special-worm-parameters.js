// Reconstruction dimensions, shared by the offline cutters and the visible solids.
export const specialWormParameters = {
  // 202: a ring count of Brown's wheel gives about 31 teeth per half turn,
  // so 60 deep sawteeth. Their 60-degree V (30-degree flanks) is cut by a
  // matching sharp-V worm thread: a pointed V is 0.0952 high each side of the
  // pitch line; the worm tip and the wheel tip are just truncated.
  202: { teeth: 60, pitchRadius: 2.1, outerRadius: 2.186, depth: .48,
    // A Hindley thread generated past the ends is cut square at Brown's
    // half-length 2.1 sin(0.6), as his flat worm ends show.
    wormRadius: .4, wormPitch: 2*Math.PI*2.1/60, wormLength: 2*2.1*Math.sin(.6), generatedEnvelopment: .68,
    distance: 2.5, wheelPhase: -2*Math.PI/60*7/8, offset: 0, globoidal: true,
    pressureAngle: Math.PI/6, addendum: .085, dedendum: .092, hindley: true },
  264100: { teeth: 100, pitchRadius: 1.7, outerRadius: 1.735, depth: .3,
    wormRadius: .5, wormPitch: 2*Math.PI*1.7/100, wormLength: 1.1,
    distance: 1.7+Math.sqrt(.5**2-.265**2), wheelPhase: 0, offset: .265, clearance: .0035 },
  264101: { teeth: 101, pitchRadius: 1.7, outerRadius: 1.735, depth: .3,
    wormRadius: .5, wormPitch: 2*Math.PI*1.7/100, wormLength: 1.1,
    distance: 1.7+Math.sqrt(.5**2-.265**2), wheelPhase: 0, offset: -.265, clearance: .0035 },
};
