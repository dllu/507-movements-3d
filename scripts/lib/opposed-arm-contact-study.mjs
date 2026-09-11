import * as THREE from 'three';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],sub=(a,b)=>a.map((v,i)=>v-b[i]),
 add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
 norm=a=>Math.hypot(...a),unit=a=>scale(a,1/norm(a)),zCross=a=>[-a[1],a[0],0],key=p=>p.join(','),
 mean=points=>scale(points.reduce(add,[0,0,0]),1/points.length);
const axes=values=>{
 const unique=[];
 for(const v of values)if(norm(v)>1e-12){const n=unit(v);if(!unique.some(p=>Math.abs(dot(p,n))>1-1e-10))unique.push(n);}
 return unique;
};
const prism=(top,bottom)=>{
 const vertices=[...bottom,...top],normals=[cross(sub(top[1],top[0]),sub(top[2],top[0])),[0,0,-1]],edges=[];
 for(let i=0;i<top.length;i++){
  const j=(i+1)%top.length,e=sub(bottom[j],bottom[i]),vertical=sub(top[i],bottom[i]);
  normals.push(cross(e,vertical));edges.push(e,sub(top[j],top[i]),vertical);
 }
 return{vertices,normals:axes(normals),edges:axes(edges),minimum:[0,1,2].map(i=>Math.min(...vertices.map(v=>v[i]))),maximum:[0,1,2].map(i=>Math.max(...vertices.map(v=>v[i])))};
};
const mergeConvex=triangles=>{
 const polygons=triangles.map(p=>p.map(v=>v.slice(0,2))),same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
 for(const p of polygons)if(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0)<0)p.reverse();
 let merged=true;
 while(merged){merged=false;
  outer:for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++){
   const a=polygons[i],b=polygons[j];
   for(let ai=0;ai<a.length;ai++)for(let bi=0;bi<b.length;bi++)if(same(a[ai],b[(bi+1)%b.length])&&same(a[(ai+1)%a.length],b[bi])){
    const p=[...Array.from({length:a.length-1},(_,k)=>a[(ai+1+k)%a.length]),...Array.from({length:b.length-1},(_,k)=>b[(bi+1+k)%b.length])];
    if(p.every((v,k)=>{const prev=p[(k+p.length-1)%p.length],next=p[(k+1)%p.length];return(v[0]-prev[0])*(next[1]-v[1])-(v[1]-prev[1])*(next[0]-v[0])>=-1e-12;})){
     polygons[i]=p;polygons.splice(j,1);merged=true;break outer;
    }
   }
  }
 }
 return polygons;
};
const triangles=g=>{
 const p=g.attributes.position,index=g.index,result=[];
 for(let i=0;i<(index?.count??p.count);i+=3)result.push([0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,index?index.getX(i+j):i+j).toArray()));
 return result;
};

