import fs from 'node:fs';
import * as THREE from 'three';
import {makeTreadleRatchetCandidate} from './lib/treadle-ratchet-candidate.mjs';
import {solidSurface,surfacePoints} from '../tests/helpers/solid-surface.mjs';
const model=makeTreadleRatchetCandidate(),u=model.root.userData,solids=[],contacts=[];
for(const [name,mesh] of Object.entries(u.parts)){
 const g=mesh.geometry,p=g.attributes.position,edges=new Map();let volume=0,degenerate=0;
 for(let i=0;i<(g.index?.count??p.count);i+=3){
  const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,g.index?g.index.getX(i+j):i+j)),
   keys=v.map(q=>q.toArray().map(x=>Math.round(x*1e8)).join(','));
  volume+=v[0].dot(v[1].clone().cross(v[2]))/6;
  if(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).lengthSq()<1e-22)degenerate++;
  for(let j=0;j<3;j++){const a=keys[j],b=keys[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a,row=edges.get(key)??{count:0,sign:0};
   row.count++;row.sign+=a<b?1:-1;edges.set(key,row);}
 }
 solids.push({name,volume,degenerate,openOrInconsistentEdges:[...edges.values()].filter(e=>e.count!==2||e.sign!==0).length});
}
for(const name of ['lowerPawlBody','upperPawlBody']){
 const a=u.parts[name],b=u.parts.ratchetBody,row={name,checks:0,intrusions:0,maximumDepth:0};
 for(const [sample,target] of [[a,b],[b,a]]){
  const solid=solidSurface(target.geometry),matrix=target.matrixWorld.clone().invert().multiply(sample.matrixWorld);
  for(const p of surfacePoints(sample.geometry)){row.checks++;const q=p.clone().applyMatrix4(matrix);
   if(!solid.inside(q))continue;const depth=solid.distance(q);if(depth>1e-6){row.intrusions++;row.maximumDepth=Math.max(row.maximumDepth,depth);}}
 }
 contacts.push(row);
}
const report={movement:82,status:'first-candidate-source-pose-screen',mechanicsPassed:false,
 topologyPassed:solids.every(s=>s.volume>0&&s.degenerate===0&&s.openOrInconsistentEdges===0),solids,contacts,
 qualification:'Topology of all 35 candidate solids and only the two pawl/wheel pairs at the source pose. No loaded motion or complete interference screen is claimed.'};
fs.writeFileSync('artifacts/review/'+(process.argv[2]??'082-first-candidate')+'-surfaces.json',JSON.stringify(report,null,2)+'\n');console.log(report);
