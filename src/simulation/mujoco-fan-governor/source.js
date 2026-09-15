// Approximate landmarks in the 525px engraving, with a reconstructed depth.
export const fanGovernorSource={scale:.014,axisX:274,crossheadY:303,
  fanCenters:[82,466],fanWidth:84,fanHeight:196,rollerOrbit:121,
  rollerRadius:15,rollerHalfWidth:8,shaftRadius:.13};
export const fanGovernorTrack={radius:1.694,rollerRadius:.21,base:-.55,foundation:-1.15,curvature:.6,halfWidth:.30};
export function fanGovernorTrackCells(segments=160){
 if(!Number.isInteger(segments)||segments<8||segments%2)throw new RangeError('Track resolution must be an even integer >= 8');
 const g=fanGovernorTrack,cells=[];
 for(let side=0;side<2;side++)for(let i=0;i<segments/2;i++){
  const start=-Math.PI/2+i*Math.PI/(segments/2),end=start+Math.PI/(segments/2),vertices=[];
  for(const angle of [start,end])for(const r of [g.radius-g.halfWidth,g.radius+g.halfWidth])
   for(const y of [g.foundation,g.base+g.curvature*Math.max(0,-angle)**2])
    vertices.push([r*Math.cos(angle+side*Math.PI),y,-r*Math.sin(angle+side*Math.PI)]);
  cells.push({name:`track_${side}_${i}`,vertices});
 }
 return cells;
}
