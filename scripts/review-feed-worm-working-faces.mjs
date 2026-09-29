import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {surfaceTriangles,solidSurface} from '../tests/helpers/solid-surface.mjs';
const id=Number(process.env.MOVEMENT??195),model=createAuthoredGearMovement({id}),d=model.root.userData,b=d.blocks,results=[];
for(const side of(id===195?['upper','lower']:['left','right'])){
 const worm=(id===195?b.worm:b[side+'Worm']).userData.thread,wheel=b[side+(id===195?'GeneratedFace':'WheelBody')],faces=surfaceTriangles(wheel.geometry),wormFaces=surfaceTriangles(worm.geometry),ws=solidSurface(worm.geometry),poses=[];
 // 207's small generated facets are probed at their centres. 195's slot walls
 // are large flat faces, probed on a 0.004 barycentric grid.
 const samples=[];for(const triangle of faces){const size=Math.max(triangle.a.distanceTo(triangle.b),triangle.b.distanceTo(triangle.c),triangle.c.distanceTo(triangle.a)),n=id===195?Math.max(1,Math.ceil(size/.004)):0;
  if(!n){samples.push([triangle,triangle.getMidpoint(new THREE.Vector3())]);continue;}
  for(let i=0;i<=n;i++)for(let j=0;j<=n-i;j++){const u=(i+1/3)/(n+1),v=(j+1/3)/(n+1);if(u+v>1)continue;samples.push([triangle,triangle.a.clone().multiplyScalar(1-u-v).addScaledVector(triangle.b,u).addScaledVector(triangle.c,v)]);}}
 for(let frame=0;frame<17;frame++){
  model.update(d.transmission.inputPeriod*frame/16);model.root.updateMatrixWorld(true);
  const wi=worm.matrixWorld.clone().invert(),wheelCenter=wheel.getWorldPosition(new THREE.Vector3()),wormCenter=worm.getWorldPosition(new THREE.Vector3()),wheelRate=id===195?d.stateAtTime(0)[side+'WheelAngularSpeed']:d.transmission[side+'WheelAngularSpeed'];let closest=Infinity,best=null;
  for(let instance=0;instance<(wheel.isInstancedMesh?wheel.count:1);instance++){
   const world=new THREE.Matrix4();if(wheel.isInstancedMesh)wheel.getMatrixAt(instance,world);world.premultiply(wheel.matrixWorld);const localToWorm=wi.clone().multiply(world),nmat=new THREE.Matrix3().getNormalMatrix(world);
   for(const[triangle,local]of samples){
    const point=local.clone().applyMatrix4(world),probe=local.clone().applyMatrix4(localToWorm);
    if(ws.box.distanceToPoint(probe)>.015)continue;const gap=ws.distance(probe,.015);closest=Math.min(closest,gap);if(gap>.015)continue;
    const normal=triangle.getNormal(new THREE.Vector3()).applyMatrix3(nmat).normalize();
    const inputMoment=point.clone().sub(wormCenter).cross(normal).x,outputMoment=-point.clone().sub(wheelCenter).cross(normal).z;
    if(inputMoment>=-.005||outputMoment*wheelRate<=.005)continue;
    // Only a probe closer than the current best can replace it.
    if(best&&gap>=best.gap)continue;
    let actualGap=Infinity,opposing=0;
    for(const t of wormFaces){const q=t.closestPointToPoint(probe,new THREE.Vector3()),g=q.distanceTo(probe);if(g<actualGap){actualGap=g;const wn=t.getNormal(new THREE.Vector3()).transformDirection(worm.matrixWorld);opposing=wn.dot(normal);}}
    if(opposing>-.8)continue;
    if(!best||gap<best.gap)best={gap,inputMoment,outputMoment,normalOpposition:opposing,point:point.toArray(),normal:normal.toArray(),instance};
   }
  }
  poses.push({frame,closest,best});
 }
 results.push({side,poses,missing:poses.filter(p=>!p.best).length,maximumWorkingGap:Math.max(...poses.map(p=>p.best?.gap??Infinity))});console.log({id,side,missing:results.at(-1).missing,maxgap:results.at(-1).maximumWorkingGap,first:poses[0]});
}
const factoryFile='src/simulation/authored-gears-core.js',factoryName=id===195?'opposedFeedRollWormDrive':'oppositeHandTwinWormFeedRollDrive',factoryText=fs.readFileSync(factoryFile,'utf8'),factoryStart=factoryText.indexOf('function '+factoryName+'('),factoryEnd=factoryText.indexOf('\nfunction ',factoryStart+1),factorySource={file:factoryFile,name:factoryName,sha256:createHash('sha256').update(factoryText.slice(factoryStart,factoryEnd)).digest('hex')};
const sources=['src/simulation/feed-worm-assembly-parts.js','src/simulation/face-slot-worm-195.js','src/data/worm-crest-195.js','scripts/generate-worm-crest-195.mjs','src/simulation/solid-worm.js','src/simulation/feed-worm-wheel.js','src/data/feed-worm-wheel-profile.js','scripts/review-feed-worm-working-faces.mjs'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}));
fs.writeFileSync(process.env.REPORT??`docs/validation/feed-worm-${id}-working-faces.json`,JSON.stringify({movement:id,factorySource,sources,method:'Actual wheel triangle centers and closest worm triangles, opposing outward normals; resisting input moment and intended output moment. Finite clearance is not loaded zero-gap contact.',results},null,2)+'\n');
if(results.some(x=>x.missing))process.exitCode=1;
