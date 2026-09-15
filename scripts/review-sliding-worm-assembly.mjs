import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {Matrix4} from 'three';
import {makeSlidingWormModel} from '../src/simulation/baked/sliding-worm.js';
import {slidingWormDimensions as g} from '../src/simulation/sliding-worm-kinematics.js';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=makeSlidingWormModel(JSON.parse(fs.readFileSync('/dev/shm/143-candidate.json')));
try{
 const parts=[],cache=new Map();
 model.root.traverse(mesh=>{
  if(!mesh.isMesh)return;
  if(!cache.has(mesh.geometry))cache.set(mesh.geometry,{solid:solidSurface(mesh.geometry),points:surfacePoints(mesh.geometry)});
  const data=cache.get(mesh.geometry);
  for(let i=0;i<(mesh.isInstancedMesh?mesh.count:1);i++){
   const instance=new Matrix4();if(mesh.isInstancedMesh)mesh.getMatrixAt(i,instance);
   parts.push({...data,mesh,instance,name:mesh.name+(mesh.isInstancedMesh?':'+i:''),body:mesh.parent.name,world:new Matrix4()});
  }
 });
 const pairs=[];
 for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++){
  const a=parts[i],b=parts[j];if(a.body===b.body)continue;
  if([a.mesh.name,b.mesh.name].includes('generated-wheel')&&[a.mesh.name,b.mesh.name].includes('bored-worm'))continue;
  pairs.push([a,b]);
 }
 let checks=0,maximumDepth=0;const failures={},poses=Number(process.env.POSES??17);
 for(let i=0;i<poses;i++){
  model.update(g.period*i/(poses-1));
  for(const part of parts){part.world.copy(part.mesh.matrixWorld).multiply(part.instance);part.box=part.solid.box.clone().applyMatrix4(part.world);}
  for(const [a,b]of pairs){
   if(!a.box.intersectsBox(b.box))continue;
   for(const [from,to]of [[a,b],[b,a]]){
    const matrix=to.world.clone().invert().multiply(from.world);
    for(const p of from.points){
     const q=p.clone().applyMatrix4(matrix);checks++;if(!to.solid.inside(q))continue;
     const depth=to.solid.distance(q);if(depth<1e-6)continue;
     const key=a.name+' / '+b.name,entry=failures[key]??{points:0,maximumDepth:0,firstPose:i};entry.points++;entry.maximumDepth=Math.max(entry.maximumDepth,depth);failures[key]=entry;maximumDepth=Math.max(maximumDepth,depth);
    }
   }
  }
  console.log({pose:i,checks,failingPairs:Object.keys(failures).length});
 }
 const files=['/dev/shm/143-candidate.json.gz','scripts/review-sliding-worm-assembly.mjs','src/simulation/baked/sliding-worm.js','src/simulation/sliding-worm-kinematics.js','tests/helpers/solid-surface.mjs'];
 const report={movement:143,status:'candidate-assembly-sample-check',method:'Bidirectional actual vertices, edge midpoints and triangle centers against each oriented solid, with conservative transformed boxes for pruning. Instanced sectors are tested with their actual transforms. Same-body joins and the separately checked worm/wheel working surfaces are excluded. Sampling is not continuous swept-volume proof.',sources:files.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),summary:{poses,pairs:pairs.length,checks,maximumDepth,failingPairs:Object.keys(failures).length},failures};
 fs.writeFileSync('docs/validation/143-assembly.json',JSON.stringify(report,null,2)+'\n');console.log(report.summary);
}finally{model.dispose();}
