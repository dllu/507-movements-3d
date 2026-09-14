import source from './source.js';

export function makeHalfNutProfile({segments=32,clearance=.001,selectorAngle=.10,travel=.20,tipRelief=.008}={}) {
 const e=source.edges,axis=[(e.leftFrameLeft+e.rightFrameRight)/2,source.axes.rodY];
 const x=p=>(p-axis[0])/100,y=p=>(axis[1]-p)/100;
 const spacing=(source.axes.rodY-source.axes.rollerY)/100;
 const shaftRadius=(e.coreBottom-e.coreTop)/200;
 const crestRadius=(e.leftThreadBottom-e.leftThreadTop+e.rightThreadBottom-e.rightThreadTop)/400;
 const pitch=(source.threads.left[1]+source.threads.right[1])/200,width=.4*pitch;
 if(!Number.isInteger(segments)||segments<16||![clearance,selectorAngle,travel].every(v=>Number.isFinite(v)&&v>0)||clearance>=pitch/8||selectorAngle>.25||travel>.23||!Number.isFinite(tipRelief)||tipRelief<0||2*tipRelief>=pitch-width-2*clearance)throw new RangeError('Invalid half-nut geometry options');
 // The plain neck fixes the shaft diameter, not the hidden thread roots.
 // Infer a half-pitch radial depth for the fine square thread.
 const coreRadius=crestRadius-pitch/2;
 const external=['left','right'].map((name,i)=>{
  const lead=(i?-1:1)*pitch/(2*Math.PI),phase=x(source.threads[name][0])-lead*Math.PI/2;
  return {inner:coreRadius,outer:crestRadius,lead,phase,width,
   low:x(i?e.rightThreadStart:e.leftFrameRight),high:x(i?e.rightFrameLeft:e.leftThreadEnd)};
 });
 const nuts=['left','right'].map((name,i)=>{
  const low=x(e[name+'NutLeft']),high=x(e[name+'NutRight']);
  return {name,preAngle:i?-selectorAngle:selectorAngle,side:i?-1:1,low,high,
   bottom:y(e[name+'NutBottom']),top:y(e[name+'NutTop']),
   thread:{...external[i],low,high,inner:coreRadius+clearance,outer:crestRadius+clearance,phase:external[i].phase+pitch/2,width:pitch-width-2*clearance,tipRelief}};
 });
 return {source,axis,x,y,spacing,segments,clearance,selectorAngle,travel,shaftRadius,coreRadius,crestRadius,pitch,width,external,nuts,
  rodRadius:(e.rodBottom-e.rodTop)/200,leverX:x((e.leverLeft+e.leverRight)/2),leverRadius:(e.leverRight-e.leverLeft)/200,
  halfNutDepth:source.halfNutDepth/100,frameHalfDepth:source.frameHalfDepth/100};
}
