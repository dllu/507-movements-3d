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

// The reversing drive: the carriage descends from its upper stop to its lower
// stop in the first half period (the tool cutting) and returns in the second,
// with smooth reversals. b = 0 is the top reversal.
export function makeThreadCuttingStroke(f,period) {
 const half=period/2,d=period*.025,stroke=f.upper-f.lower,speed=stroke/(half-d),phase=f.upper/speed+d/2;
 const end=t=>{const a=t/d;return {distance:speed*d*(a*a*a-a*a*a*a/2),speed:speed*(3*a*a-2*a*a*a)};};
 const cycle=time=>((time+phase)%period+period)%period;
 const input=time=>{const b=cycle(time),t=Math.min(b,period-b);let s,v;
  if(t<d){const e=end(t);s=e.distance;v=e.speed;}else if(t>half-d){const e=end(half-t);s=stroke-e.distance;v=e.speed;}else{s=speed*(t-d/2);v=speed;}
  return {angle:(f.upper-s)/(-f.lead),velocity:(b>half?v:-v)/(-f.lead),carriage:f.upper-s};};
 // The work angle the tool has reached on the current cutting descent. On the
 // return the tool runs back up its own finished groove; at the top reversal
 // the finished screw is exchanged for a fresh blank and the cut restarts.
 const bottomWorkAngle=f.ratio*f.lower/(-f.lead);
 const cutWorkAngle=(time,workAngle)=>cycle(time)<half?workAngle:Math.max(workAngle,bottomWorkAngle);
 return {period,phase,input,cycle,descending:time=>cycle(time)<half,bottomWorkAngle,cutWorkAngle};
}
