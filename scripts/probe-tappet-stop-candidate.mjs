import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeTappetStopCandidate} from './lib/tappet-stop-candidate.mjs';
import {surfaceTriangles,surfacePoints,solidSurface} from '../tests/helpers/solid-surface.mjs';
const m=makeTappetStopCandidate(),{parts:meshes,families,geometry:p}=m.root.userData;
const parts=Object.entries(meshes).map(([name,mesh])=>({name,mesh,family:families[name],points:surfacePoints(mesh.geometry),solid:solidSurface(mesh.geometry)}));
const topology=parts.map(({name,mesh})=>{
 const {normal:n}=mesh.geometry.attributes,index=mesh.geometry.index,edges=new Map();let volume=0,wrongNormals=0,degenerate=0;
 const faces=surfaceTriangles(mesh.geometry),key=q=>q.toArray().map(v=>Math.round(v*1e9)).join(',');
 for(let i=0;i<faces.length;i++){const{a,b,c}=faces[i],cross=b.clone().sub(a).cross(c.clone().sub(a));
  if(cross.lengthSq()<1e-22){degenerate++;continue;}volume+=a.dot(b.clone().cross(c))/6;
  const normal=new THREE.Vector3();for(let j=0;j<3;j++)normal.add(new THREE.Vector3().fromBufferAttribute(n,index?index.getX(i*3+j):i*3+j));
  if(cross.dot(normal)<=0)wrongNormals++;
  const keys=[a,b,c].map(key);for(let j=0;j<3;j++){const from=keys[j],to=keys[(j+1)%3];if(from===to)continue;const k=from<to?`${from}/${to}`:`${to}/${from}`,e=edges.get(k)??{count:0,direction:0};e.count++;e.direction+=from<to?1:-1;edges.set(k,e);}
 }
 return{name,triangles:faces.length,volume,wrongNormals,degenerate,badEdges:[...edges.values()].filter(e=>e.count!==2||e.direction!==0).length};
});
const pairs=[];for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(parts[i].family!==parts[j].family)pairs.push({a:parts[i],b:parts[j],rows:[]});
const phases=new Set(),steps=Number(process.env.PROBE_STEPS??16),span=p.gammaStart-p.gammaEnd;
for(let i=0;i<=steps;i++)phases.add(span*i/steps);for(let i=0;i<17;i++)phases.add(Math.PI*2*i/17);
for(const edge of [0,p.gammaStart-p.gammaTipStart,span])for(const delta of [-.001,-.00001,0,.00001,.001])phases.add(edge+delta);
let pose=0;
for(const phase of [...phases].sort((a,b)=>a-b)){
 const time=(p.sourceGamma-p.gammaStart+phase)/p.inputSpeed;m.update(time);m.root.updateMatrixWorld(true);
 for(const pair of pairs){const{a,b}=pair;let checks=0,inside=0,maximumDepth=0;
  const boxA=a.solid.box.clone().applyMatrix4(a.mesh.matrixWorld),boxB=b.solid.box.clone().applyMatrix4(b.mesh.matrixWorld);
  if(boxA.intersectsBox(boxB))for(const[from,to]of[[a,b],[b,a]]){const matrix=to.mesh.matrixWorld.clone().invert().multiply(from.mesh.matrixWorld);
   for(const point of from.points){checks++;const q=point.clone().applyMatrix4(matrix);if(!to.solid.inside(q))continue;const depth=to.solid.distance(q);if(depth<=1e-6)continue;inside++;maximumDepth=Math.max(maximumDepth,depth);}}
  pair.rows.push({time,phase,checks,inside,maximumDepth});
 }
 console.log({pose:pose++,phase,stage:m.root.userData.kinematics.stage,inside:pairs.reduce((s,pair)=>s+pair.rows.at(-1).inside,0)});
}
const rows=pairs.map(({a,b,rows})=>({pair:[a.name,b.name],rows}));
const summary={poses:pose,pairs:rows.length,checks:rows.reduce((s,p)=>s+p.rows.reduce((s,r)=>s+r.checks,0),0),inside:rows.reduce((s,p)=>s+p.rows.reduce((s,r)=>s+r.inside,0),0),topologyIssues:topology.filter(r=>r.volume<=0||r.wrongNormals||r.badEdges).length,
 affectedPairs:rows.filter(p=>p.rows.some(r=>r.inside)).map(p=>({pair:p.pair,inside:p.rows.reduce((s,r)=>s+r.inside,0),maximumDepth:Math.max(...p.rows.map(r=>r.maximumDepth))}))};
const files=['scripts/lib/tappet-stop-candidate.mjs','scripts/lib/tappet-stop-study.mjs','scripts/probe-tappet-stop-candidate.mjs'];
const report={movement:65,status:'isolated-candidate-diagnostic',productionChanged:false,method:'All independent rigid-family pairs; actual Float32 triangle vertices, edge midpoints and centers in both directions, conservative transformed-box rejection. Full turn plus denser indexing and contact-transition samples. All physical solids checked for oriented edge pairing, positive volume and outward normals. Same-family fixed or integral joins are permitted.',parameters:p,hashes:Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')]))),topology,summary,pairs:rows};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/065-candidate-initial-hardware.json',JSON.stringify(report,null,2)+'\n');console.log(summary);
if(summary.inside||summary.topologyIssues)process.exitCode=1;
