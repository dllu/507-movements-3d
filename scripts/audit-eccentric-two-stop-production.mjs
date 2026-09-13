import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAuthoredIntermittentMovement} from '../src/simulation/authored-intermittent.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix='artifacts/review/088-production-contact-audit',baselineFile='artifacts/review/086-integrated-verified-source-hashes.json',
  baseline=readStudyReport(baselineFile),sources=freezeStudySources(['scripts/audit-eccentric-two-stop-production.mjs',
    'src/simulation/authored-intermittent.js','tests/helpers/solid-surface.mjs','scripts/lib/study-report-io.mjs',
    'public/engravings/mm_088.png',baselineFile],prefix),model=createAuthoredIntermittentMovement({id:88}),
  u=model.root.userData,p=u.geometry,camParts=['camBody','offsetFace'].map(name=>({name,mesh:u.blocks[name],surface:solidSurface(u.blocks[name].geometry)})),rows=[];
for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
for(let turn=0;turn<2;turn++)for(let i=0;i<=128;i++){
  const time=turn*p.cyclePeriod+p.driveDuration*(i+.271)/129;model.update(time);model.root.updateMatrixWorld(true);
  const state=u.kinematics,tip=u.blocks['stop'+state.activeStopLabel+'ContactTip'],positions=tip.geometry.attributes.position,
    maximumY=Math.max(...Array.from({length:positions.count},(_,j)=>positions.getY(j))),
    index=Array.from({length:positions.count},(_,j)=>j).find(j=>positions.getY(j)===maximumY),
    apex=new THREE.Vector3().fromBufferAttribute(positions,index).applyMatrix4(tip.matrixWorld),
    claimed=new THREE.Vector3(state.activeStopPoint.x,state.activeStopPoint.y,p.contactPlaneZ),
    coneBox=new THREE.Box3().setFromObject(tip),gaps=camParts.map(({name,mesh,surface})=>({name,
      distance:surface.distance(apex.clone().applyMatrix4(mesh.matrixWorld.clone().invert())),
      axialSeparation:coneBox.min.z-new THREE.Box3().setFromObject(mesh).max.z}));
  rows.push({turn,time,activeStop:state.activeStopLabel,claimedContactError:state.contactError,
    apex:apex.toArray(),claimedPoint:claimed.toArray(),apexPointError:apex.distanceTo(claimed),gaps,
    wheelAngularSpeed:state.wheelAngularSpeed});
}
const epsilon=1e-8,speedAt=t=>u.stateAtTime(t).wheelAngularSpeed,
  boundaries=[p.driveDuration,p.cyclePeriod,p.cyclePeriod+p.driveDuration].map(time=>({time,before:speedAt(time-epsilon),after:speedAt(time+epsilon)})),
  summary={sampledDrivenStates:rows.length,maximumClaimedContactError:Math.max(...rows.map(r=>r.claimedContactError)),
    maximumApexPointError:Math.max(...rows.map(r=>r.apexPointError)),minimumApexToCamDistance:Math.min(...rows.flatMap(r=>r.gaps.map(g=>g.distance))),
    maximumApexToCamDistance:Math.max(...rows.map(r=>Math.min(...r.gaps.map(g=>g.distance)))),
    minimumAxialSeparation:Math.min(...rows.flatMap(r=>r.gaps.map(g=>g.axialSeparation))),boundaries,
    camRadii:[p.camBaseRadius,p.camInnerRadius,p.camOuterRadius],wheelRadius:p.wheelRadius,stopMountRadius:p.stopMountRadius};
verifyStudySources(sources);for(const[file,sha]of Object.entries(baseline))assert.equal(hashStudyFile(file),sha,file);
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:88,productionChanged:false,mechanicsPassed:false,sources,
  productionBaseline:{file:baselineFile,sha256:hashStudyFile(baselineFile),unchangedInputs:Object.keys(baseline).length},summary,rows,
  qualification:'Read-only audit of the current production reconstruction. Actual Float32 cone apex positions are transformed independently and checked against native cam-body and offset-face triangles. Claimed planar contact can be compared with physical surface distance and axial separation. Speed discontinuities are measured across prescribed drive/dwell boundaries; no mass or braking mechanism is inferred. This diagnoses defects for reconstruction and does not qualify movement 088.'},null,2)+'\n',{flag:'wx'});
console.log(summary);
assert(summary.maximumClaimedContactError<1e-10&&summary.maximumApexPointError<1e-7);
