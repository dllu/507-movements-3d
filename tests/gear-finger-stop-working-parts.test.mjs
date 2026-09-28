import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
import {surfacePoints,surfaceTriangles,solidSurface} from './helpers/solid-surface.mjs';

const model=create({id:214}),d=model.root.userData,b=d.blocks,g=d.geometry;
const records=new Map();
function record(mesh){if(!records.has(mesh))records.set(mesh,{points:surfacePoints(mesh.geometry),field:solidSurface(mesh.geometry)});return records.get(mesh);}
function gap(a,c){
  let minimum=Infinity;
  for(const[from,to]of[[a,c],[c,a]]){
    const matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld),field=record(to).field;
    for(const point of record(from).points){const p=point.clone().applyMatrix4(matrix);if(field.box.distanceToPoint(p)>.08)continue;minimum=Math.min(minimum,field.signedDistance(p,.08));}
  }
  return minimum;
}
function pose(u){const s=d.stateAtInputTravel(u);b.driver.userData.rotor.rotation.z=s.driverAngle;b.driven.userData.rotor.rotation.z=s.drivenAngle;b.driverShaft.userData.rotor.rotation.z=s.driverAngle;b.drivenShaft.userData.rotor.rotation.z=s.drivenAngle;model.root.updateMatrixWorld(true);return s;}

test('214 square-toothed gear pair clears through complete forward and reverse travel',()=>{
  let minimum=Infinity,maximum=0;
  for(let i=0;i<=96;i++){
    pose(g.reverseInputLimit+(g.forwardInputLimit-g.reverseInputLimit)*i/96);
    const separation=gap(b.driverAssembly.gearBody,b.drivenAssembly.gearBody);
    assert.ok(Number.isFinite(separation)&&separation>.002&&separation<.08,`${i}: ${separation}`);
    minimum=Math.min(minimum,separation);maximum=Math.max(maximum,separation);
  }
  for(const a of [b.driverAssembly,b.drivenAssembly])assert.equal(a.gearBody.geometry.userData.generatedTeeth.toothProfile,'square-straight-flank-flat-tip-flat-root');
  console.log({id:214,minimumGearGap:minimum,maximumNearestGearGap:maximum});
});

test('214 square teeth bound the counterwheel play on both flanks through a mesh cycle',()=>{
  // Straight flanks are not conjugate: the prescribed ratio leaves play that
  // varies through the mesh. Both flanks must stop the counterwheel within a
  // small angle, so either rotation direction is transmitted.
  const gear=b.driverAssembly.gearBody,mate=b.drivenAssembly.gearBody,step=.002;
  let maximumNear=0,maximumTotal=0;
  for(let i=0;i<=24;i++){
    const u=2*Math.PI/10*i/24;pose(u);const base=b.driven.userData.rotor.rotation.z;
    const play=[];
    for(const sign of[-1,1]){
      let k=1;for(;k<=30;k++){b.driven.userData.rotor.rotation.z=base+sign*k*step;model.root.updateMatrixWorld(true);if(gap(gear,mate)<0)break;}
      assert.ok(k>1&&k<=30,`${i}: side ${sign} play ${k*step}`);play.push(k*step);
    }
    b.driven.userData.rotor.rotation.z=base;model.root.updateMatrixWorld(true);
    maximumNear=Math.max(maximumNear,Math.min(...play));maximumTotal=Math.max(maximumTotal,play[0]+play[1]);
  }
  assert.ok(maximumNear<=.016,`nearer-flank play ${maximumNear}`);
  assert.ok(maximumTotal<=.048,`total play ${maximumTotal}`);
  console.log({id:214,maximumNearerFlankPlay:maximumNear,maximumTotalPlay:maximumTotal});
});

test('214 unbeveled finite fingers clear the gears and retain both actual terminal stops',()=>{
  let minimum=Infinity;
  for(let i=0;i<=64;i++){
    pose(g.reverseInputLimit+(g.forwardInputLimit-g.reverseInputLimit)*i/64);
    const separation=gap(b.driverAssembly.fingerBody,b.drivenAssembly.fingerBody);minimum=Math.min(minimum,separation);
    assert.ok(separation> -1e-6);
    for(const[a,c]of[[b.driverAssembly.fingerBody,b.drivenAssembly.gearBody],[b.drivenAssembly.fingerBody,b.driverAssembly.gearBody]])assert.ok(gap(a,c)>.0159); // p93-fc: fingers run down to 0.016 over the gear faces
  }
  for(const[u,sign,key]of[[g.forwardInputLimit,1,'forwardStopContact'],[g.reverseInputLimit,-1,'reverseStopContact']]){
    pose(u);const point=g[key].contactPoint,p=new THREE.Vector3(point.x,point.y,g.fingerPlaneZ);
    for(const body of[b.driverAssembly.fingerBody,b.drivenAssembly.fingerBody])assert.ok(record(body).field.distance(body.worldToLocal(p.clone()))<1e-6);
    b.driver.userData.rotor.rotation.z+=sign*.002;b.driven.userData.rotor.rotation.z-=sign*.002*10/12;model.root.updateMatrixWorld(true);
    assert.ok(gap(b.driverAssembly.fingerBody,b.drivenAssembly.fingerBody)<-.0001,'actual stop blocks overtravel');
  }
  console.log({id:214,minimumFingerGap:minimum});
});

test('214 finite square arbors and fixed supports retain close passages without overlapping shafts',()=>{
  let minimum=Infinity;
  for(let i=0;i<=16;i++){
    pose(g.reverseInputLimit+(g.forwardInputLimit-g.reverseInputLimit)*i/16);
    for(const[index,key]of[[0,'driver'],[1,'driven']]){
      const assembly=b[`${key}Assembly`],shaft=b[`${key}Shaft`].userData.rotor.children[0],arbor=b.squareArbors[index];
      for(const body of[assembly.gearBody,assembly.fingerBody,assembly.hub]){const separation=gap(arbor,body);assert.ok(Number.isFinite(separation)&&separation>0&&separation<.002);minimum=Math.min(minimum,separation);}
      assert.ok(gap(arbor,shaft)>.0038);
      for(const support of[d.workingSupports[index===0?1:0],b.bearings[index===0?1:0]]){
        const separation=gap(support,shaft);assert.ok(Number.isFinite(separation)&&separation>.0038&&separation<.0041);
      }
    }
  }
  console.log({id:214,minimumKeyFaceGap:minimum});
});

test('214 keeps stable geometry, explicit prescribed dynamics and full visible framing',()=>{
  const before=[];model.root.traverse(o=>before.push([o,o.geometry]));
  for(let i=0;i<=32;i++){model.update(d.timeline.demonstrationPeriod*i/32);model.root.updateMatrixWorld(true);model.root.traverseVisible(o=>{const p=o.geometry?.attributes.position;if(p)for(let j=0;j<p.count;j++)assert.ok(d.cameraFitBounds.containsPoint(new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(o.matrixWorld)));});}
  const after=[];model.root.traverse(o=>{after.push([o,o.geometry]);for(const m of[].concat(o.material??[]))assert.equal(m.fog,false);});assert.deepEqual(after,before);
  assert.equal(d.hideGround,true);assert.equal(d.minimumDisplayCycleSeconds,d.timeline.demonstrationPeriod);assert.match(d.reconstructionNote,/prescribed/);
});