export function makeOpposedArmContactStudy(model,{margin=.004}={}){
 const u=model.root.userData,p=u.geometry,wheel=u.parts.wheelBody.geometry.userData.faceRatchet,N=wheel.teeth*wheel.segments,da=2*Math.PI/N,
  cells=Array.from({length:N},()=>[]),pawls={};
 let count=0;
 for(const t of triangles(u.parts.wheelBody.geometry)){
  const n=unit(cross(sub(t[1],t[0]),sub(t[2],t[0])));if(n[2]<.5)continue;
  const c=mean(t),angle=(Math.atan2(c[1],c[0])-p.phase+4*Math.PI)%(2*Math.PI),cell=prism(t,t.map(v=>[v[0],v[1],Math.fround(wheel.back)]));
  cell.id=count++;cell.kind=t.every(v=>Math.abs(v[2]-wheel.web)<1e-7)?'web':'ramp';cells[Math.floor(angle/da)].push(cell);
 }
 for(const name of ['upper','lower']){
  const mesh=u.parts[name+'Pawl'],top=triangles(mesh.geometry).filter(t=>t.every(v=>Math.abs(v[2]-.008)<1e-8)),polygons=mergeConvex(top);
  pawls[name]=polygons.map((v,id)=>({...prism(v.map(p=>[...p,Math.fround(.008)]),v.map(p=>[...p,Math.fround(-.008)])),id}));
 }
 const transform=(local,beta,angle,r,z=0)=>{
  const sb=Math.sin(beta),cb=Math.cos(beta),sa=Math.sin(angle),ca=Math.cos(angle),t=local[1]*cb-local[2]*sb;
  return[ca*(r+local[0])-sa*t,sa*(r+local[0])+ca*t,z+local[1]*sb+local[2]*cb];
 };
 const transformPawl=(part,beta,angle,r)=>{
  const vertices=part.vertices.map(v=>transform(v,beta,angle,r,p.pivotZ));
  return{...part,vertices,normals:part.normals.map(v=>transform(v,beta,angle,0)),edges:part.edges.map(v=>transform(v,beta,angle,0)),
   minimum:[0,1,2].map(i=>Math.min(...vertices.map(v=>v[i]))),maximum:[0,1,2].map(i=>Math.max(...vertices.map(v=>v[i])))};
 };
 // Every SAT axis retains its dependence on the moving pawl orientation.
 // Its derivative is essential for face and edge contacts in three dimensions.
 const separation=(a,b,er)=>{
  let best=null;
  const test=(raw,type,edge=null)=>{
   const length=norm(raw);if(length<1e-10)return true;
   const n=scale(raw,1/length),A=a.vertices.map(v=>dot(v,n)),B=b.vertices.map(v=>dot(v,n)),amin=Math.min(...A),amax=Math.max(...A),bmin=Math.min(...B),bmax=Math.max(...B),
    forward=amin-bmax,backward=bmin-amax,sign=forward>=backward?1:-1,gap=Math.max(forward,backward);
   if(gap>margin)return false;
   if(!best||gap>best.gap){
    const normal=scale(n,sign),pawn=mean(a.vertices.filter((_,i)=>Math.abs(A[i]-(sign>0?amin:amax))<1e-9)),
     wheel=mean(b.vertices.filter((_,i)=>Math.abs(B[i]-(sign>0?bmax:bmin))<1e-9));
    let dPsi=[0,0,0],dBeta=[0,0,0];
    if(type==='pawn'){dPsi=zCross(normal);dBeta=cross(er,normal);}
    if(type==='edge'){
     const derivative=d=>{const du=cross(d,edge.wheel),dn=scale(sub(du,scale(n,dot(n,du))),sign/length);return dn;};
     dPsi=derivative(zCross(edge.pawn));dBeta=derivative(cross(er,edge.pawn));
    }
    best={gap,normal,pawn,wheel,type,dPsi,dBeta};
   }
   return true;
  };
  for(const n of b.normals)if(!test(n,'wheel'))return null;
  for(const n of a.normals)if(!test(n,'pawn'))return null;
  for(const ap of a.edges)for(const bw of b.edges)if(!test(cross(ap,bw),'edge',{pawn:ap,wheel:bw}))return null;
  return best;
 };
 const constraints=(x,k)=>{
  const rows=[],gaps={upper:margin,lower:margin};let tested=0;
  for(const [index,name]of ['upper','lower'].entries()){
   const a=k.arms[name],angle=a.psi-x[0],r=p.arms[name].pivotRadius,P=[r*Math.cos(angle),r*Math.sin(angle),p.pivotZ],er=[Math.cos(angle),Math.sin(angle),0];
   for(const local of pawls[name]){
    const pawn=transformPawl(local,x[index+1],angle,r),angles=pawn.vertices.map(v=>{const t=Math.atan2(v[1],v[0])-angle;return angle+Math.atan2(Math.sin(t),Math.cos(t));}),
     first=Math.floor((Math.min(...angles)-p.phase)/da)-1,last=Math.floor((Math.max(...angles)-p.phase)/da)+1;
    for(let bucket=first;bucket<=last;bucket++)for(const cell of cells[(bucket%N+N)%N]){
     if([0,1,2].some(i=>pawn.minimum[i]-cell.maximum[i]>margin||cell.minimum[i]-pawn.maximum[i]>margin))continue;
     tested++;const s=separation(pawn,cell,er);if(!s)continue;
     const d=sub(s.pawn,s.wheel),dPsi=dot(zCross(s.pawn),s.normal)+dot(s.dPsi,d),dBeta=dot(cross(er,sub(s.pawn,P)),s.normal)+dot(s.dBeta,d),
      J=[-dPsi,index===0?dBeta:0,index===1?dBeta:0];
     gaps[name]=Math.min(gaps[name],s.gap);rows.push({id:name+':'+local.id+':'+cell.id,key:name,pin:local.id,cell:cell.id,cellKind:cell.kind,
      gap:s.gap,J,inputNormalVelocity:dPsi*a.psiVelocity,normal:s.normal,pawn:s.pawn,wheel:s.wheel,axisType:s.type});
    }
   }
  }
  return{rows,gaps,tested};
 };
 return{constraints,cells,pawls,parameters:{margin,cells:count,pieces:Object.fromEntries(Object.entries(pawls).map(([k,v])=>[k,v.length]))},
  qualification:'Actual wheel cap triangles extruded to the wheel back and convex partitions of actual pawl cap triangles. SAT nonpenetration with exact axis derivatives; independent surface, Jacobian and normal-cone verification remains required.'};
}
