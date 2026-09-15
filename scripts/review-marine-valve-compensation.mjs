import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredMarineValveGearMovement} from '../src/simulation/authored-marine-valve-gears.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';

const model=createAuthoredMarineValveGearMovement({id:171});
const {geometry:g,blocks:b,lowerStateAtSlideStroke}=model.root.userData;
try {
  const nominal=lowerStateAtSlideStroke(0,0);
  const referenceAngle=Math.atan2(nominal.followerPinWorld.y-nominal.rockshaftPivotWorld.y,
    nominal.followerPinWorld.x-nominal.rockshaftPivotWorld.x);
  let neutralAngleError=0,slotCenterError=0,armLengthError=0,slotRadiusError=0;
  const offNeutral=[];
  for(const stroke of [-.18,-.1,0,.1,.24]) {
    let low=Infinity,high=-Infinity;
    for(let i=0;i<=720;i++) {
      const cylinderAngle=-.3+.6*i/720,s=lowerStateAtSlideStroke(stroke,cylinderAngle);
      const angle=Math.atan2(s.followerPinWorld.y-s.rockshaftPivotWorld.y,
        s.followerPinWorld.x-s.rockshaftPivotWorld.x)-cylinderAngle-referenceAngle;
      if(stroke===0)neutralAngleError=Math.max(neutralAngleError,Math.abs(angle));
      low=Math.min(low,angle);high=Math.max(high,angle);
      slotCenterError=Math.max(slotCenterError,s.slotCenterWorld.distanceTo(g.trunnionCenter.clone().add(new THREE.Vector2(0,stroke))));
      armLengthError=Math.max(armLengthError,Math.abs(s.followerPinWorld.distanceTo(s.rockshaftPivotWorld)-g.followerArmLength));
      slotRadiusError=Math.max(slotRadiusError,Math.abs(s.followerPinWorld.distanceTo(s.slotCenterWorld)-g.slotRadius));
    }
    offNeutral.push({stroke,relativeAngleRange:high-low});
  }
  const guidePositions=b.slideGuidePosts.map(mesh=>mesh.getWorldPosition(new THREE.Vector3()));
  let guideMotion=0,outputRodHorizontalSpan=0;
  for(let i=0;i<=720;i++) {
    model.update(18*i/720);model.root.updateMatrixWorld(true);
    b.slideGuidePosts.forEach((mesh,j)=>guideMotion=Math.max(guideMotion,mesh.getWorldPosition(new THREE.Vector3()).distanceTo(guidePositions[j])));
    const {diePoint,slideEyeWorld}=model.root.userData.kinematics;
    outputRodHorizontalSpan=Math.max(outputRodHorizontalSpan,Math.abs(diePoint.x-slideEyeWorld.x));
  }
  assert.ok(Math.max(neutralAngleError,slotCenterError,armLengthError,slotRadiusError,guideMotion,outputRodHorizontalSpan)<1e-12);
  assert.ok(offNeutral.filter(r=>r.stroke!==0).every(r=>r.relativeAngleRange>1e-3),
    'off-neutral geometry must not impose artificial exact cancellation');
  const report={movement:171,poses:3605,playbackPoses:721,neutralAngleError,slotCenterError,armLengthError,slotRadiusError,guideMotion,outputRodHorizontalSpan,offNeutral,
    source:'https://www.gutenberg.org/cache/epub/10998/pg10998-images.html',section:630,
    scope:'Fixed-column translating sector and cylinder-carried follower reconstruction. Exact cancellation is checked at neutral only; unmeasured rocker pivot and valve output dimensions remain assumptions.',
    sources:['scripts/review-marine-valve-compensation.mjs','src/simulation/authored-marine-valve-gears.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
  fs.writeFileSync('docs/validation/171-compensation.json',JSON.stringify(report,null,2)+'\n');console.log(report);
} finally {disposeObject3D(model.root);}
