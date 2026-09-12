export const cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
export const subtract2=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot2=(a,b)=>a[0]*b[0]+a[1]*b[1];
export const rotate2=(p,q)=>[p[0]*Math.cos(q)-p[1]*Math.sin(q),p[0]*Math.sin(q)+p[1]*Math.cos(q)];
export const signedArea=ring=>ring.reduce((s,p,i)=>s+cross2(p,ring[(i+1)%ring.length]),0)/2;

// Reconstruct the actual extruded Float32 side contours, including holes.
export function nativePlateContours(geometry){
 const p=geometry.attributes.position,index=geometry.index,edges=new Map(),neighbors=new Map(),points=new Map();
 for(let i=0;i<(index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),zs=ids.map(j=>p.getZ(j));
  if(Math.max(...zs)===Math.min(...zs))continue;
  const xy=[...new Map(ids.map(j=>{const q=[p.getX(j),p.getY(j)];return[q.join(','),q];})).entries()];
  if(xy.length!==2)throw Error('Expected a planar extrusion');
  const[a,b]=xy.map(([k])=>k),key=[a,b].sort().join('/');edges.set(key,[a,b]);for(const[k,q]of xy)points.set(k,q);
 }
 for(const[a,b]of edges.values())for(const[x,y]of [[a,b],[b,a]]){if(!neighbors.has(x))neighbors.set(x,[]);neighbors.get(x).push(y);}
 for(const ns of neighbors.values())if(ns.length!==2)throw Error('Nonmanifold native contour');
 const visited=new Set(),rings=[];
 for(const start of neighbors.keys()){
  if(visited.has(start))continue;const ring=[];let previous=null,current=start;
  do{
   if(visited.has(current))throw Error('Joined native contours');visited.add(current);ring.push(points.get(current));
   const next=neighbors.get(current).find(n=>n!==previous);previous=current;current=next;
  }while(current!==start);
  rings.push(signedArea(ring)>0?ring:ring.reverse());
 }
 return rings;
}

export function pointInsidePolygon(p,ring){
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[j],b=ring[i];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}

// All finite vertex/edge events between one fixed polygon and another rotating
// about the origin. Between consecutive events their intersection topology
// cannot change; this avoids a sampled approximation to the angular stops.
export function rotatingContourEvents(fixed,moving){
 const events=[];
 function vertexEdge(vertices,edges,inverse){
  for(let vi=0;vi<vertices.length;vi++)for(let ei=0;ei<edges.length;ei++){
   const p=vertices[vi],a=edges[ei],b=edges[(ei+1)%edges.length],d=subtract2(b,a),length=Math.hypot(...d),
    n=[-d[1]/length,d[0]/length],A=dot2(n,p),B=dot2(n,[-p[1],p[0]]),value=dot2(n,a),radius=Math.hypot(A,B);
   if(Math.abs(value)>radius+1e-13)continue;
   const phase=Math.atan2(B,A),offset=Math.acos(Math.max(-1,Math.min(1,value/radius)));
   for(const raw of [phase-offset,phase+offset]){
    const point=rotate2(p,raw),t=dot2(subtract2(point,a),d)/length**2;
    if(t< -1e-10||t>1+1e-10)continue;
    const angle=Math.atan2(Math.sin(inverse?-raw:raw),Math.cos(inverse?-raw:raw));
    const contact=inverse?p:point,normal=inverse?rotate2(n.map(x=>-x),angle):n,
     gapDerivative=(inverse?-1:1)*cross2(contact,normal);
    events.push({angle,kind:inverse?'wall-vertex-pin-edge':'pin-vertex-wall-edge',vertex:vi,edge:ei,t,point:contact,normal,gapDerivative});
   }
  }
 }
 vertexEdge(moving,fixed,false);vertexEdge(fixed,moving,true);
 return events.sort((a,b)=>a.angle-b.angle);
}
