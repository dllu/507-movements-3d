import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import {createMovementModel} from '../src/simulation/registry.js';
import {inspectWeightedClutchSolid} from '../scripts/lib/weighted-clutch-solid-audit.mjs';
import {nativePlateContours} from '../scripts/lib/weighted-clutch-native-contours.mjs';
import {eccentricStrapClearance} from '../scripts/lib/eccentric-strap-clearance.mjs';
const catalog=JSON.parse(fs.readFileSync(new URL('../src/data/movements.json',import.meta.url)));
const model=createMovementModel(catalog.movements[88]),u=model.root.userData,b=u.blocks,g=u.geometry,d=u.joints.dimensions;
const near=(a,b,t=1e-10)=>assert.ok(Math.abs(a-b)<t,`${a} differs from ${b}`);
const world=o=>o.getWorldPosition(new THREE.Vector3());
after(()=>{const gs=new Set(),ms=new Set();model.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());});
function wallDistance(geometry,origin,direction) {
  const p=geometry.attributes.position,index=geometry.index,ray=new THREE.Ray(new THREE.Vector3(...origin),new THREE.Vector3(...direction));
  const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],hit=new THREE.Vector3();let minimum=Infinity;
  for(let i=0;i<(index?.count??p.count);i+=3) {
    for(let k=0;k<3;k++)vertices[k].fromBufferAttribute(p,index?index.getX(i+k):i+k);
    if(ray.intersectTriangle(...vertices,false,hit))minimum=Math.min(minimum,hit.distanceTo(ray.origin));
  }return minimum;
}

test('089 every casting, bored clamp, sheave section and completed output is a closed finite solid',()=>{
  assert.equal(Object.keys(u.parts).length,43);
  for(const [name,p]of Object.entries(u.parts)){
    const r=inspectWeightedClutchSolid(p.geometry);assert.equal(r.components,1,name);assert.ok(r.volume>0,name);
    assert.equal(r.unmatchedEdges+r.degenerate+r.wrongNormals+r.nonfinite,0,name+': '+JSON.stringify(r));
  }
});

