import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const id=Number(process.env.MOVEMENT??195),model=createAuthoredGearMovement({id}),b=model.root.userData.blocks;
const poses=Number(process.env.POSES??65),phaseOffset=Number(process.env.PHASE_OFFSET??0),results=[];
for(const side of (id===195?['upper','lower']:['left','right'])){
 const worm=(id===195?b.worm:b[`${side}Worm`]).userData.thread,wheel=b[`${side}${id===195?'GeneratedFace':'WheelBody'}`];
 const ws=solidSurface(worm.geometry),cs=solidSurface(wheel.geometry),wp=surfacePoints(worm.geometry),cp=surfacePoints(wheel.geometry);
 let queries=0,penetrations=0,maximumDepth=0,minimumGap=Infinity,worst=null;
 for(let frame=0;frame<poses;frame++){
  const time=model.root.userData.transmission.inputPeriod*frame/(poses-1);model.update(time);
  b[`${side}Wheel`].userData.rotor.rotation.z+=phaseOffset;
  model.root.updateMatrixWorld(true);
  const wormBox=ws.box.clone().applyMatrix4(worm.matrixWorld),wormInverse=worm.matrixWorld.clone().invert();
  for(let instance=0;instance<(wheel.isInstancedMesh?wheel.count:1);instance++){
   const world=new THREE.Matrix4();if(wheel.isInstancedMesh)wheel.getMatrixAt(instance,world);world.premultiply(wheel.matrixWorld);
   const box=cs.box.clone().applyMatrix4(world);if(!wormBox.intersectsBox(box))continue;
   for(const[points,matrix,surface]of[[cp,wormInverse.clone().multiply(world),ws],[wp,world.clone().invert().multiply(worm.matrixWorld),cs]]){
    for(const sample of points){const p=sample.clone().applyMatrix4(matrix);if(surface.box.distanceToPoint(p)>.01)continue;queries++;
     const inside=surface.inside(p),distance=surface.distance(p,.01);minimumGap=Math.min(minimumGap,inside?-distance:distance);
     if(inside&&distance>1e-6){penetrations++;if(distance>maximumDepth){maximumDepth=distance;worst={frame,instance,p:p.toArray()};}}
    }
   }
  }
 }
 results.push({side,queries,penetrations,maximumDepth,minimumGap,worst});console.log(results.at(-1));
}
const factoryFile='src/simulation/authored-gears-core.js',factoryName=id===195?'opposedFeedRollWormDrive':'oppositeHandTwinWormFeedRollDrive',factoryText=fs.readFileSync(factoryFile,'utf8'),factoryStart=factoryText.indexOf('function '+factoryName+'('),factoryEnd=factoryText.indexOf('\nfunction ',factoryStart+1),factorySource={file:factoryFile,name:factoryName,sha256:createHash('sha256').update(factoryText.slice(factoryStart,factoryEnd)).digest('hex')};
const sources=['src/simulation/feed-worm-assembly-parts.js','src/simulation/face-slot-worm-195.js','src/data/worm-crest-195.js','scripts/generate-worm-crest-195.mjs','src/simulation/feed-worm-wheel.js','src/data/feed-worm-wheel-profile.js','src/simulation/solid-worm.js'];
const report={movement:id,factorySource,poses,phaseOffset,status:results.every(r=>r.penetrations===0)?'sampled-flanks-clear':'intersections-detected',method:'Actual rendered worm and every instanced closed tooth sector; bidirectional triangle vertices, edge midpoints and face centers through one complete input turn. BVH winding containment and finite triangle distances. Sampling is not continuous collision proof.',scope:'Working worm/wheel solids only; bearing frames, wheel hubs and shafts excluded.',results,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.REPORT??`docs/validation/feed-worm-${id}-solids.json`,JSON.stringify(report,null,2)+'\n');disposeObject3D(model.root);
if(report.status!=='sampled-flanks-clear')process.exitCode=1;
