import test from 'node:test';
import assert from 'node:assert/strict';
import {ReturnBandRoute} from '../src/simulation/mujoco-spring-return-treadle/band-route.js';
import {createAuthoredCrankMovement} from '../src/simulation/authored-cranks.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('160 generalized wrap agrees with the legacy vertical-end route',()=>{
 const v=createAuthoredCrankMovement({id:160});try{for(let i=0;i<=64;i++){
  const s=v.root.userData.stateAtTime(i/16),r=new ReturnBandRoute(s.springEyePoint.toArray(),s.treadleEyePoint.toArray());
  assert.ok(Math.abs(r.length-s.bandLength)<1e-12);
  for(let j=0;j<=128;j++){const a=r.getPoint(j/128),b=s.bandCurve.getPoint(j/128);assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-12);}
 }}finally{disposeObject3D(v.root);}
});
test('160 both-endpoint length gradients agree with virtual work and preserve tangencies',()=>{
 const h=1e-6;
 for(let i=0;i<=128;i++){
  const t=i/128,upper=[.774+.08*Math.sin(2*Math.PI*t),2.664-.8*t],lower=[.738+.04*t,-2.322-.8*t],r=new ReturnBandRoute(upper,lower);
  for(let endpoint=0;endpoint<2;endpoint++)for(let axis=0;axis<2;axis++){
   const a=[upper.slice(),lower.slice()],b=[upper.slice(),lower.slice()];a[endpoint][axis]+=h;b[endpoint][axis]-=h;
   const derivative=(new ReturnBandRoute(...a).length-new ReturnBandRoute(...b).length)/(2*h),gradient=(endpoint?r.lowerGradient:r.upperGradient).toArray()[axis];assert.ok(Math.abs(derivative-gradient)<2e-9);
  }
  for(const s of [r.incoming,r.incoming+r.wrapLength])assert.ok(r.getTangent((s-1e-8)/r.length).distanceTo(r.getTangent((s+1e-8)/r.length))<1e-7);
  assert.ok(Math.abs(r.sweep+2*Math.PI)<.2);
 }
});
