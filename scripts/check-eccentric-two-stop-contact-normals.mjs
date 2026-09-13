import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement} from '../src/simulation/authored-intermittent.js';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-contact-normals',input='artifacts/review/088-production-contact-audit.json',parent=readStudyReport(input),
  sources=freezeStudySources([...parent.sources.map(s=>s.file),input,'scripts/check-eccentric-two-stop-contact-normals.mjs'],prefix),
  model=createAuthoredIntermittentMovement({id:88}),u=model.root.userData,
  camParts=['camBody','offsetFace'].map(name=>({name,mesh:u.blocks[name],triangles:surfaceTriangles(u.blocks[name].geometry)})),rows=[];
verifyStudySources(parent.sources);
for(const r of parent.rows){
  model.update(r.time);model.root.updateMatrixWorld(true);const apex=new THREE.Vector3(...r.apex),nearest=[];
  let distance=Infinity;
  for(const {name,mesh,triangles} of camParts){
    const local=apex.clone().applyMatrix4(mesh.matrixWorld.clone().invert());
    for(const [index,t] of triangles.entries()){
      const point=t.closestPointToPoint(local,new THREE.Vector3()),gap=point.distanceTo(local);
      if(gap>distance+1e-10)continue;
      if(gap<distance-1e-10){distance=gap;nearest.length=0;}
      const normal=t.getNormal(new THREE.Vector3()).transformDirection(mesh.matrixWorld),
        worldPoint=point.applyMatrix4(mesh.matrixWorld),radius=worldPoint.clone().sub(u.geometry.wheelCenter),
        torque=radius.clone().cross(normal).z;
      nearest.push({name,index,gap,point:worldPoint.toArray(),normal:normal.toArray(),outputAxisTorquePerUnitNormalForce:torque});
    }
  }
  const actual=nearest.filter(n=>n.gap<=distance+1e-10),claimed=u.kinematics.faceNormal;
  rows.push({time:r.time,activeStop:r.activeStop,distance,claimedFaceNormal:[claimed.x,claimed.y,0],nearest:actual});
}
const all=rows.flatMap(r=>r.nearest),summary={states:rows.length,nearestTriangles:all.length,
  maximumInPlaneNormal:Math.max(...all.map(n=>Math.hypot(n.normal[0],n.normal[1]))),
  maximumOutputAxisTorquePerUnitNormalForce:Math.max(...all.map(n=>Math.abs(n.outputAxisTorquePerUnitNormalForce))),
  maximumDistance:Math.max(...rows.map(r=>r.distance)),
  minimumAxialNormalMagnitude:Math.min(...all.map(n=>Math.abs(n.normal[2])))};
verifyStudySources(sources);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:88,productionChanged:false,mechanicsPassed:false,sources,summary,rows,
  qualification:'Nearest native cam triangles at the independently reconstructed cone apex are measured, including tied nearest faces. The observed normal-force direction is compared with the model\'s claimed radial-offset face. An axial normal has zero moment about the output axis. Unspecified axial preload and tangential friction are not treated as the depicted positive stop drive. This is a defect diagnosis, not a passing mechanism qualification.'},null,2)+'\n',{flag:'wx'});
console.log(summary);
assert(summary.states===258&&summary.maximumDistance<1e-6&&summary.minimumAxialNormalMagnitude>.999999&&summary.maximumOutputAxisTorquePerUnitNormalForce<1e-10);
