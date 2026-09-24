import fs from 'node:fs';import * as THREE from 'three';import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';import {pinion208Slab} from '../src/simulation/variable-drive-205-209-parts.js';
const m=createAuthoredGearMovement(JSON.parse(fs.readFileSync('src/data/movements.json')).movements[207]),u=m.root.userData,b=u.blocks,pins=b.pinRings.flatMap(g=>g.children.filter(p=>p.userData.pinWheelPin));
const triangles=geometry=>{const p=geometry.attributes.position,index=geometry.index;return Array.from({length:(index?.count??p.count)/3},(_,i)=>[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i*3+j):i*3+j)));};
const pinTriangles=triangles(pins[0].geometry),blank=[b.pinionWeb,...b.pinionTeeth].flatMap(mesh=>{mesh.updateMatrix();return triangles(mesh.userData.generationGeometry??mesh.geometry).map(t=>t.map(p=>p.applyMatrix4(mesh.matrix).toArray().slice(0,2)));}),cutters=[];
for(let ring=0;ring<3;ring++)for(let i=0;i<=512;i++){
 const s=u.selectedStateAtWheelTravel(i/512*2*Math.PI/u.transmission.ringPinCounts[ring],ring);b.pinWheel.userData.rotor.rotation.z=s.wheelAngle;b.slottedPinion.userData.rotor.rotation.z=s.pinionAngle;b.slottedPinion.position.x=s.selectorX;m.root.updateMatrixWorld(true);
 for(const pin of pins){const matrix=b.slottedPinion.userData.rotor.matrixWorld.clone().invert().multiply(pin.matrixWorld),center=new THREE.Vector3().applyMatrix4(matrix);if(center.z<pinion208Slab[0]-.09||center.z>pinion208Slab[1]+.09)continue;
  const points=[];for(const triangle of pinTriangles){const t=triangle.map(p=>p.clone().applyMatrix4(matrix));for(let k=0;k<3;k++){const a=t[k],z=t[(k+1)%3];if(a.z>=pinion208Slab[0]-1e-7&&a.z<=pinion208Slab[1]+1e-7)points.push([a.x,a.y]);for(const depth of pinion208Slab)if((a.z-depth)*(z.z-depth)<0){const p=a.clone().lerp(z,(depth-a.z)/(z.z-a.z));points.push([p.x,p.y]);}}}if(points.length)cutters.push(points);
 }
}
fs.writeFileSync('/dev/shm/208-pin-envelope.json',JSON.stringify({blank,cutters}));console.log({cutters:cutters.length});
