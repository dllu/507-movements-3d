import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {makeReciprocatingPawlCandidate} from './lib/reciprocating-pawl-candidate.mjs';
const model=makeReciprocatingPawlCandidate(),rows=[];
for(const [name,mesh] of Object.entries(model.root.userData.parts)){
  const g=mesh.geometry,p=g.attributes.position,n=g.attributes.normal,index=g.index,edges=new Map(),parents=[];
  let volume=0,degenerate=0,wrongNormals=0,minimumNormalDot=1;
  const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
      cross=b.clone().sub(a).cross(c.clone().sub(a));
    if(cross.lengthSq()<1e-22){degenerate++;continue;}
    const triangle=parents.length;parents.push(triangle);volume+=a.dot(b.clone().cross(c))/6;
    const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()).normalize(),
      normalDot=cross.normalize().dot(normal);minimumNormalDot=Math.min(minimumNormalDot,normalDot);if(normalDot<0)wrongNormals++;
    const keys=[a,b,c].map(v=>v.toArray().join(','));
    for(let j=0;j<3;j++){
      const from=keys[j],to=keys[(j+1)%3],key=from<to?from+'/'+to:to+'/'+from,
        edge=edges.get(key)??{count:0,orientation:0,triangle};
      parents[find(triangle)]=find(edge.triangle);edge.count++;edge.orientation+=from<to?1:-1;edges.set(key,edge);
    }
  }
  const unmatched=[...edges].filter(([,v])=>v.count!==2||v.orientation!==0);
  rows.push({name,triangles:parents.length,components:new Set(parents.map((_,i)=>find(i))).size,volume,degenerate,wrongNormals,
    minimumNormalDot,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,3),shapes:g.parameters?.shapes?.length});
}
const issues=rows.filter(r=>r.components!==1||r.volume<=0||r.degenerate||r.wrongNormals||r.unmatchedEdges),
  source='scripts/lib/reciprocating-pawl-candidate.mjs',report={movement:75,status:'isolated-corrected-solid-topology',productionChanged:false,rows,issues,
    source:{file:source,sha256:createHash('sha256').update(await readFile(source)).digest('hex')},
    qualification:'Each Float32 mesh is checked for one edge-connected component, closed oppositely oriented edge incidences, positive signed volume, nondegenerate triangles and stored normal agreement. Same-family joins between separate meshes need separate attachment review.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/075-connected-candidate-topology.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:rows.length,issues});if(issues.length)process.exitCode=1;
