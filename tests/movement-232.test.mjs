import assert from 'node:assert/strict';
import test from 'node:test';
import * as T from 'three';
import {createAuthoredIntermittentMovement as make} from '../src/simulation/authored-intermittent.js';
const model=make({id:232,sourceUrl:'https://507movements.com/mm_232.html'}),d=model.root.userData,g=d.geometry,b=d.blocks,period=g.cyclePeriod,pitch=g.toothPitch;
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('232 preserves the source parallelogram and explicitly infers A as a rocking carrier',()=>{
 assert.equal(d.sourceAnimation.available,false);assert.match(d.sourceAnimation.reason,/no canvas, inline animation program or ae.add_model registration/);
 assert.equal(d.sourceReference.plate232.frameLabel,'A');assert.equal(d.sourceReference.plate232.inputLabel,'B');assert.equal(d.sourceReference.plate232.pawlLabel,'C');
 assert.equal(b.framePlate.parent,b.carrier);assert.equal(b.carrier.parent,model.root);assert.equal(b.pawl.parent,model.root);assert.equal(b.inputLever.parent,model.root);
 assert.equal(d.carrierReconstruction.inferred,true);assert.equal(d.carrierReconstruction.passiveValidated,false);assert.match(d.reconstructionNote,/trial spring-driven MuJoCo did not validate passive selection/);
 assert.equal(g.toothCount,20);near(g.groundLength,2.08);near(g.shortLinkLength,.6);near(g.wheelRootRadius,1.61);near(g.wheelOuterRadius,1.90);
});

test('232 lift, backward travel, drop, capture and draw are separate continuous stages',()=>{
 const samples=[[.08,'lift'],[.25,'back'],[.48,'drop'],[.59,'capture'],[.77,'draw'],[.96,'reseat']];
 for(const[c,name]of samples)assert.equal(d.stateAtCycleCoordinate(c).stage,name);
 const source=d.stateAtCycleCoordinate(0),top=d.stateAtCycleCoordinate(.4),ready=d.stateAtCycleCoordinate(.56),end=d.stateAtCycleCoordinate(.92);
 near(source.carrierAngle,0);near(source.pawlAngle,0);near(top.hookPolarAngle-source.hookPolarAngle,pitch);near(top.hookRadius,g.wheelOuterRadius+g.workingTipRadius+.04);
 near(ready.hookRadius,source.hookRadius);near(ready.wheelAngle,0);near(end.wheelAngle,-pitch);near(end.inputAngle,0);near(end.carrierAngle,0);
 assert.ok(top.inputAngle>ready.inputAngle,'B starts lowering during drop');assert.ok(d.stateAtCycleCoordinate(.08).carrierAngle<0,'A rocks to provide a different lift path');
});

test('232 exact inverse geometry closes both equal-link sides over repeated cycles',()=>{
 let previous=Infinity;
 for(let i=0;i<=8192;i++){const s=d.stateAtCycleCoordinate(3*i/8192);assert.ok(s.wheelAngle<=previous+1e-12);previous=s.wheelAngle;
  near(s.pawlAngle,s.inputAngle);near(s.couplerLengthError,0);near(s.fourBarClosureError,0);near(s.inputShortLinkLengthError,0);near(s.outputShortLinkLengthError,0);
  const reconstructed=g.workingTipLocal.clone().rotateAround({x:0,y:0},s.pawlAngle).add(s.upperGroundPivot);assert.ok(reconstructed.distanceTo(s.hookPoint)<2e-14);
  if(s.wheelDwelling)near(s.wheelAngularSpeed,0);else assert.ok(s.wheelAngularSpeed<=1e-12);
 }
});