test('089 the five native circular outlines fit the engraving ink under one common projection',()=>{
  const fixture=JSON.parse(fs.readFileSync(new URL('fixtures/eccentric-strap-ink.json',import.meta.url)));
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../public/engravings/mm_089.png',import.meta.url))).digest('hex'),fixture.sha256);
  model.update(0);
  for(const [name,parts]of [['strapOuter',[b.leftStrapHalf,b.rightStrapHalf]],['sheaveFlange',[u.parts['front-retaining-flange']]],
    ['sheaveFace',[u.parts['raised-sheave-face']]],['shaftCollar',[u.parts['shaft-collar']]],['shaft',[u.parts['input-shaft']]]]){
    const contours=parts.flatMap(part=>nativePlateContours(part.geometry).map(r=>r.map(p=>{
      const v=part.localToWorld(new THREE.Vector3(...p,0));return[159+v.x*100,288-v.y*100];
    })));
    for(const p of fixture.circles[name]){
      let distance=Infinity;
      for(const ring of contours)for(let i=0;i<ring.length;i++){
        const a=ring[i],z=ring[(i+1)%ring.length],dx=z[0]-a[0],dy=z[1]-a[1],l2=dx*dx+dy*dy;
        const t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;
        distance=Math.min(distance,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
      }assert.ok(distance<fixture.uncertaintyPixels,name+' differs by '+distance+' pixels');
    }
  }
});

test('089 the offset rod stays rigid and connected through two complete cycles',()=>{
  for(let i=0;i<=720;i++){
    const time=i*g.cyclePeriod/360;model.update(time);const s=u.kinematics;
    near(world(b.rodEndEye).distanceTo(world(b.wristPin)),0);
    near(world(b.sheaveBody).distanceTo(world(b.strap)),0);
    near(world(b.sheaveBody).distanceTo(world(b.rodEndEye)),g.eccentricRodLength);
    near(world(b.rodEndEye).y,g.sliderY);near(world(b.sheaveBody).distanceTo(g.shaftCenter),g.eccentricity);
    if(time>1e-5){const a=u.stateAtTime(time-1e-5),z=u.stateAtTime(time+1e-5);
      near(s.outputVelocity.x,(z.outputPoint.x-a.outputPoint.x)/2e-5,1e-8);
      near(s.strapAngularSpeed,(z.strapAngle-a.strapAngle)/2e-5,1e-8);}
  }
  for(const [radius,target,shift]of [[g.eccentricRodLength+g.eccentricity,g.outputMaximumX,0],
    [g.eccentricRodLength-g.eccentricity,g.outputMinimumX,-Math.PI]]){
    const angle=Math.asin(g.sliderY/radius)+shift,s=u.stateAtTime(angle/g.inputAngularSpeed);
    near(s.outputPoint.x,target);near(s.outputVelocity.x,0);
  }
  near(u.stateAtTime(0).strapAngle,0);
  for(const value of [NaN,Infinity,-Infinity])assert.throws(()=>model.update(value),/Nonfinite/);
  assert.deepEqual(u.stateAtTime(-1),u.stateAtTime(0));
});

test('089 native bolt, wrist and rear shaft bores preserve running clearance',()=>{
  model.update(0);
  const probes=[...u.joints.cheeks.map(part=>[part.geometry,[0,0,(part.geometry.userData.plate.low+part.geometry.userData.plate.high)/2],d.pinRadius,'z']),
    [b.eccentricRod.geometry,[g.rodX,g.rodY,0],d.pinRadius,'z'],[b.rearBearing.geometry,[0,0,-.57],g.shaftRadius,'z']];
  for(const p of b.strapLugs){p.geometry.computeBoundingBox();const box=p.geometry.boundingBox;
    const y=(288-(p.name.includes('upper')?u.source.clamp.upperBoltY:u.source.clamp.lowerBoltY))/100;
    probes.push([p.geometry,[(box.min.x+box.max.x)/2,y,0],.055,'x']);}
  for(const part of [b.innerCouplingPlate,b.outerCouplingPlate])for(const sign of [-1,1])probes.push([part.geometry,[0,d.flangeY+sign*d.flangeBoltY,0],d.flangeBoltRadius,'x']);
  for(const [geometry,origin,radius,axis]of probes)for(let i=0;i<48;i++){
    const a=i*2*Math.PI/48,dir=axis==='x'?[0,Math.cos(a),Math.sin(a)]:[Math.cos(a),Math.sin(a),0];
    const gap=wallDistance(geometry,origin,dir)-radius;assert.ok(gap>.0019&&gap<.0021,'invalid native bore clearance '+gap);
  }
  // The shaft and sheave are rigidly fast together: compare the actual
  // matched polygon faces, including the off-center hole translation.
  for(let i=0;i<48;i++){
    // Avoid rays exactly on a triangulation edge; topology is checked separately.
    const a=(i+.371)*2*Math.PI/48,dir=[Math.cos(a),Math.sin(a),0];
    near(wallDistance(b.sheaveBody.geometry,[-g.eccentricity,0,0],dir),wallDistance(b.inputShaft.geometry,[0,0,0],dir),2e-7);
  }
});

test('089 continuous native rod bounds and bearing envelopes keep every moving family clear',t=>{
  const result=eccentricStrapClearance(model);
  assert.ok(result.passed,JSON.stringify(result));assert.ok(result.minimumClearance>.0014);
  t.diagnostic(JSON.stringify({rodHeightBound:result.rodHeightBound,minimumClearance:result.minimumClearance}));
});

test('089 a four-second repeat has no angle reset and the display bounds contain moving vertices',()=>{
  near(u.animationTiming.displayCycleDuration,4);near(u.animationTiming.playbackTimeScale,1);assert.equal(u.hideGround,true);
  // Profiles sample 96 phases; a swinging strap corner may pass a sagitta beyond them.
  const p=new THREE.Vector3(),box=new THREE.Box3(new THREE.Vector3(...u.sampledMotionBounds.min),new THREE.Vector3(...u.sampledMotionBounds.max)).expandByScalar(1e-4);
  for(let i=0;i<=48;i++){
    const time=i/12;model.update(time);
    for(const part of Object.values(u.parts)){
      let attached=part;while(attached.parent)attached=attached.parent;if(attached!==model.root)continue;
      const a=part.geometry.attributes.position;
      for(let k=0;k<a.count;k++){p.fromBufferAttribute(a,k).applyMatrix4(part.matrixWorld);assert.ok(box.containsPoint(p),part.name+' leaves display bounds');}}
    const a=u.stateAtTime(time),z=u.stateAtTime(time+4);
    near(z.driverAngle-a.driverAngle,-2*Math.PI);near(a.outputPoint.distanceTo(z.outputPoint),0);near(a.strapAngle,z.strapAngle);
  }
});
