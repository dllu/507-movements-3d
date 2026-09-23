import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createAuthoredGearMovement} from '../src/simulation/authored-gears.js';
import {createAuthoredDifferentialWormDriveMovement} from '../src/simulation/authored-differential-worm-drives.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const poses=Number(process.env.POSES??17),results=[];
for(const id of [202,264]){
 const model=id===202?createAuthoredGearMovement({id}):createAuthoredDifferentialWormDriveMovement({id});
 const b=model.root.userData.blocks,worm=id===202?b.wormThread:b.worm.userData.thread;
 const wheels=id===202?[b.generatedWheel]:[b.wheel100.userData.rotor.children[0],b.wheel101.userData.rotor.children[0]];
 const ws=solidSurface(worm.geometry),wp=surfacePoints(worm.geometry);
 const period=id===202?model.root.userData.transmission.inputCyclePeriod:model.root.userData.timeline.oneWormTurn;
 for(const [side,wheel]of wheels.entries()){
  const cs=solidSurface(wheel.geometry),cp=surfacePoints(wheel.geometry);
  let queries=0,penetrations=0,maximumDepth=0,minimumGap=Infinity,maximumClosestGap=0,worst=null;
  for(let frame=0;frame<poses;frame++){
   model.update(period*frame/(poses-1));model.root.updateMatrixWorld(true);
   const wormBox=ws.box.clone().applyMatrix4(worm.matrixWorld),wormInverse=worm.matrixWorld.clone().invert();let closest=.03;
   for(let instance=0;instance<wheel.count;instance++){
    const world=new THREE.Matrix4();wheel.getMatrixAt(instance,world);world.premultiply(wheel.matrixWorld);
    const box=cs.box.clone().applyMatrix4(world);if(!wormBox.clone().expandByScalar(.01).intersectsBox(box))continue;
    for(const[points,matrix,surface]of[[cp,wormInverse.clone().multiply(world),ws],[wp,world.clone().invert().multiply(worm.matrixWorld),cs]]){
     for(const sample of points){const p=sample.clone().applyMatrix4(matrix);if(surface.box.distanceToPoint(p)>.01)continue;queries++;
      const inside=surface.inside(p),distance=surface.distance(p,.03);minimumGap=Math.min(minimumGap,inside?-distance:distance);closest=Math.min(closest,distance);
      if(inside&&distance>1e-6){penetrations++;if(distance>maximumDepth){maximumDepth=distance;worst={frame,instance,p:p.toArray()};}}
     }
    }
   }maximumClosestGap=Math.max(maximumClosestGap,closest);
  }
  results.push({id,side,queries,penetrations,maximumDepth,minimumGap,maximumClosestGap,worst});console.log(results.at(-1));
 }
 disposeObject3D(model.root);
}
const sources=['src/simulation/special-worm-solids.js','src/simulation/special-worm-parameters.js','src/data/special-worm-wheel-profiles.js','src/simulation/solid-worm.js','src/simulation/authored-gears.js','src/simulation/authored-gears-core.js','src/simulation/miter-gear.js','src/simulation/authored-differential-worm-drives.js','src/simulation/instanced-worm-wheel.js','src/simulation/worm-gear-geometry.js','src/simulation/bored-worm-geometry.js'];
const report={movements:[202,264],poses,status:results.every(r=>r.penetrations===0)?'sampled-flanks-clear':'intersections-detected',method:'Actual rendered integral worm and every instanced closed tooth sector; bidirectional triangle vertices, edge midpoints and face centers through one complete input turn. BVH winding containment and finite triangle distances. Sampling is not continuous collision proof.',scope:'Working worm/wheel solids only; wheel hubs, pointers and shafts excluded. Distances in model coordinates before root display scaling.',results,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.REPORT??'docs/validation/202-264-worm-solids.json',JSON.stringify(report,null,2)+'\n');
if(report.status!=='sampled-flanks-clear')process.exitCode=1;
