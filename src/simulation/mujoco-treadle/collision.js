import * as THREE from 'three';

const cross = (a,b,c) => (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
const key = p => p.join(',');
const edgeKey = (a,b) => [key(a),key(b)].sort().join('/');

// Recover the actual plate boundary. The shaft bores never contact the ratchet,
// so only the exterior is needed for these wheel/pawl collision pairs.
function outerContour(geometry) {
 const p=geometry.attributes.position,index=geometry.index,edges=new Map(),next=new Map(),points=new Map();
 for(let i=0;i<(index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),zs=ids.map(j=>p.getZ(j));
  if(Math.max(...zs)===Math.min(...zs))continue;
  const xy=[...new Map(ids.map(j=>{const q=[p.getX(j),p.getY(j)];return[key(q),q];})).values()];
  if(xy.length!==2)throw Error('Expected an extruded plate');
  edges.set(edgeKey(...xy),xy);xy.forEach(q=>points.set(key(q),q));
 }
 for(const [a,b]of edges.values())for(const [x,y]of [[a,b],[b,a]]){const k=key(x);if(!next.has(k))next.set(k,[]);next.get(k).push(key(y));}
 const visited=new Set(),rings=[];
 for(const start of next.keys()){
  if(visited.has(start))continue;let prev=null,current=start;const ring=[];
  do{visited.add(current);ring.push(points.get(current));const n=next.get(current).find(k=>k!==prev);prev=current;current=n;}while(current!==start);
  const area=THREE.ShapeUtils.area(ring.map(q=>new THREE.Vector2(...q)));rings.push({ring:area>0?ring:ring.reverse(),area:Math.abs(area)});
 }
 return rings.sort((a,b)=>b.area-a.area)[0].ring;
}

function simplify(ring,tolerance) {
 const result=[...ring];let removed=true;
 while(removed){removed=false;for(let i=0;i<result.length&&result.length>3;i++){
  const a=result[(i+result.length-1)%result.length],b=result[i],c=result[(i+1)%result.length],dx=c[0]-a[0],dy=c[1]-a[1],L=dx*dx+dy*dy;
  const t=Math.max(0,Math.min(1,((b[0]-a[0])*dx+(b[1]-a[1])*dy)/L));
  if(Math.hypot(b[0]-a[0]-t*dx,b[1]-a[1]-t*dy)<=tolerance){result.splice(i,1);removed=true;i--;}
 }}return result;
}

export function convexPlatePieces(geometry,tolerance=.0001) {
 const original=outerContour(geometry),outline=simplify(original,tolerance),vertices=outline.map(p=>new THREE.Vector2(...p));
 let cells=THREE.ShapeUtils.triangulateShape(vertices,[]).map(ids=>ids.map(i=>outline[i]));
 cells=cells.map(c=>THREE.ShapeUtils.area(c.map(p=>new THREE.Vector2(...p)))>0?c:c.reverse());
 let changed=true;
 while(changed){changed=false;const owners=new Map();
  search:for(let i=0;i<cells.length;i++)for(let j=0;j<cells[i].length;j++){
   const cell=cells[i],a=cell[j],b=cell[(j+1)%cell.length],k=edgeKey(a,b),other=owners.get(k);
   if(other===undefined){owners.set(k,i);continue;}
   const boundary=new Map();
   for(const poly of [cells[other],cell])for(let n=0;n<poly.length;n++){
    const x=poly[n],y=poly[(n+1)%poly.length],e=edgeKey(x,y);if(boundary.has(e))boundary.delete(e);else boundary.set(e,[x,y]);
   }
   const successors=new Map([...boundary.values()].map(([x,y])=>[key(x),y])),start=boundary.values().next().value[0],merged=[];let q=start;
   do{merged.push(q);q=successors.get(key(q));if(!q||merged.length>boundary.size)break;}while(key(q)!==key(start));
   if(!q||merged.length!==boundary.size||merged.length>64||merged.some((p,n)=>cross(merged[(n+merged.length-1)%merged.length],p,merged[(n+1)%merged.length])< -1e-12))continue;
   cells[other]=merged;cells.splice(i,1);changed=true;break search;
  }
 }
 let maximumBoundaryError=0;
 for(const p of original){let distance=Infinity;for(let i=0;i<outline.length;i++){
  const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy));
 }maximumBoundaryError=Math.max(maximumBoundaryError,distance);}
 geometry.computeBoundingBox();return {cells,outline,maximumBoundaryError,low:geometry.boundingBox.min.z,high:geometry.boundingBox.max.z};
}
