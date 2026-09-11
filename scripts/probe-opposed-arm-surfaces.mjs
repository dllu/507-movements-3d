import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeOpposedArmCandidate} from './lib/opposed-arm-candidate.mjs';
import {makeOpposedArmForceStudy} from './lib/opposed-arm-forces-study.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const trajectory=process.env.PROBE_TRAJECTORY?JSON.parse(await readFile(process.env.PROBE_TRAJECTORY,'utf8')):null,
 options=JSON.parse(process.env.GEOMETRY_OPTIONS??JSON.stringify(trajectory?.geometry??{})),model=makeOpposedArmCandidate(options),u=model.root.userData,
 force=trajectory?makeOpposedArmForceStudy(model,trajectory.parameters):null,
 states=trajectory?Array.from({length:Number(process.env.PROBE_SAMPLES??17)},(_,i)=>{
  const row=trajectory.rows[Math.round((trajectory.rows.length-1)*i/(Number(process.env.PROBE_SAMPLES??17)-1))];
  return{time:row.time,sliderX:row.sliderX??force.input(row.time).sliderX,theta:row.x[0],upperBeta:row.x[1],lowerBeta:row.x[2]};
 }):JSON.parse(process.env.PROBE_STATES??'[{}]'),entries=Object.entries(u.parts),surfaces={},points={},pairs=[],sources=[];
for(const file of ['scripts/probe-opposed-arm-surfaces.mjs','scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-forces-study.mjs','src/simulation/finite-plate-geometry.js','tests/helpers/solid-surface.mjs',...(process.env.PROBE_TRAJECTORY?[process.env.PROBE_TRAJECTORY]:[])]){
 const bytes=await readFile(file),prefix=process.env.PROBE_PREFIX??'079-first-candidate-surfaces',archive=`artifacts/review/${prefix}-geometry-source-${sources.length}.txt`;
 await writeFile(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:createHash('sha256').update(bytes).digest('hex')});
}
for(const [name,mesh]of entries){surfaces[name]=solidSurface(mesh.geometry);points[name]=surfacePoints(mesh.geometry);}
for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++)if(u.families[entries[i][0]]!==u.families[entries[j][0]])pairs.push({a:entries[i][0],b:entries[j][0],checks:0,penetrations:0,maximum:0,witness:null,overlappingPoses:0});
let checks=0,penetrations=0;
for(const [pose,state]of states.entries()){
 u.setState(state);const boxes=Object.fromEntries(entries.map(([name,mesh])=>[name,surfaces[name].box.clone().applyMatrix4(mesh.matrixWorld)]));
 for(const pair of pairs){
  if(!boxes[pair.a].intersectsBox(boxes[pair.b]))continue;pair.overlappingPoses++;
  for(const [from,to]of [[pair.a,pair.b],[pair.b,pair.a]]){
   const matrix=u.parts[to].matrixWorld.clone().invert().multiply(u.parts[from].matrixWorld),surface=surfaces[to];
   for(const p of points[from]){
    const v=p.clone().applyMatrix4(matrix);checks++;pair.checks++;
    if(!surface.box.containsPoint(v)||!surface.inside(v))continue;
    const depth=surface.distance(v);if(depth<=1e-6)continue;
    penetrations++;pair.penetrations++;if(depth>pair.maximum){pair.maximum=depth;pair.witness={pose,state,from,to,point:p.toArray(),targetPoint:v.toArray(),depth};}
   }
  }
 }
 console.log({pose,checks,penetrations});
}
const issues=pairs.filter(p=>p.penetrations),report={movement:79,status:issues.length?'candidate-surface-screen-failed':'candidate-surface-screen-passed',productionChanged:false,mechanicsPassed:false,
 options,states,checks,penetrations,pairs,issues,sources,qualification:'Bidirectional samples on actual closed Float32 mesh surfaces, including vertices, triangle centroids and edge midpoints. This diagnostic does not certify continuous clearance or loaded contact dynamics.'};
await writeFile(`artifacts/review/${process.env.PROBE_PREFIX??'079-first-candidate-surfaces'}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({pairs:pairs.length,checks,penetrations,issues:issues.map(p=>({a:p.a,b:p.b,maximum:p.maximum,penetrations:p.penetrations}))});if(issues.length)process.exitCode=1;
