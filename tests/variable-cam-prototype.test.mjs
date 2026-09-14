import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {Raycaster,Vector3} from 'three';
import {makeVariableCamGeometry} from '../src/simulation/mujoco-variable-cam/geometry.js';
import {variableCamProfile} from '../src/simulation/mujoco-variable-cam/profile.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
test('138 contact review exposes tip interference and engraving discrepancies',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/138-physics-review.json'));
 for(const s of report.sources)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'),s.sha256);
 assert(report.oldTipInterferencePixels>5);assert(report.correctedTipEnvelopeDifferencePixels<.001);
 assert(report.landmarks.some(p=>p.errorPixels>15));
 for(const r of Object.values(report.runs)){assert.equal(r.resets,0);assert(r.penetration<.002);}
 for(const error of Object.values(report.sensitivityPixels))assert(error<.5);
});
test('138 corrected pointed follower has the proper proportions and clears the carrier',()=>{
 const v=makeVariableCamGeometry();try{
  const parts={};v.root.traverse(o=>{if(o.userData.role)parts[o.userData.role]=o;});
  const tip=parts['sharp-point-resting-directly-on-cam-edge'];tip.geometry.computeBoundingBox();const b=tip.geometry.boundingBox;
  assert(Math.abs(b.max.x-.12)<1e-7);assert(Math.abs(b.min.x+.12)<1e-7);
  assert(Math.abs(b.max.y-.24)<1e-7);assert.equal(b.min.y,0);
  assert(tip.position.z+b.min.z>-.04);
  for(const side of ['lower','upper']){
   const sleeve=parts[side+'-vertical-guide-bore-around-follower-rod'];
   const center=sleeve.getWorldPosition(new Vector3());
   for(let i=0;i<16;i++){
    const a=i*Math.PI/8;
    const ray=new Raycaster(new Vector3(center.x+.12*Math.cos(a),center.y-1,center.z+.12*Math.sin(a)),new Vector3(0,1,0),0,2);
    assert.equal(ray.intersectObject(sleeve,false).length,0,'the entire rod section must pass through the guide');
   }
  }
  const {points}=variableCamProfile(128);
  points.forEach((a,i)=>{const b=points[(i+1)%points.length];assert(a[0]*b[1]-a[1]*b[0]>0,'cam must be star-shaped for the collision fan');});
 }finally{disposeObject3D(v.root);}
});
