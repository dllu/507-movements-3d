import source from './source.js';

export function makeScrewProfile({segments=256,contactSegments=64,clearance=.003}={}) {
  const world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100],pitch=source.thread[2]/100,lead=-pitch/(2*Math.PI);
  const coreRadius=(source.coreEdges[1]-source.coreEdges[0])/200,crestRadius=(source.crestEdges[1]-source.crestEdges[0])/200,width=source.thread[3]/100;
  const topAtAxis=source.thread[0]+source.thread[1]*(source.axis[0]-227),phase=(source.axis[1]-topAtAxis)/100-lead*(-Math.PI/2)-width/2;
  const nutLow=world([0,source.nut.bottom])[1],nutHigh=world([0,source.nut.top])[1],nutBase=(nutLow+nutHigh)/2,nutHeight=nutHigh-nutLow;
  const low=nutLow-.03,high=0;
  const external={inner:coreRadius,outer:crestRadius,low,high,width,lead,phase};
  const internal={inner:coreRadius+clearance,outer:crestRadius+clearance,low:-nutHeight/2,high:nutHeight/2,
    width:pitch-width-2*clearance,lead,phase:phase+pitch/2-nutBase};
  return {world,segments,contactSegments,clearance,pitch,lead,phase,coreRadius,crestRadius,nutBase,nutHeight,external,internal,
    head:{radius:source.head.radius/100,phase:source.head.phase,low:0,high:world([0,source.head.top])[1],bottomBevel:0,topBevel:.1,bore:0},
    nut:{radius:source.nut.radius/100,phase:source.nut.phase,low:-nutHeight/2,high:nutHeight/2,bottomBevel:.1,topBevel:.1,bore:internal.outer},
    tipLow:world(source.tip)[1],turns:5};
}
