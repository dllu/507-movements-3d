import fs from 'node:fs';
import * as THREE from 'three';
import {cylindricalWormGeometry,wormWheelGeometry} from '../src/simulation/worm-gear-geometry.js';
import {triangleTree,meshPairDistance} from './lib/star-mangle-pair-distance.mjs';
import {surfaceTriangles} from '../tests/helpers/solid-surface.mjs';
const {parameters:p,profile}=JSON.parse(fs.readFileSync(process.env.PROFILE??'/dev/shm/143-worm-candidate-profile.json'));
const segments=Number(process.env.SEGMENTS??640);
const worm=new THREE.Mesh(cylindricalWormGeometry({pitchRadius:p.wormPitchRadius,module:2*p.pitchRadius/p.teeth,length:p.wormLength,pressureAngle:p.pressureAngle,angularSteps:segments}));
worm.geometry.rotateY(Math.PI/2);worm.position.y=p.pitchRadius+p.wormPitchRadius;
const wheel=new THREE.Mesh(wormWheelGeometry(p,{profile}));
const allFaces=process.env.ALL_FACES==='1';
const module=2*p.pitchRadius/p.teeth,minimumWormRadial=p.pitchRadius-module;
const capInteriorRadius=minimumWormRadial-.03,capFraction=capInteriorRadius/(p.pitchRadius+module);
const faces=surfaceTriangles(wheel.geometry).flatMap(f=>{
 if(!allFaces){const q=f.getMidpoint(new THREE.Vector3());return -q.clone().cross(f.getNormal(new THREE.Vector3())).z>Math.hypot(q.x,q.y)*.1?[f]:[];}
 const vertices=[f.a,f.b,f.c],center=vertices.findIndex(q=>Math.hypot(q.x,q.y)<1e-12);
 if(center<0)return [f];
 // The discarded inner cap triangle lies at radius <= capInteriorRadius.
 // Every worm point has radial distance >= minimumWormRadial, so this
 // region is at least .03 away: outside the .02 closest-point search.
 // Subdivision leaves the potentially contacting cap region unchanged.
 const a=vertices[(center+1)%3],b=vertices[(center+2)%3];
 const innerA=a.clone().multiplyScalar(capFraction),innerB=b.clone().multiplyScalar(capFraction);innerA.z=a.z;innerB.z=b.z;
 return [new THREE.Triangle(innerA,a,b),new THREE.Triangle(innerA,b,innerB)];
});
const working=new THREE.BufferGeometry().setFromPoints(faces.flatMap(f=>[f.a,f.b,f.c]));
const aTree=triangleTree(worm.geometry),bTree=triangleTree(working),rows=[];
const inputs=JSON.parse(process.env.INPUTS??'[4.05874730888325,4.249146863646267,4.439546418409285]');
for(const input of inputs){
 worm.rotation.x=input-Math.PI/2;wheel.rotation.z=Math.PI/2+input/p.teeth;worm.updateMatrixWorld(true);wheel.updateMatrixWorld(true);
 const contact=meshPairDistance(aTree,bTree,wheel.matrixWorld.clone().invert().multiply(worm.matrixWorld),.02);
 const w=contact.witness;
 const a=w?new THREE.Vector3().fromArray(w.a).applyMatrix4(wheel.matrixWorld):null;
 const b=w?new THREE.Vector3().fromArray(w.b).applyMatrix4(wheel.matrixWorld):null;
 const normalPower=force=>{const out=b.clone().cross(force).z,driver=a.clone().sub(worm.position).cross(force.clone().negate()).x;return {out,driver,residual:Math.abs(driver+out/p.teeth)/Math.max(Math.abs(driver),Math.abs(out/p.teeth))};};
 const row={input,gap:contact.distance,witness:w,wormLocal:a?.clone().applyMatrix4(worm.matrixWorld.clone().invert()).toArray(),world:a?.toArray(),distancePower:contact.distance>1e-10?normalPower(b.clone().sub(a).normalize()):null,wheelNormalPower:w?normalPower(new THREE.Vector3().fromArray(w.bNormal).transformDirection(wheel.matrixWorld).negate()):null};
 rows.push(row);console.log(row);
}
fs.writeFileSync(process.env.OUTPUT??'/dev/shm/143-contact-witness.json',JSON.stringify({segments,allFaces,capInteriorRadius:allFaces?capInteriorRadius:null,minimumWormRadial:allFaces?minimumWormRadial:null,rows},null,2)+'\n');
