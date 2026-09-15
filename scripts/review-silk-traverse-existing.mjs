import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredSilkTraverseMovement} from '../src/simulation/authored-silk-traverses.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from '../tests/helpers/solid-surface.mjs';
const model=createAuthoredSilkTraverseMovement({id:173});
const {blocks:b,geometry:g,modelPointToSourceRaster:toRaster}=model.root.userData;
const wheels=[];
b.tappetWheel.traverse(mesh=>{if(mesh.isMesh)wheels.push({mesh,surface:solidSurface(mesh.geometry)});});
try {
  const samples=[];
  for(let i=0;i<=256;i++) {
    const coordinate=g.contactHalfWidthTurns*(i/128-1);
    model.update((coordinate-g.sourceCarrierTurnCoordinate)/g.carrierTurnsPerSecond);
    model.root.updateMatrixWorld(true);
    const center=b.fixedTappetTip.getWorldPosition(new THREE.Vector3());
    const distance=Math.min(...wheels.map(({mesh,surface})=>surface.signedDistance(mesh.worldToLocal(center.clone()))));
    samples.push({fraction:i/256,screwAngle:model.root.userData.kinematics.screwAngle,
      sphereToWheelGap:distance-b.fixedTappetTip.geometry.parameters.radius});
  }
  model.update(0);model.root.updateMatrixWorld(true);
  const landmarks=[['nut wrist',b.nutWristAnchor,[159,310]],['tappet wheel',b.tappetWheelCenterAnchor,[351,179]],
    ['guide rod center',b.guideRod,[329.5,283]]].map(([name,object,source])=>{
      const p=object.getWorldPosition(new THREE.Vector3()),projected=toRaster(new THREE.Vector2(p.x,p.y)).toArray();
      return {name,source,projected,errorPixels:Math.hypot(...projected.map((v,i)=>v-source[i]))};
    });
  const report={movement:173,status:'contact-reconstruction-open',
    method:'First indexing encounter, 257 poses. Signed nearest distance from rendered spherical tappet center to every finite wheel mesh minus actual sphere radius; negative means overlap. Uniform unscaled mesh transforms. Selected engraving landmarks measured separately from model constants.',
    minimumSphereToWheelGap:Math.min(...samples.map(s=>s.sphereToWheelGap)),
    maximumSphereToWheelGap:Math.max(...samples.map(s=>s.sphereToWheelGap)),
    penetratingSamples:samples.filter(s=>s.sphereToWheelGap < -1e-6).length,
    separatedSamples:samples.filter(s=>s.sphereToWheelGap > 1e-6).length,
    landmarks,samples:samples.filter((_,i)=>i%32===0),
    sources:['scripts/review-silk-traverse-existing.mjs','src/simulation/authored-silk-traverses.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
  const out=process.argv[2]??'docs/validation/173-existing-contact.json';
  fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,sources:undefined,samples:undefined},null,2));
} finally {disposeObject3D(model.root);}
