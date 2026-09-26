import source from './source.js';

export function makeScrewPressProfile({segments=192,clearance=.001,turns=1}={}) {
  const e=source.edges,axis=[(e.crestLeft+e.crestRight)/2,(e.nutTop+e.nutBottom)/2];
  const x=v=>(v-axis[0])/100,y=v=>(axis[1]-v)/100,world=p=>[x(p[0]),y(p[1])];
  const pitch=source.thread[2]/100,lead=pitch/(2*Math.PI),width=source.thread[3]/100;
  const coreRadius=(source.coreEdges[1]-source.coreEdges[0])/200,crestRadius=(e.crestRight-e.crestLeft)/200;
  const phase=y(source.thread[0]+source.thread[1]*(axis[0]-226))+lead*Math.PI/2-width/2;
  const external={inner:coreRadius,outer:crestRadius,low:y(source.threadRange[1]),high:y(e.hubBottom),width,lead,phase};
  const internal={inner:coreRadius+clearance,outer:crestRadius+clearance,low:y(e.nutBottom),high:y(e.nutTop),width:pitch-width-2*clearance,lead,phase:phase+pitch/2};
  const barY=y(source.bar[0]+source.bar[2]/2),barRadius=source.bar[2]/200;
  const ramRadius=(e.ramRight-e.ramLeft)/200,ramBottom=y(source.ramBottom),ramTop=y(e.ramTop),capBottom=ramTop-.035;
  const bearing={neck:.09,radius:.17,top:capBottom-.003,bottom:capBottom-.055,floor:capBottom-.058};
  // The blank is wider than the ram face (a stamping blank, not a slug the
  // ram covers), so it stays in sight under the ram when struck.
  const blankRadius=.32,workTop=ramBottom-turns*pitch,workBottom=workTop-.06,anvilBottom=workBottom-.10,baseBottom=anvilBottom-.22;
  return {axis,x,y,world,pitch,lead,width,phase,segments,clearance,turns,coreRadius,crestRadius,external,internal,
    barY,barRadius,ramRadius,ramBottom,ramTop,capBottom,bearing,blankRadius,workTop,workBottom,anvilBottom,baseBottom,
    frameDepth:.24,nutRadius:(e.nutRight-e.nutLeft)/200,flangeRadius:(e.flangeRight-e.flangeLeft)/200,
    hubHalf:(e.hubRight-e.hubLeft)/200,hubDepth:.24,guideDepth:.33};
}
