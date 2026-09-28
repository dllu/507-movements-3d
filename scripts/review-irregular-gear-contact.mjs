import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,results=[];
const project=meshes=>meshes.filter(m=>m.visible).flatMap(mesh=>{mesh.updateMatrix();const g=mesh.geometry,p=g.attributes.position,index=g.index,triangles=[];for(let i=0;i<(index?.count??p.count);i+=3){const q=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix));if(Math.abs((q[1].x-q[0].x)*(q[2].y-q[0].y)-(q[2].x-q[0].x)*(q[1].y-q[0].y))>1e-13)triangles.push(q.map(v=>[v.x,v.y]));}return triangles;});
for(const id of[191,196,201]){
 const m=createAuthoredGearMovement(catalog[id-1]),u=m.root.userData,b=u.blocks,period=u.transmission.cyclePeriod??u.transmission.inputCyclePeriod;
 const a=id===191?b.driven:id===196?b.wheel:b.eccentricGear,bb=id===191?b.driver:b.pinion;
 const partsA=id===191?[b.drivenBody,...b.drivenTeeth]:id===196?[b.wheelBody,...b.wheelToothMeshes]:[a.userData.rotor.children[0]],partsB=id===191?[b.driverBody,...b.driverTeeth]:[bb.userData.rotor.children[0]];
 const poses=Array.from({length:513},(_,i)=>{m.update(period*(i===512?1:(i+.371)/512));m.root.updateMatrixWorld(true);const e=a.userData.rotor.matrixWorld.clone().invert().multiply(bb.userData.rotor.matrixWorld).elements;return[e[0],e[4],e[1],e[5],e[12],e[13]];});
 results.push({id,period,trianglesA:project(partsA),trianglesB:project(partsB),poses});
}
const files=['src/simulation/authored-gears.js','src/simulation/authored-gears-core.js','src/simulation/miter-gear.js','src/simulation/irregular-gear-family.js','src/simulation/irregular-gear-201.js','src/simulation/smooth-extrusion.js','src/simulation/generated-irregular-gear-profiles.js','src/simulation/band-epicyclic-geometry.js','src/simulation/primitives.js','scripts/review-irregular-gear-contact.mjs','scripts/review-irregular-gear-contact.py'];
fs.writeFileSync('/dev/shm/irregular-contact-input.json',JSON.stringify({sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),results}));
