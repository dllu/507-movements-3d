import {roundedRackGear} from '../coaxial-gear-geometry.js';
import source from './source.js';
// Default reversing input stroke, radians. Brown's caption has the jaws
// "brought together with great force": the jaws meet at about 1.70 rad of
// input (25 and 28 degrees of jaw swing), so the 1.8 rad command closes them
// against native jaw contact at the torque limit, dwells, and reopens. Both
// pinions stay at least 6 degrees inside their working tooth arcs.
export const segmentClampStroke=1.8;
const inv=r=>{const t=Math.sqrt(Math.max(0,r*r-1));return t-Math.atan(t);};
export function segmentClampProfile({smallTeeth=13,externalTeeth=51,largeTeeth=23,internalTeeth=79,smallPhase=.22655716251849467,largePhase=.2318328724332012,samples=96,cutterSteps=2048}={}){
 const input=[(source.input[0]-source.axis[0])/100,(source.axis[1]-source.input[1])/100],distance=Math.hypot(...input),lineAngle=Math.atan2(input[1],input[0]);
 const externalModule=2*distance/(smallTeeth+externalTeeth),internalModule=2*distance/(internalTeeth-largeTeeth),
  externalPhase=((externalTeeth+smallTeeth)*lineAngle+smallTeeth*Math.PI-smallTeeth*smallPhase-Math.PI)/externalTeeth,
  internalPhase=((internalTeeth-largeTeeth)*lineAngle+largeTeeth*largePhase-Math.PI)/internalTeeth;
 const make=(teeth,module,bore)=>roundedRackGear({teeth,module,boreRadius:bore,depth:.18,addendum:.8,dedendum:1,tipRadius:.12*module,samples,cutterSteps});
 const small=make(smallTeeth,externalModule,.184103133),large=make(largeTeeth,internalModule,.184103133),external=make(externalTeeth,externalModule,.1);
 small.rotateZ(smallPhase);small.translate(0,0,.19);large.rotateZ(largePhase);large.translate(0,0,-.05);
 const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
 const externalOutline=external.userData.outline.map(p=>rotate(p.toArray(),externalPhase));external.dispose();
 const R=internalTeeth*internalModule/2,base=R*Math.cos(Math.PI/9),half=r=>Math.PI/(2*internalTeeth)-.004*internalModule/R-inv(R/base)+inv(r/base);
 const internalOutline=Array.from({length:internalTeeth*samples},(_,i)=>{
  const a=(i/samples-.5)*2*Math.PI/internalTeeth+internalPhase,angle=Math.abs(((i%samples)/samples-.5)*2*Math.PI/internalTeeth);let lo=R-.8*internalModule,hi=R+internalModule;
  for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(half(mid)<angle)lo=mid;else hi=mid;}const r=(lo+hi)/2;return[r*Math.cos(a),r*Math.sin(a)];
 });
 return{input,distance,lineAngle,smallTeeth,largeTeeth,externalTeeth,internalTeeth,externalModule,internalModule,smallPhase,largePhase,externalPhase,internalPhase,samples,cutterSteps,small,large,externalOutline,internalOutline,externalRatio:smallTeeth/externalTeeth,internalRatio:largeTeeth/internalTeeth};
}
