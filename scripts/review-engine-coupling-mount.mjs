import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredEngineCouplingMovement} from '../src/simulation/authored-engine-couplings.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const m=createAuthoredEngineCouplingMovement({id:176}),b=m.root.userData.blocks;
const parts={left:b.selectorLeftLobe,right:b.selectorRightLobe,sleeve:b['selector-connecting-sleeve'],front:b['selector-front-retaining-lip'],rear:b['selector-rear-retaining-lips'],leftFace:b['selector-left-recessed-face'],rightFace:b['selector-right-recessed-face'],shaft:b.outputShaft,cheek:b.outputCrankPlate,cap:b.outputShaftCap,inputShaft:b.inputShaft,inputBoss:b.inputShaftBoss,inputArm:b.inputCrankArm,wristBoss:b.inputWristBoss,wrist:b.wristPin,bottomBoss:b["output-bottom-boss"],topBoss:b["output-top-boss"]};
const links=[['left','sleeve'],['right','sleeve'],['leftFace','left'],['rightFace','right'],['rear','left'],['rear','right'],['front','sleeve'],['shaft','cheek'],['cap','shaft'],['inputBoss','inputShaft'],['inputArm','inputBoss'],['wristBoss','inputArm'],['wrist','wristBoss'],['bottomBoss','cheek'],['topBoss','cheek']];
try{m.root.updateMatrixWorld(true);const results=links.map(([from,to])=>{
 const touch=[];
 for(const [a,c]of [[parts[from],parts[to]],[parts[to],parts[from]]]){
  const surface=solidSurface(c.geometry),transform=c.matrixWorld.clone().invert().multiply(a.matrixWorld);
  touch.push(...surfacePoints(a.geometry).map(p=>p.applyMatrix4(transform)).filter(p=>surface.inside(p)||surface.distance(p)<1e-6).map(p=>p.applyMatrix4(c.matrixWorld)));
 }
 let noncollinear=false;for(let i=2;i<touch.length&&!noncollinear;i++)noncollinear=new THREE.Vector3().subVectors(touch[1],touch[0]).cross(new THREE.Vector3().subVectors(touch[i],touch[0])).length()>1e-5;
 assert.ok(noncollinear,from+' / '+to+' lacks sampled area attachment');return{from,to,attachmentSamples:touch.length,noncollinear};
 });
 const g=m.root.userData.geometry,frontClearance=.49-(g.outputPlaneZ+g.outputCrankDepth/2+.014),rearClearance=g.outputPlaneZ-g.outputCrankDepth/2-.014-.23;
 assert.ok(frontClearance>.015&&rearClearance>.015);assert.ok(.70>g.topHoleRadius);assert.ok(.245>g.wristPinFrontZ);
 const report={movement:176,status:'selector-and-crank-attachments-checked',links:results,frontClearance,rearClearance,wristTipToSleeve:.245-g.wristPinFrontZ,method:'Actual finite-surface attachment samples for both lobes to the connecting sleeve, each recessed face, both rear lips the front lip, fitted output shaft and rear input/wrist chain. Noncollinear samples establish an area connection. Separate cross-family audit checks cheek/selector interference.',assumptions:'Axial construction inferred from the front engraving. Selected angular position is held by an ideal lock; no locking hardware is inferred. Output seat is treated as a rigid fit; axial shafts and fixed bearing supports are inferred.',sources:['scripts/review-engine-coupling-mount.mjs','src/simulation/authored-engine-couplings.js','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/176-selector-mount.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(m.root);}
