import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {createAuthoredDifferentialWormDriveMovement} from '../src/simulation/authored-differential-worm-drives.js';
import {specialWormParameters} from '../src/simulation/special-worm-parameters.js';
import {specialWormCuts} from '../src/data/special-worm-wheel-profiles.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {solidSurface} from './helpers/solid-surface.mjs';
import * as THREE from 'three';
const create=id=>id===202?createAuthoredGearMovement({id}):createAuthoredDifferentialWormDriveMovement({id});
function actualBore(mesh,axis,radius){
 const solid=solidSurface(mesh.geometry),a=new THREE.Vector3();
 // Probe the shaft's actual outside circle through all axial stations.
 const center=solid.box.getCenter(new THREE.Vector3()),size=solid.box.getSize(new THREE.Vector3());
 for(let j=0;j<=4;j++)for(let i=0;i<24;i++){
  const angle=i*Math.PI/12;a.copy(center);a[axis]=center[axis]+size[axis]*(j/4-.5)*.98;
  const other=['x','y','z'].filter(k=>k!==axis);a[other[0]]=radius*Math.cos(angle);a[other[1]]=radius*Math.sin(angle);
  assert.equal(solid.inside(a),false,`${mesh.userData.role} shaft intersects actual bore`);
 }
}
for(const id of[202,264])test(`${id}: visible solids ignore fog and omit invented ground/frame`,()=>{
 const model=create(id),b=model.root.userData.blocks;
 assert.equal(model.root.userData.hideGround,true);assert.equal(b.baseRail.parent,null);
 model.root.traverse(o=>{if(o.visible)for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)assert.equal(m.fog,false);});
 assert.ok(model.root.userData.cameraFitBounds.isBox3);
 if(id===202){assert.equal(b.wormThread.geometry.type,'BufferGeometry');assert.equal(b.wormThread.userData.integralThread,true);assert.equal(b.generatedWheel.count,60);assert.equal(b.wormBody.visible,false);actualBore(b.wormThread,'z',.085);}
 else{assert.equal(b.worm.userData.toothProfile,'axial-straight-flanked-worm');actualBore(b.worm.userData.thread,'z',.075);assert.equal(model.root.userData.timeline.oneWormTurn,2.4);}
 disposeObject3D(model.root);
});
test('264: independent nested journals connect the rear wheel to the inner shaft',()=>{
 const model=create(264),b=model.root.userData.blocks;
 assert.ok(b.wheel101.position.x<b.wheel100.position.x);
 actualBore(b.outerSleeve,'z',.07);
 for(const [name,shaftRadius]of[['wheel100',.116],['wheel101',.07]]){
  const wheel=b[name],hub=wheel.userData.rotor.children.find(o=>o.userData.role?.endsWith('independent-bored-hub'));
  actualBore(hub,'z',shaftRadius);
  const collar=b[`${name}Pointer`].children.find(o=>o.userData.role==='pointer-output-shaft-collar');actualBore(collar,'z',shaftRadius);
  const arm=b[`${name}Pointer`].children[0];arm.geometry.computeBoundingBox();assert.ok(arm.position.y+arm.geometry.boundingBox.min.y>.116);
 }
 const backHub=b.wheel101.userData.rotor.children.find(o=>o.userData.role?.endsWith('independent-bored-hub'));backHub.geometry.computeBoundingBox();
 const sleeveStart=b.outerSleeve.position.z-b.outerSleeve.geometry.parameters.options.depth/2+b.wheel100.position.x;
 assert.ok(sleeveStart>b.wheel101.position.x+backHub.geometry.boundingBox.max.z);
 disposeObject3D(model.root);
});
test('264: equal outside diameters are cut with the same worm, not two different pitches',()=>{
 const a=specialWormParameters[264100],b=specialWormParameters[264101];
 for(const key of['wormPitch','wormRadius','wormLength','distance','outerRadius'])assert.equal(a[key],b[key]);
 assert.equal(a.offset,-b.offset);assert.notDeepEqual(specialWormCuts[264100].radii,specialWormCuts[264101].radii);
 for(const id of[202,264100,264101]){const p=specialWormParameters[id],c=specialWormCuts[id];assert.equal(c.radii.length,(c.angularSteps+1)*(c.axialSteps+1));assert.ok(c.radii.every(r=>Number.isFinite(r)&&r>1&&r<=p.outerRadius));assert.equal(c.maximumSeamResidual,0);}
});
test('202/264: saved finite-solid qualification is current and stays engaged',()=>{
 const report=JSON.parse(fs.readFileSync('docs/validation/202-264-worm-solids.json'));
 assert.equal(report.status,'sampled-flanks-clear');assert.ok(report.poses>=17);
 for(const source of report.sources)assert.equal(createHash('sha256').update(fs.readFileSync(source.file)).digest('hex'),source.sha256,source.file);
 for(const r of report.results){assert.equal(r.penetrations,0);assert.ok(r.queries>100000);assert.ok(r.maximumClosestGap<.006);}
});
