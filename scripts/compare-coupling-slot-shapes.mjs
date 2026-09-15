import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredEngineCouplingMovement} from '../src/simulation/authored-engine-couplings.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const a=createAuthoredEngineCouplingMovement({id:176}),b=createAuthoredEngineCouplingMovement({id:177});try{
 const hash=g=>createHash('sha256').update(Buffer.from(g.attributes.position.array.buffer)).update(Buffer.from(g.attributes.normal.array.buffer)).update(g.index?Buffer.from(g.index.array.buffer):Buffer.from('unindexed')).digest('hex');
 const parts=Object.keys(a.root.userData.sharedSelector.parts).map(name=>{const left=a.root.userData.sharedSelector.parts[name],right=b.root.userData.sharedSelector.parts[name];assert.deepEqual(left.position.toArray(),right.position.toArray());assert.deepEqual(left.scale.toArray(),right.scale.toArray());assert.deepEqual(left.quaternion.toArray(),right.quaternion.toArray());const first=hash(left.geometry),second=hash(right.geometry);assert.equal(first,second,name);return{name,sha256:first,vertices:left.geometry.attributes.position.count};});
 assert.equal(a.root.userData.blocks.selectorRing.rotation.z,0);assert.equal(b.root.userData.blocks.selectorRing.rotation.z,-Math.PI/2);
 let maximumEngagedContactResidual=0,maximumReleasedClearanceError=0;
 for(let i=0;i<=720;i++){
  const state=a.root.userData.stateAtInputAngle(i*Math.PI/360),local=state.wristRelativeToRing.clone().rotateAround(new THREE.Vector2(),-state.outputAngle),distance=local.distanceTo(new THREE.Vector2(3.3,0));
  maximumEngagedContactResidual=Math.max(maximumEngagedContactResidual,Math.abs(3.59-distance-a.root.userData.geometry.wristPinRadius));
  const released=b.root.userData.stateAtInputAngle(i*Math.PI/360),radius=released.inputWrist.length();maximumReleasedClearanceError=Math.max(maximumReleasedClearanceError,Math.abs(Math.min(3.59-radius,radius-3.01)-.28-.01));
 }
 assert.ok(maximumEngagedContactResidual<1e-9);assert.ok(maximumReleasedClearanceError<1e-12);
 const report={status:'shared-selector-solids-identical-at-quarter-turn',movements:[176,177],parts,maximumEngagedContactResidual,maximumReleasedClearanceError,meaning:'Identical local position/normal/index buffers and part transforms for all seven selector solids. Only the ring angle changes by minus pi/2. Annular walls use one radius 3.3 and half-width .29. The retained engaged clearance lag has a sub-nanounit analytic residual; separate finite-solid sweeps validate both rendered assemblies.',sources:['scripts/compare-coupling-slot-shapes.mjs','src/simulation/authored-engine-couplings.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/176-177-slot-consistency.json',JSON.stringify(report,null,2)+'\n');console.log(report);
}finally{disposeObject3D(a.root);disposeObject3D(b.root);}
