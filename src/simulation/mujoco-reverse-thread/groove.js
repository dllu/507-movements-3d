import * as THREE from 'three';
import {smoothPrismNormals} from './normals.js';
const tau=2*Math.PI;
export function reverseThreadLands(f) {
 const values=Array.from({length:f.segments+1},(_,i)=>tau*i/f.segments),n=2*f.lanes+2;
 const allBounds=a=>[...f.boundaries(a),f.bottom,f.ceiling];
 // Insert boundary intersections before forming angular strips, so a crossing
 // opens into the other groove without a collider bridging its opening.
 const samples=values.map(allBounds);
 for(let i=0;i<f.segments;i++)for(let j=0;j<n;j++)for(let k=j+1;k<n;k++) {
  const left=samples[i][j]-samples[i][k],right=samples[i+1][j]-samples[i+1][k];
  if(left*right>=0||Math.max(Math.abs(left),Math.abs(right))<1e-9)continue;
  let lo=values[i],hi=values[i+1];for(let q=0;q<25;q++){const mid=(lo+hi)/2,b=allBounds(mid);if((b[j]-b[k])*left>0)lo=mid;else hi=mid;}
  values.push((lo+hi)/2);
 }
 // Root finding may rediscover a grid angle a few nanoradians away. Dropping
 // the resulting tiny strip leaves two closed radial caps with a microscopic
 // gap. Coalesce the angles first, retaining exact original grid positions.
 const clusters=[];
 for(const a of values.sort((a,b)=>a-b)){const last=clusters.at(-1);if(last&&a-last.at(-1)<1e-7)last.push(a);else clusters.push([a]);}
 const angles=clusters.map(group=>{const a=group.reduce((sum,v)=>sum+v,0)/group.length,grid=tau*Math.round(a*f.segments/tau)/f.segments;return Math.abs(a-grid)<1e-7?grid:Number(a.toFixed(9));});
 angles[0]=0;angles[angles.length-1]=tau;
 const canonical=values=>{const a=[...values],ids=a.map((_,i)=>i).sort((i,j)=>a[i]-a[j]);let first=0;while(first<ids.length){let end=first+1;while(end<ids.length&&a[ids[end]]-a[ids[first]]<1e-7)end++;const y=Math.fround(a[ids[first]]);for(let k=first;k<end;k++)a[ids[k]]=y;first=end;}return a;};
 const cells=[],faces=new Map(),vertexKey=p=>p.map(v=>v.toFixed(9)).join(','),out=[];
 const point=(r,a,y)=>[Math.abs(Math.sin(a))<1e-10?0:r*Math.sin(a),y,Math.abs(Math.cos(a))<1e-10?0:r*Math.cos(a)].map(v=>Math.fround(Number(v.toFixed(9))));
 const addTriangle=(tri,center)=>{
  if(new Set(tri.map(vertexKey)).size!==3)return;
  const a=tri.map(p=>new THREE.Vector3(...p)),normal=new THREE.Vector3().subVectors(a[1],a[0]).cross(new THREE.Vector3().subVectors(a[2],a[0]));
  if(normal.length()<1e-11)return;
  if(normal.dot(new THREE.Vector3(...tri[0]).sub(new THREE.Vector3(...center)))<0)tri=[tri[0],tri[2],tri[1]];
  const key=tri.map(vertexKey).sort().join('/');if(faces.has(key))faces.delete(key);else faces.set(key,tri);
 };
 const addCell=c=>{
  const unique=[...new Map(c.map(p=>[vertexKey(p),p])).values()];
  if(unique.length<4)return;cells.push(unique);
  const center=[0,1,2].map(j=>unique.reduce((s,p)=>s+p[j],0)/unique.length);
  for(const ids of [[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]) {
   const points=[...new Map(ids.map(i=>[vertexKey(c[i]),c[i]])).values()];
   if(points.length===3)addTriangle(points,center);
   else if(points.length===4){const k=points.map(vertexKey),order=k[0]<k[1]&&k[0]<k[2]&&k[0]<k[3]?0:k.indexOf([...k].sort()[0]),p=points.map((_,i)=>points[(i+order)%4]);addTriangle([p[0],p[1],p[2]],center);addTriangle([p[0],p[2],p[3]],center);}
  }
 };
 for(let i=0;i<angles.length-1;i++) {
  const a=angles[i],b=angles[i+1];if(b-a<1e-8)continue;
  const bounds=f.boundaries((a+b)/2),atA=canonical(f.boundaries(a)),atB=canonical(f.boundaries(b)),intervals=Array.from({length:f.lanes},(_,k)=>[2*k,2*k+1]).sort((p,q)=>bounds[p[0]]-bounds[q[0]]),merged=[];
  for(const pair of intervals){const prev=merged.at(-1);if(prev&&bounds[pair[0]]<=bounds[prev[1]]){if(bounds[pair[1]]>bounds[prev[1]])prev[1]=pair[1];}else merged.push([...pair]);}
  const ranges=[];let last=-1;for(const [lo,hi] of merged){ranges.push([last,lo]);last=hi;}ranges.push([last,-2]);
  for(const [lo,hi] of ranges) {
   const level=(arr,id)=>id===-1?f.bottom:id===-2?f.ceiling:arr[id];
   const ys=[atA,atB].map(arr=>[Math.max(f.bottom,level(arr,lo)),Math.min(f.ceiling,level(arr,hi))]);
   if(ys.every(([l,h])=>h-l<1e-10))continue;
   if(ys.some(([l,h])=>h-l< -1e-7))throw Error('Missing groove boundary intersection '+JSON.stringify({a,b,lo,hi,ys,bottom:f.bottom,ceiling:f.ceiling}));
   const nodes=[[f.floor,a,0],[f.radius,a,0],[f.radius,b,1],[f.floor,b,1]];
   for(const ids of [[0,1,2],[0,2,3]])addCell([0,1].flatMap(side=>ids.map(k=>{const [r,angle,end]=nodes[k];return point(r,angle,ys[end][side]);})));
  }
 }
 for(const tri of faces.values())out.push(...tri.flat());
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(out,3));geometry.computeVertexNormals();
 return {geometry:smoothPrismNormals(geometry),cells,angles};
}
