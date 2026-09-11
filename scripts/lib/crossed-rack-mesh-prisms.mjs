import assert from 'node:assert/strict';
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];

// Read the rendered cap triangulation, including its holes. The independent
// side-face checks establish that these are complete constant-depth prisms.
export function renderedPrism(geometry){
 const p=geometry.attributes.position,index=geometry.index,raw=[],points=[],lookup=new Map(),edges=new Map(),triangles=[];
 let low=Infinity,high=-Infinity,area=0;
 for(let i=0;i<(index?.count??p.count);i+=3){
  const t=[0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return[p.getX(k),p.getY(k),p.getZ(k)];});raw.push(t);
  for(const v of t){low=Math.min(low,v[2]);high=Math.max(high,v[2]);}
 }
 const id=v=>{const key=v[0]+','+v[1];if(!lookup.has(key)){lookup.set(key,points.length);points.push(v.slice(0,2));}return lookup.get(key);};
 for(const t of raw)if(t.every(v=>v[2]===high)){
  const ids=t.map(id),xy=ids.map(i=>points[i]),a=cross(sub(xy[1],xy[0]),sub(xy[2],xy[0]))/2;assert(a>0,'Positive cap triangle');area+=a;
  triangles.push({ids,points:xy,normals:xy.map((v,i)=>{const d=sub(xy[(i+1)%3],v),L=Math.hypot(...d);return[d[1]/L,-d[0]/L];}),
   min:[0,1].map(k=>Math.min(...xy.map(v=>v[k]))),max:[0,1].map(k=>Math.max(...xy.map(v=>v[k])))});
  for(let i=0;i<3;i++){const a=ids[i],b=ids[(i+1)%3],key=Math.min(a,b)+':'+Math.max(a,b),e=edges.get(key)??{a,b,count:0,orientation:0,sideTriangles:0,sideArea:0};
   e.count++;e.orientation+=a<b?1:-1;edges.set(key,e);}
 }
 for(const [key,e]of edges){if(e.count===2){assert.equal(e.orientation,0,'Interior cap orientations');edges.delete(key);}else assert.equal(e.count,1,'Boundary cap incidence');}
 let bottomArea=0;
 for(const t of raw){
  if(t.every(v=>v[2]===high))continue;
  if(t.every(v=>v[2]===low)){const a=cross(sub(t[1],t[0]),sub(t[2],t[0]))/2;assert(a<0);bottomArea-=a;continue;}
  assert(t.every(v=>v[2]===low||v[2]===high),'Only two prism depth levels');
  const ids=Array.from(new Set(t.map(v=>lookup.get(v[0]+','+v[1]))));assert.equal(ids.length,2);assert(ids.every(i=>i!==undefined));
  const key=Math.min(...ids)+':'+Math.max(...ids),e=edges.get(key);assert(e,'Side face matches a cap boundary');
  const a=t[1].map((v,i)=>v-t[0][i]),b=t[2].map((v,i)=>v-t[0][i]),n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
   d=sub(points[e.b],points[e.a]),L=Math.hypot(...d),N=Math.hypot(...n);
  assert(Math.abs(n[2])<1e-15);assert((n[0]*d[1]-n[1]*d[0])/(N*L)>1-1e-12,'Outward side orientation');
  e.sideTriangles++;e.sideArea+=N/2;
 }
 const boundary=Array.from(edges.values()).map(e=>{
  const a=points[e.a],b=points[e.b],d=sub(b,a),length=Math.hypot(...d);assert.equal(e.sideTriangles,2);
  assert(Math.abs(e.sideArea-length*(high-low))<1e-10);
  return{a,b,d,length,square:length*length,normal:[d[1]/length,-d[0]/length],min:a.map((v,k)=>Math.min(v,b[k])),max:a.map((v,k)=>Math.max(v,b[k]))};
 });
 const boundaryArea=boundary.reduce((s,e)=>s+cross(e.a,e.b)/2,0);
 assert(Math.abs(area-bottomArea)<1e-10);assert(Math.abs(area-boundaryArea)<1e-10);assert(high>low);
 return{points,triangles,boundary,radii:points.map(v=>Math.hypot(...v)),low,high,
  validation:{vertices:points.length,triangles:triangles.length,boundaryEdges:boundary.length,area,bottomArea,boundaryArea,low,high,passed:true}};
}

export function boundaryCone(prism,point,target,tolerance=2e-7){
 const normals=[];let distance=Infinity;
 for(const e of prism.boundary){
  if(point.some((v,k)=>v<e.min[k]-tolerance||v>e.max[k]+tolerance))continue;
  const delta=sub(point,e.a),f=Math.max(0,Math.min(1,(delta[0]*e.d[0]+delta[1]*e.d[1])/e.square)),
   d=Math.hypot(...delta.map((v,k)=>v-f*e.d[k]));distance=Math.min(distance,d);
  if(d<=tolerance&&!normals.some(n=>n[0]*e.normal[0]+n[1]*e.normal[1]>1-1e-12))normals.push(e.normal);
 }
 let residual=Infinity;
 for(let i=0;i<normals.length;i++){
  const a=normals[i],weight=Math.max(0,a[0]*target[0]+a[1]*target[1]);residual=Math.min(residual,Math.hypot(...target.map((v,k)=>v-weight*a[k])));
  for(let j=i+1;j<normals.length;j++){
   const b=normals[j],det=cross(a,b);if(Math.abs(det)<1e-12)continue;
   const wa=cross(target,b)/det,wb=cross(a,target)/det;if(wa< -1e-8||wb< -1e-8)continue;
   residual=Math.min(residual,Math.hypot(...target.map((v,k)=>v-Math.max(0,wa)*a[k]-Math.max(0,wb)*b[k])));
  }
 }
 return{distance,residual,faces:normals.length};
}
