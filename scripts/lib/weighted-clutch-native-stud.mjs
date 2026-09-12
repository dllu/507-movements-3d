const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],sub=(a,b)=>a.map((v,i)=>v-b[i]),
 cross=(a,b)=>a[0]*b[1]-a[1]*b[0],length=p=>Math.hypot(...p),
 rotate=(p,q)=>[p[0]*Math.cos(q)-p[1]*Math.sin(q),p[0]*Math.sin(q)+p[1]*Math.cos(q)];

// Recover the actual Float32 plate boundaries from vertical side triangles.
// The analytic capsule and pre-triangulation shape are not used here.
function meshRings(geometry){
 const p=geometry.attributes.position,index=geometry.index,edges=new Map(),neighbors=new Map(),points=new Map();
 for(let i=0;i<(index?.count??p.count);i+=3){
  const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j),zs=ids.map(j=>p.getZ(j));
  if(Math.max(...zs)===Math.min(...zs))continue;
  const xy=[...new Map(ids.map(j=>{const q=[p.getX(j),p.getY(j)];return[q.join(','),q];})).entries()];
  if(xy.length!==2)throw Error('Stud contact requires an extruded planar side');
  const[a,b]=xy.map(([k])=>k),key=[a,b].sort().join('/');
  edges.set(key,[a,b]);for(const[k,q]of xy)points.set(k,q);
 }
 for(const[a,b]of edges.values())for(const[x,y]of [[a,b],[b,a]]){
  if(!neighbors.has(x))neighbors.set(x,[]);neighbors.get(x).push(y);
 }
 for(const ns of neighbors.values())if(ns.length!==2)throw Error('Nonmanifold planar boundary');
 const visited=new Set(),rings=[];
 for(const start of neighbors.keys()){
  if(visited.has(start))continue;const ring=[];let previous=null,current=start;
  do{
   if(visited.has(current))throw Error('Boundary joins another ring');
   visited.add(current);ring.push(points.get(current));
   const next=neighbors.get(current).find(n=>n!==previous);previous=current;current=next;
  }while(current!==start);
  rings.push(ring);
 }
 return rings;
}
const area=ring=>ring.reduce((sum,p,i)=>sum+cross(p,ring[(i+1)%ring.length]),0)/2;
function convex(ring){
 const polygon=area(ring)<0?[...ring].reverse():ring;
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],c=polygon[(i+2)%polygon.length];
  if(cross(sub(b,a),sub(c,b))< -1e-12)throw Error('Contact patch is not convex');
 }
 return polygon;
}
function clipForward(ring,tangent,minimum){
 const result=[];
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],da=dot(a,tangent)-minimum,db=dot(b,tangent)-minimum;
  if(da>=0)result.push(a);
  if((da>=0)!==(db>=0)){const t=da/(da-db);result.push(a.map((v,j)=>v+t*(b[j]-v)));}
 }
 return result;
}
function axes(polygon){
 return polygon.map((p,i)=>{const d=sub(polygon[(i+1)%polygon.length],p),l=length(d);return[-d[1]/l,d[0]/l];});
}
function interval(polygon,axis){
 let low=Infinity,high=-Infinity;for(const p of polygon){const x=dot(p,axis);low=Math.min(low,x);high=Math.max(high,x);}return[low,high];
}

// Exact separating-axis contact for the native convex upper-arm patch and
// stud exterior. Positive separation is a separating-axis gap, not necessarily
// Euclidean distance; its zero and penetration sign are exact for the polygons.
function separation(a,b){
 let gap=-Infinity,normal;
 for(const axis of [...axes(a),...axes(b)]){
  const[al,ah]=interval(a,axis),[bl,bh]=interval(b,axis),forward=bl-ah,reverse=al-bh;
  if(forward>gap){gap=forward;normal=axis;}
  if(reverse>gap){gap=reverse;normal=axis.map(v=>-v);}
 }
 const ah=interval(a,normal)[1],bl=interval(b,normal)[0],tangent=[-normal[1],normal[0]],
  supportA=a.filter(p=>ah-dot(p,normal)<1e-9),supportB=b.filter(p=>dot(p,normal)-bl<1e-9),
  [al,au]=interval(supportA,tangent),[dl,du]=interval(supportB,tangent),
  t=(Math.max(al,dl)+Math.min(au,du))/2,
  pointA=normal.map((v,i)=>ah*v+t*tangent[i]),pointB=normal.map((v,i)=>bl*v+t*tangent[i]);
 return{gap,normal,pointA,pointB,supportA,supportB,supportTangentGap:Math.max(al,dl)-Math.min(au,du)};
}

export function makeWeightedClutchNativeStud(model){
 const u=model.root.userData,L=u.linkage.parameters,G=L.G,
  upper=u.source.bell.upperEnd.map((v,i)=>(i===0?v-u.source.origin[i]:u.source.origin[i]-v)/u.source.scale-G[i]),
  tangent=upper.map(v=>v/length(upper)),cut=.6,
  gRings=meshRings(u.parts.bellCrankG.geometry),gOuter=gRings.reduce((a,b)=>Math.abs(area(a))>Math.abs(area(b))?a:b),
  patch=convex(clipForward(gOuter,tangent,cut)),
  studRings=meshRings(u.parts.reversingStud.geometry),stud=convex(studRings.reduce((a,b)=>Math.abs(area(a))>Math.abs(area(b))?a:b)),
  E=u.gears.E.position.toArray().slice(0,2),offset=u.geometry.stud,theta0=Math.atan2(offset[1],offset[0]);
 const evaluate=(leverAngle,wheelAngle)=>{
  const bellAngle=u.linkage.atAngle(leverAngle).bellAngle,
   g=patch.map(p=>rotate(p,bellAngle).map((v,i)=>v+G[i])),
   e=stud.map(p=>rotate(p.map((v,i)=>v+offset[i]),wheelAngle).map((v,i)=>v+E[i])),
   s=separation(g,e),forceOnG=s.normal.map(v=>-v),rG=sub(s.pointA,G),rE=sub(s.pointB,E),
   contactLocal=rotate(rG,-bellAngle);
  return{...s,leverAngle,wheelAngle,bellAngle,torqueG:cross(rG,forceOnG),
   derivativeE:cross(rE,s.normal),contactForwardCoordinate:dot(contactLocal,tangent)};
 };
 const root=(leverAngle,analyticTheta,direction)=>{
  const sign=direction==='CCW'?1:direction==='CW'?-1:0;if(!sign)throw Error('Unknown stud direction');
  let outside=analyticTheta-theta0-sign*.005,inside=analyticTheta-theta0+sign*.005;
  if(!(evaluate(leverAngle,outside).gap>0&&evaluate(leverAngle,inside).gap<0))throw Error('Native contact is not bracketed');
  for(let i=0;i<38;i++){const mid=(outside+inside)/2;if(evaluate(leverAngle,mid).gap>0)outside=mid;else inside=mid;}
  const result=evaluate(leverAngle,(outside+inside)/2);
  if(result.contactForwardCoordinate<cut+.2||result.supportTangentGap>1e-7)throw Error('Artificial patch cut or inconsistent support contact');
  return{...result,analyticTheta,angleCorrection:result.wheelAngle-(analyticTheta-theta0),direction};
 };
 return{evaluate,root,parameters:{G,E,offset,theta0,cut,patch,stud,tangent,
  qualification:'Actual Float32 side boundaries; the G upper-arm patch excludes its root below the forward coordinate 0.6. Solved contact points must stay at least 0.2 beyond that artificial cut. The stud bore is excluded because these contacts use its exterior.'}};
}