test('232 wheel law comes from the actual finite rounded tip against the radial tooth flank',()=>{
 for(let cycle=0;cycle<3;cycle++)for(let i=0;i<=64;i++){const s=d.stateAtCycleCoordinate(cycle+.62+.3*i/64),q=s.contact.wheelPoint,tip=s.hookPoint,local=q.clone().rotateAround({x:0,y:0},-s.wheelAngle),flank=g.gapMountPhase-g.gapHalfAngle+(cycle+1)*pitch;
  near(local.x,g.drawFaceRadius*Math.cos(flank));near(local.y,g.drawFaceRadius*Math.sin(flank));near(tip.distanceTo(q),g.workingTipRadius);
  near(s.contact.outputMomentArm,-g.drawFaceRadius);assert.equal(s.contact.forceSolved,false);
 }
});

test('232 analytical position, speed and acceleration agree across the finite branch',()=>{
 const triples=[['carrierAngle','carrierAngularSpeed','carrierAngularAcceleration'],['inputAngle','inputAngularSpeed','inputAngularAcceleration'],['wheelAngle','wheelAngularSpeed','wheelAngularAcceleration']];
 for(let i=1;i<512;i++){const t=period*i/512,h=1e-5,s=d.stateAtTime(t),a=d.stateAtTime(t-h),z=d.stateAtTime(t+h);for(const[p,v,acc]of triples){near((z[p]-a[p])/(2*h),s[v],2e-7);near((z[v]-a[v])/(2*h),s[acc],2e-5);}}
 for(const c of[.16,.4,.56,.62,.92,1]){const a=d.stateAtCycleCoordinate(c-1e-8),z=d.stateAtCycleCoordinate(c+1e-8);for(const[p,v,acc]of triples){near(a[p],z[p],1e-8);near(a[v],z[v],1e-7);near(a[acc],z[acc],3e-4);}}
});

test('232 builds no retaining click (Brown draws none); the wheel dwells by friction between draws',()=>{
 assert.equal(b.retainingClick,undefined);let click=0;model.root.traverse(o=>{if(/retaining-click/.test(o.userData.role??''))click++;});assert.equal(click,0);
 for(const c of[0,.08,.25,.48,.59,.96]){const s=d.stateAtCycleCoordinate(c);assert.equal(s.wheelDwelling,true);near(s.wheelAngularSpeed,0);}
 assert.equal(d.stateAtCycleCoordinate(.77).driving,true);assert.match(d.reconstructionNote,/Brown draws no click/);
});

test('232 rendered rotors, carrier, rods, pins and contact fields follow the public state',()=>{
 for(let i=0;i<=512;i++){const t=period*i/512,s=d.stateAtTime(t);model.update(t);near(b.carrier.rotation.z,s.carrierAngle);near(b.pawl.rotation.z,s.pawlAngle);near(b.inputLever.rotation.z,s.inputAngle);near(b.wheel.userData.rotor.rotation.z,s.wheelAngle);near(b.coupler.rotation.z,s.couplerAngle);
  assert.ok(new T.Vector2(b.pawl.position.x,b.pawl.position.y).distanceTo(s.upperGroundPivot)<1e-14);assert.ok(new T.Vector2(b.pawlCouplerPin.position.x,b.pawlCouplerPin.position.y).distanceTo(s.pawlCouplerPivot)<1e-14);
  assert.equal(b.contactMarker.visible,!!s.contact);assert.equal(d.contacts.drawingPawlToothFlank?.forceSolved??false,false);near(b.wheel.userData.angularSpeed,s.wheelAngularSpeed);
 }
});

test('232 marked output stays continuous and closes after twenty six-second cycles',()=>{
 near(period,6);near(d.stateAtTime(period).wheelAngle,-pitch);near(d.stateAtTime(20*period).wheelAngle,-2*Math.PI);near(d.stateAtTime(period-1e-7).wheelAngle,d.stateAtTime(period+1e-7).wheelAngle,1e-9);
 model.update(0);const index=b.wheel.userData.index;index.geometry.computeBoundingBox();const box=index.geometry.boundingBox.clone().translate(index.position);assert.ok(Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.y),Math.abs(box.max.y)))<g.wheelRootRadius);near(box.min.z,g.axialLayers.wheel.depth/2,1e-8);
});
