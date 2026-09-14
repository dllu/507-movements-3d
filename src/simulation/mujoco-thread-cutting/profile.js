import source from './source.js';
export function makeThreadCuttingProfile({segments=128,leadTeeth=52,workTeeth=76,clearance=.002}={}) {
 // Other ratios need a new cutter and clearance review of the hidden guide.
 if(leadTeeth!==52||workTeeth!==76)throw new RangeError('Only the reconstructed 52:76 gear pair is supported');
 const e=source.edges,axis=[(source.axes[0]+source.axes[1])/2,(e.carriageTop+e.carriageBottom)/2];
 const x=p=>(p-axis[0])/100,y=p=>(axis[1]-p)/100,leadX=x(source.axes[0]),workX=x(source.axes[1]);
 // Fit both visible rim extents, keeping the measured projected shaft spacing.
 // A depth offset supplies the remaining center distance required by the gears.
 const factors=[27,39],module=source.outerRadii.reduce((s,r,i)=>s+r/100*factors[i],0)/factors.reduce((s,n)=>s+n*n,0);
 const distance=module*(leadTeeth+workTeeth)/2,dx=workX-leadX,dz=Math.sqrt(distance*distance-dx*dx),leadZ=dz/2,workZ=-dz/2;
 const gearAngle=Math.atan2(dz,dx),ratio=-leadTeeth/workTeeth;
 const pitch=source.threads.lead[2]/100,lead=-pitch/(2*Math.PI),width=source.threads.lead[3]/100;
 const coreRadius=(source.leadCoreEdges[1]-source.leadCoreEdges[0])/200,crestRadius=(e.leadCrestRight-e.leadCrestLeft)/200;
 const phase=y(source.threads.lead[0]+source.threads.lead[1]*(source.axes[0]-210)+source.threads.lead[3]/2)+lead*Math.PI/2;
 const external={inner:coreRadius,outer:crestRadius,low:y(source.threadRange[1]),high:y(source.threadRange[0]),width,lead,phase};
 const internal={inner:coreRadius+clearance,outer:crestRadius+clearance,low:y(e.carriageBottom),high:y(e.carriageTop),width:pitch-width-2*clearance,lead,phase:phase+pitch/2};
 const armY=y((e.armTop+e.armBottom)/2),armHeight=(e.armBottom-e.armTop)/100;
 const workRadius=(e.workBlankRight-e.workBlankLeft)/200,workCoreRadius=source.workCoreRadius/100;
 const workLead=lead/ratio,workPitch=2*Math.PI*workLead,workWidth=workPitch*width/pitch,grooveWidth=workPitch-workWidth;
 const contactAngle=gearAngle+Math.PI,groovePhase=armY-workLead*contactAngle;
 const workThread={inner:workCoreRadius,outer:workRadius,low:y(source.cutRange[1]),high:y(source.cutRange[0]),width:workWidth,lead:workLead,phase:groovePhase-workPitch/2};
 const stock={...workThread,width:grooveWidth,phase:groovePhase};
 const upper=y(e.topBottom)-internal.high-.04,lower=y(e.gearTop)-internal.low+.04;
 return {source,axis,x,y,segments,clearance,leadTeeth,workTeeth,module,distance,dx,dz,leadX,workX,leadZ,workZ,gearAngle,ratio,
  pitch,lead,width,coreRadius,crestRadius,external,internal,armY,armHeight,workRadius,workCoreRadius,workLead,workPitch,workWidth,grooveWidth,contactAngle,workThread,stock,upper,lower,
  shaftRadii:[(e.leadShaftRight-e.leadShaftLeft)/200,(e.workShaftRight-e.workShaftLeft)/200],
  gearY:y((e.gearTop+e.gearBottom)/2),gearDepth:(e.gearBottom-e.gearTop)/100,
  beamZ:x=>leadZ-(x-leadX)*dz/dx};
}
