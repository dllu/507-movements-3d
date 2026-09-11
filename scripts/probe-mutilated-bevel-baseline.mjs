import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { createMovementModel } from '../src/simulation/registry.js';
import { solidSurface, surfacePoints } from '../tests/helpers/solid-surface.mjs';

function querySurface(geometry){
  const p=geometry.attributes.position,index=geometry.index,indices=[];
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
    if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-22)indices.push(...ids);
  }
  const boundary=geometry.clone();boundary.setIndex(indices);
  return solidSurface(boundary);
}
async function archive(file,text){
  try{const current=await readFile(file,'utf8');if(current!==text)throw new Error('Existing archive differs: '+file);}
  catch(error){if(error.code!=='ENOENT')throw error;await writeFile(file,text,{flag:'wx'});}
}

const catalog=JSON.parse(await readFile('src/data/movements.json','utf8'));
const model=createMovementModel(catalog.movements[73]),{blocks:b,geometry:p,stateAtTime}=model.root.userData;
const shafts=['shaftA','shaftB','driverShaft'];
const shaftMeshes=Object.fromEntries(shafts.map(name=>{
  const meshes=[];b[name].traverse(object=>{if(object.isMesh)meshes.push(object);});
  if(meshes.length!==1)throw new Error('Expected one shaft solid: '+name);
  return[name,meshes[0]];
}));
const names=['gearA','gearB','driverC'],gears=Object.fromEntries(names.map(name=>{
  const gear=b[name],tooth=gear.userData.toothMeshes[0];
  return[name,{gear,body:querySurface(gear.userData.body.geometry),tooth:querySurface(tooth.geometry),
    meshes:[{mesh:gear.userData.body,label:'body',points:surfacePoints(gear.userData.body.geometry)},
      ...gear.userData.toothMeshes.map(mesh=>({mesh,label:'tooth-'+mesh.userData.index,points:surfacePoints(mesh.geometry)}))],
    installed:new Set(gear.userData.installedToothIndices)}];
}));
const directions=[['gearA','driverC'],['driverC','gearA'],['gearB','driverC'],['driverC','gearB']];
const pairs=directions.map(([source,target])=>({source,target,checks:0,inside:0,maximumDepth:0,minimumGap:.08}));
const times=Array.from({length:193},(_,i)=>p.driverCyclePeriod*(i+.217)/193);
for(const phase of [.25,.75])for(let i=-24;i<=24;i++)times.push((phase+i/24/48)*p.driverCyclePeriod);
const poses=[];
for(const [index,time]of times.entries()){
  model.update(time);model.root.updateMatrixWorld(true);const state=stateAtTime(time),row={time,cyclePhase:state.cyclePhase,activeOutput:state.activeOutput,pairs:[]};
  for(const pair of pairs){
    const source=gears[pair.source],target=gears[pair.target],inverse=target.gear.userData.rotor.matrixWorld.clone().invert();
    let minimumGap=.08,inside=0;
    for(const part of source.meshes){
      const matrix=inverse.clone().multiply(part.mesh.matrixWorld);
      for(const point of part.points){
        const local=point.clone().applyMatrix4(matrix);pair.checks++;
        let gap=.08,feature=null;
        if(target.body.box.distanceToPoint(local)<.08){gap=target.body.signedDistance(local,.08);feature='body';}
        const toothIndex=Math.round(Math.atan2(local.y,local.x)/p.toothPitch);
        for(let offset=-1;offset<=1;offset++){
          const index=THREE.MathUtils.euclideanModulo(toothIndex+offset,p.teeth);if(!target.installed.has(index))continue;
          const angle=-index*p.toothPitch,c=Math.cos(angle),s=Math.sin(angle),q=new THREE.Vector3(c*local.x-s*local.y,s*local.x+c*local.y,local.z);
          if(target.tooth.box.distanceToPoint(q)>=.08)continue;
          const value=target.tooth.signedDistance(q,.08);if(value<gap){gap=value;feature='tooth-'+index;}
        }
        if(!Number.isFinite(gap))throw new Error('Nonfinite gear surface gap');
        if(gap<-1e-6){inside++;pair.inside++;}
        if(-gap>pair.maximumDepth){pair.maximumDepth=-gap;pair.worst={time,cyclePhase:state.cyclePhase,activeOutput:state.activeOutput,
          sourcePart:part.label,targetPart:feature,targetPoint:local.toArray(),depth:-gap};}
        minimumGap=Math.min(minimumGap,gap);
      }
    }
    pair.minimumGap=Math.min(pair.minimumGap,minimumGap);row.pairs.push({source:pair.source,target:pair.target,minimumGap,inside});
  }
  poses.push(row);if(index%48===0)console.log({pose:index,inside:pairs.reduce((s,r)=>s+r.inside,0)});
}
model.update(0);model.root.updateMatrixWorld(true);
const shaftPairs=[];
for(let i=0;i<shafts.length;i++)for(let j=i+1;j<shafts.length;j++){
  const first=shafts[i],second=shafts[j],row={first,second,checks:0,inside:0,maximumDepth:0};
  for(const [from,to]of [[first,second],[second,first]]){
    const source=shaftMeshes[from],target=shaftMeshes[to],surface=querySurface(target.geometry),matrix=target.matrixWorld.clone().invert().multiply(source.matrixWorld);
    for(const point of surfacePoints(source.geometry)){
      row.checks++;const local=point.clone().applyMatrix4(matrix);if(!surface.inside(local))continue;
      const depth=surface.distance(local);if(!Number.isFinite(depth))throw new Error('Nonfinite shaft surface gap');if(depth<=1e-6)continue;
      row.inside++;if(depth>row.maximumDepth){row.maximumDepth=depth;row.worst={from,to,targetPoint:local.toArray(),depth};}
    }
  }
  shaftPairs.push(row);
}
const source=await readFile('src/simulation/authored-gears.js','utf8'),tests=await readFile('tests/models.test.mjs','utf8');
const start=tests.indexOf("test('movement 74 "),end=tests.indexOf('\ntest(',start+1);
for(const [file,text]of [['074-original-factory.txt',source.slice(source.indexOf('function mutilatedBevelAlternator()'),source.indexOf('function crownAndSpur()'))],
  ['074-original-test.txt',tests.slice(start,end)]])await archive('artifacts/review/'+file,text);
const files=['artifacts/review/074-original-factory.txt','artifacts/review/074-original-test.txt','artifacts/reference/mm_074.html',
  'artifacts/reference/brown-074-detail.png','public/engravings/mm_074.png','src/simulation/bevel-geometry.js'];
const archives=[];for(const file of files)archives.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
await archive('artifacts/review/074-baseline-archives.json',JSON.stringify(archives,null,2)+'\n');
const report={movement:74,status:'baseline-diagnosis',productionChanged:false,poses,pairs,shaftPairs,
  checks:pairs.reduce((s,r)=>s+r.checks,0),inside:pairs.reduce((s,r)=>s+r.inside,0),geometry:p,timing:model.root.userData.animationTiming,
  qualification:'Actual Float32 vertices, edge midpoints and face centers on both gear bodies and every installed tooth, classified against the opposing body and nearest three installed teeth. Zero-area pole triangles are omitted from distance queries; the remaining boundary is independently checked for closure and orientation. Four directed working pairs, a full cycle and dense sampling around both engagement switches. Three shaft pairs sampled in both directions at the initial pose. Penetration tolerance 1e-6. Minimum positive gaps are sampled estimates capped at 0.08; this does not certify contact or the remaining hardware.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-working-surface-baseline.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:poses.length,checks:report.checks,inside:report.inside,pairs,shaftPairs,timing:report.timing});
