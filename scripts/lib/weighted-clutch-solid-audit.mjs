import * as THREE from 'three';

export function inspectWeightedClutchSolid(g){
  const p=g.attributes.position,n=g.attributes.normal,index=g.index,edges=new Map(),parents=[];
  let volume=0,degenerate=0,wrongNormals=0,minimumNormalDot=1,nonfinite=0;
  const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(j=>new THREE.Vector3().fromBufferAttribute(p,j)),
      cross=b.clone().sub(a).cross(c.clone().sub(a));
    if(![...a.toArray(),...b.toArray(),...c.toArray()].every(Number.isFinite)){nonfinite++;continue;}
    if(cross.lengthSq()<1e-22){degenerate++;continue;}
    const triangle=parents.length;parents.push(triangle);volume+=a.dot(b.clone().cross(c))/6;
    const normal=ids.reduce((s,j)=>s.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()).normalize(),
      normalDot=cross.normalize().dot(normal);minimumNormalDot=Math.min(minimumNormalDot,normalDot);if(!(normalDot>=0))wrongNormals++;
    const keys=[a,b,c].map(v=>v.toArray().join(','));
    for(let j=0;j<3;j++){
      const from=keys[j],to=keys[(j+1)%3],key=from<to?from+'/'+to:to+'/'+from,
        edge=edges.get(key)??{count:0,orientation:0,triangle};
      parents[find(triangle)]=find(edge.triangle);edge.count++;edge.orientation+=from<to?1:-1;edges.set(key,edge);
    }
  }
  const unmatched=[...edges].filter(([,v])=>v.count!==2||v.orientation!==0);
  return{triangles:parents.length,components:new Set(parents.map((_,i)=>find(i))).size,volume,degenerate,wrongNormals,nonfinite,
    minimumNormalDot,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,3)};
}
