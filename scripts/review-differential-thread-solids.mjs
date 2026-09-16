import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createAuthoredDifferentialDriveMovement} from '../src/simulation/authored-differential-drives.js';
import {createAuthoredDifferentialScrewMovement} from '../src/simulation/authored-differential-screws.js';
import {createAuthoredWormRackMovement} from '../src/simulation/authored-worm-racks.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
const catalog=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,results=[];
const factories={260:createAuthoredDifferentialDriveMovement,266:createAuthoredDifferentialScrewMovement,275:createAuthoredWormRackMovement};
for(const id of(process.env.IDS??'260,266,275').split(',').map(Number)){
 const model=factories[id](catalog[id-1]),b=model.root.userData.blocks,g=model.root.userData.geometry;
 const tooth=gear=>gear.userData.rotor.children[0];
 const pairs=id===260?[[b.externalThread,b.internalThread,'screw-nut'],[tooth(b.longPinionF),tooth(b.wheelD),'F-D'],[tooth(b.pinionB),tooth(b.wheelE),'B-E']]:id===266?[[b.fixedThread,b.fixedInternalThread,'coarse-thread'],[b.movingThread,b.movingInternalThread,'fine-thread']]:b.rackTeeth.map((mesh,i)=>[b.wormThread,mesh,`rack-${i}`]);
 const parts=new Map();for(const mesh of new Set(pairs.flatMap(p=>p.slice(0,2))))parts.set(mesh,{surface:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
 const row={id,poses:Number(process.env.POSES??17),queries:0,penetrations:0,maxDepth:0,worst:null,pairs:pairs.map(p=>({pair:p[2],maximumSampledGap:0,minimumSampledGap:null,activePoses:0}))};
 for(let frame=0;frame<row.poses;frame++){
  model.update((g.cycleDuration??g.cyclePeriod??12)*frame/(row.poses-1));model.root.updateMatrixWorld(true);
  for(let pair=0;pair<pairs.length;pair++){const[a,b]=pairs[pair];let gap=Infinity;for(const[from,to]of[[a,b],[b,a]]){const x=parts.get(from),y=parts.get(to),matrix=to.matrixWorld.clone().invert().multiply(from.matrixWorld);for(const sample of x.points){const point=sample.clone().applyMatrix4(matrix);if(y.surface.box.distanceToPoint(point)>.02)continue;row.queries++;const d=y.surface.distance(point,.02);gap=Math.min(gap,d);if(d>1e-6&&y.surface.inside(point)){row.penetrations++;if(d>row.maxDepth){row.maxDepth=d;row.worst={frame,pair:pair,point:point.toArray()};}}}}
   if(gap<.02){const p=row.pairs[pair];p.activePoses++;p.maximumSampledGap=Math.max(p.maximumSampledGap,gap);p.minimumSampledGap=Math.min(p.minimumSampledGap??Infinity,gap);}
  }
 }
 results.push(row);console.log(JSON.stringify(row));disposeObject3D(model.root);
}
const sources=['src/simulation/authored-differential-drives.js','src/simulation/authored-differential-screws.js','src/simulation/authored-worm-racks.js','src/simulation/differential-thread-solids.js','src/simulation/mujoco-screw/thread-geometry.js','src/simulation/bored-lathe-geometry.js','src/simulation/primitives.js','src/simulation/authored-gears.js'];
fs.writeFileSync(process.env.REPORT??'docs/validation/260-266-275-thread-solids.json',JSON.stringify({sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),method:'Rendered mating-thread and tooth vertices, edge midpoints and triangle centers tested bidirectionally against BVH containment across the complete programmed cycle. Distances capped at .02 local units. Housings, shafts and collars are excluded from this selected working-surface audit. Rack teeth outside the worm axial range are inactive.',results},null,2)+'\n');
if(results.some(r=>r.penetrations))process.exitCode=1;
