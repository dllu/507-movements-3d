import {makeWeightedClutchKeyDynamics} from './weighted-clutch-key-dynamics.mjs';
import {makeWeightedClutchNativeJaws} from './weighted-clutch-native-jaws.mjs';
import {weightedClutchJawBounds} from './weighted-clutch-jaw-bound.mjs';

// Continue the existing five-coordinate state and clock without retargeting.
// The previous jaw remains in the dynamics; the opposite native jaw terminates
// this pre-impact stage at its first contact. Shaft/key friction is unchanged.
export function makeWeightedClutchKeyNeutral(model,profile,friction){
 const base=makeWeightedClutchKeyDynamics(model,profile,friction),jaws=makeWeightedClutchNativeJaws(model),
  bound=weightedClutchJawBounds(model),side=profile.side==='left'?'right':'left',u=model.root.userData;
 let nativeQueries=0;
 function opposite(q,t,force=false){
  const phase=base.phase(q,t),relative=q[4]+(side==='left'?-1:1)*u.geometry.mainRatio*phase.input,
   lowerBound=bound.lower(side,relative,q[2]);
  if(!force&&lowerBound>0)return{side,relativeAngle:relative,clutchShift:q[2],lowerBound,exact:false};
  nativeQueries++;return{...jaws.evaluate(side,relative,q[2]),lowerBound,exact:true};
 }
 function advance(before,h){
  const after=base.step(before,h),jaw=opposite(after.q,after.time);
  if(!jaw.exact||jaw.gap>0)return{...after,oppositeJaw:jaw};
  let lo=0,hi=h,end=after,endJaw=jaw;
  for(let i=0;i<36;i++){
   const middle=(lo+hi)/2,test=base.step(before,middle),contact=opposite(test.q,test.time);
   if(contact.exact&&contact.gap<=0){hi=middle;end=test;endJaw=contact;}else lo=middle;
   if(hi-lo<1e-12)break;
  }
  return{...end,oppositeJaw:endJaw,oppositeJawImpact:true,impactBracket:[before.time+lo,before.time+hi]};
 }
 return{...base,opposite,advance,jaws,bound,get nativeQueries(){return nativeQueries;},
  parameters:{...base.parameters,oppositeSide:side,jawBounds:bound.fronts,
   qualification:'Continuous continuation of key-friction withdrawal with all five coordinates free. The earlier jaw, slot, fork, stud and feather remain unilateral contacts. A proven conservative jaw bound skips full opposite-jaw queries only while separated; native triangle intersection locates first contact. No position, angle, velocity or input phase is retargeted.'}};
}
