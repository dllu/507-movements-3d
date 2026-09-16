import fs from 'node:fs';import * as THREE from 'three';import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements;
const project=(meshes,generation=false)=>meshes.filter(m=>generation||m.visible).flatMap(mesh=>{mesh.updateMatrix();const geometry=generation?(mesh.userData.generationGeometry??mesh.geometry):mesh.geometry,p=geometry.attributes.position,index=geometry.index,triangles=[];for(let i=0;i<(index?.count??p.count);i+=3){const t=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrix));if(Math.abs((t[1].x-t[0].x)*(t[2].y-t[0].y)-(t[2].x-t[0].x)*(t[1].y-t[0].y))>1e-12)triangles.push(t.map(v=>[v.x,v.y]));}return triangles;});
const rows=[];
for(const id of[205,209]){const model=createAuthoredGearMovement(catalog[id-1]),u=model.root.userData,b=u.blocks,pairs=id===205?b.camMeshes.map((cam,i)=>({a:b.driver,b:b.wheel,first:[cam],second:b.wheelRows[i].userData.teeth})): [{a:b.driver,b:b.driven,first:[b.driver.userData.body,...b.driver.userData.toothMeshes],second:[b.driven.userData.body,...b.driven.userData.toothMeshes]}];
 const row={id,pairs:pairs.map(({first,second})=>[project(first),project(second)]),generationPairs:pairs.map(({first,second})=>[project(first,true),project(second,true)]),poses:[],generation:[]},period=u.transmission.inputPeriod??u.transmission.inputCyclePeriod;
 const pose=time=>{model.update(time);model.root.updateMatrixWorld(true);return pairs.map(({a,b})=>{const e=a.userData.rotor.matrixWorld.clone().invert().multiply(b.userData.rotor.matrixWorld).elements;return[e[0],e[4],e[1],e[5],e[12],e[13]];});};
 for(let i=0;i<513;i++)row.poses.push(pose(period*(i+.371)/513));
 for(let i=0;i<=4096;i++)row.generation.push(pose(period*i/4096)[0]);
 rows.push(row);
}
fs.writeFileSync('/dev/shm/205-209-contact.json',JSON.stringify(rows));
