import { readFile, writeFile } from 'node:fs/promises';
import * as THREE from 'three';
import { makeMutilatedBevelCandidate } from './lib/mutilated-bevel-candidate.mjs';
import { applySectorRelief, toothChart } from './lib/mutilated-bevel-tooth-relief.mjs';

const reliefFile=process.argv[2]??'artifacts/review/074-continuous-relief-study.json';
const relief=JSON.parse(await readFile(reliefFile,'utf8')),model=makeMutilatedBevelCandidate(relief.parameters);
const originalChart=toothChart(model.root.userData.blocks.driverC.userData.toothMeshes[0].geometry);
applySectorRelief(model,relief);
function audit(geometry,isTooth){
  const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index,edges=new Map();
  const vertex=i=>new THREE.Vector3().fromBufferAttribute(p,i),key=v=>v.toArray().join(',');
  let volume=0,triangles=0,degenerate=0,wrongNormals=0,minimumNormalDot=1,innerMaximumRadius=0,outerMinimumRadius=Infinity,radialFaces=0;
  for(let i=0;i<(index?.count??p.count);i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),[a,b,c]=ids.map(vertex),cross=b.clone().sub(a).cross(c.clone().sub(a));
    if(cross.lengthSq()<1e-22){degenerate++;continue;}
    triangles++;volume+=a.dot(b.clone().cross(c))/6;
    const normal=ids.reduce((sum,j)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,j)),new THREE.Vector3()).normalize();
    const dot=cross.clone().normalize().dot(normal);minimumNormalDot=Math.min(minimumNormalDot,dot);if(dot<0)wrongNormals++;
    const keys=[a,b,c].map(key);
    for(let j=0;j<3;j++){
      const from=keys[j],to=keys[(j+1)%3],name=from<to?from+'/'+to:to+'/'+from,edge=edges.get(name)??{count:0,orientation:0};
      edge.count++;edge.orientation+=from<to?1:-1;edges.set(name,edge);
    }
    if(isTooth){
      const radial=cross.clone().normalize().dot(a.clone().normalize());
      if(radial<-.1)innerMaximumRadius=Math.max(innerMaximumRadius,a.length(),b.length(),c.length());
      else if(radial>.1)outerMinimumRadius=Math.min(outerMinimumRadius,new THREE.Triangle(a,b,c).closestPointToPoint(new THREE.Vector3(),new THREE.Vector3()).length());
      else radialFaces++;
    }
  }
  const unmatched=[...edges].filter(([,e])=>e.count!==2||e.orientation!==0);
  return{triangles,degenerate,volume,minimumNormalDot,wrongNormals,unmatchedEdges:unmatched.length,examples:unmatched.slice(0,4),
    ...(isTooth?{innerMaximumRadius,outerMinimumRadius,radialFaces}:{})};
}
const rows=[],seen=new Map();
for(const [name,gear]of Object.entries(model.root.userData.blocks))for(const mesh of [gear.userData.body,...gear.userData.toothMeshes]){
  if(!seen.has(mesh.geometry))seen.set(mesh.geometry,audit(mesh.geometry,mesh!==gear.userData.body));
  rows.push({name:name+(mesh===gear.userData.body?':body':':tooth:'+mesh.userData.index),...seen.get(mesh.geometry)});
}
const teeth=rows.filter(r=>'innerMaximumRadius'in r),innerMaximumRadius=Math.max(...teeth.map(r=>r.innerMaximumRadius)),
  outerMinimumRadius=Math.min(...teeth.map(r=>r.outerMinimumRadius));
const a=originalChart[0],b=originalChart.at(-1),d=b.map((v,i)=>v-a[i]),length=Math.hypot(...d),attachments=[];
for(const row of relief.relief.rows)for(const [component,rings]of row.polygons.entries()){
  const rootPoints=rings[0].filter(p=>Math.abs(d[0]*(p[1]-a[1])-d[1]*(p[0]-a[0]))/length<2e-8)
    .map(p=>((p[0]-a[0])*d[0]+(p[1]-a[1])*d[1])/length);
  attachments.push({index:row.index,component,rootEdgeLength:rootPoints.length>1?Math.max(...rootPoints)-Math.min(...rootPoints):0});
}
const issues=rows.filter(r=>r.volume<=0||r.degenerate||r.wrongNormals||r.unmatchedEdges),detached=attachments.filter(r=>r.rootEdgeLength<1e-6);
const report={movement:74,status:'isolated-relieved-solid-audit',productionChanged:false,reliefFile,rows,uniqueGeometries:seen.size,issues,attachments,detached,
  commonSphere:{innerMaximumRadius,outerMinimumRadius,radius:(innerMaximumRadius+outerMinimumRadius)/2,radialMargin:(outerMinimumRadius-innerMaximumRadius)/2},
  qualification:'Float32 closed oriented triangle boundary, positive signed volume, stored normal agreement and relieved-component attachment to the original root edge. For each tooth, the maximum norm over inner-cap vertices bounds the entire inner cap; exact closest-point distances bound every outer-cap triangle away from the apex. A sphere between these bounds lies within every tooth radial interval. The ruled side boundary then makes angular footprint overlap a material overlap test, subject to Float32 homothety error and the separate contact tolerance. Axis rotations preserve these radius bounds. This does not audit independent body clearances or contact forces.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/074-relieved-solids.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({solids:rows.length,uniqueGeometries:seen.size,issues:issues.length,detached,commonSphere:report.commonSphere});
if(issues.length||detached.length||outerMinimumRadius-innerMaximumRadius<.01)process.exitCode=1;
