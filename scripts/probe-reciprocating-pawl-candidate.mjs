import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeReciprocatingPawlCandidate} from './lib/reciprocating-pawl-candidate.mjs';
import {pawlFrictionIntervals} from './lib/reciprocating-pawl-friction-study.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';

const model=makeReciprocatingPawlCandidate(JSON.parse(process.env.GEOMETRY_OPTIONS||'{}')),u=model.root.userData,parts=[],pairs=[];
for(const [name,mesh] of Object.entries(u.parts)){
  const geometry=mesh.geometry.clone(),p=geometry.attributes.position,index=geometry.index,ids=[];let zeroArea=0;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const triangle=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=triangle.map(j=>new THREE.Vector3().fromBufferAttribute(p,j));
    if(b.sub(a).cross(c.sub(a)).lengthSq()<=1e-22)zeroArea++;else ids.push(...triangle);
  }
  geometry.setIndex(ids);parts.push({name,mesh,solid:solidSurface(geometry),points:surfacePoints(geometry),zeroArea});
}
for(let i=0;i<parts.length;i++)for(let j=i+1;j<parts.length;j++)if(u.families[parts[i].name]!==u.families[parts[j].name])
  pairs.push({a:parts[i].name,b:parts[j].name,checks:0,inside:0,maximumDepth:0});
const byName=Object.fromEntries(parts.map(p=>[p.name,p])),phases=[0,.5,1,u.geometry.sourcePhase,...Array.from({length:65},(_,i)=>(i+.271)/65)],
  forces=[];
let low=0,high=Infinity,gravityMaximum=-Infinity;
for(let i=0;i<1297;i++){
  const phase=(i+.457)/1297,state=u.atPhase(phase),range=pawlFrictionIntervals(state,.2);
  low=Math.max(low,range.low);high=Math.min(high,range.high);gravityMaximum=Math.max(gravityMaximum,state.B.gravityMoment,state.H.gravityMoment);
  if(!(range.low<=2.2&&range.high>=2.2))forces.push({phase,low:range.low,high:range.high});
}
for(const phase of phases){
  model.update((phase-u.geometry.sourcePhase)*u.geometry.period);model.root.updateMatrixWorld(true);
  for(const pair of pairs)for(const [nameA,nameB] of [[pair.a,pair.b],[pair.b,pair.a]]){
    const a=byName[nameA],b=byName[nameB],matrix=b.mesh.matrixWorld.clone().invert().multiply(a.mesh.matrixWorld);
    if(!a.solid.box.clone().applyMatrix4(matrix).intersectsBox(b.solid.box))continue;
    for(const sample of a.points){
      pair.checks++;const point=sample.clone().applyMatrix4(matrix);
      if(!b.solid.inside(point))continue;
      const depth=b.solid.distance(point);if(!Number.isFinite(depth))throw new Error('Nonfinite distance');
      if(depth<=1e-6)continue;pair.inside++;
      if(depth>pair.maximumDepth){pair.maximumDepth=depth;pair.witness={phase,from:nameA,to:nameB,point:point.toArray(),depth};}
    }
  }
}
const hash=async file=>({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')}),
  files=await Promise.all(['scripts/lib/reciprocating-pawl-contact-study.mjs','scripts/lib/reciprocating-pawl-friction-study.mjs',
    'scripts/lib/reciprocating-pawl-candidate.mjs','scripts/probe-reciprocating-pawl-candidate.mjs'].map(hash)),
  report={movement:75,status:'isolated-finite-solid-candidate',productionChanged:false,parameters:u.geometry,mass:u.mass,
    poses:phases.length,parts:parts.map(p=>({name:p.name,points:p.points.length,zeroArea:p.zeroArea})),pairs,
    checks:pairs.reduce((s,r)=>s+r.checks,0),inside:pairs.reduce((s,r)=>s+r.inside,0),
    forces:{poses:1297,mu:.2,load:2.2,low,high,gravityMaximum,failures:forces},files,
    qualification:'Every pair of independent rigid families is checked in both directions with actual Float32 mesh vertices, edge midpoints and triangle centers at 69 poses. Bounding boxes skip separated pairs. Zero-area query triangles are omitted. Same-family solid joins are excluded; watertightness and contact gaps are not certified by this penetration sample.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/075-initial-candidate-solids.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:report.poses,checks:report.checks,inside:report.inside,failures:pairs.filter(p=>p.inside),forces:report.forces});
