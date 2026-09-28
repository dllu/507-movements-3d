import * as THREE from 'three';
import displaySector from '../data/face-worm-195-mesh.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {markShadows} from './primitives.js';

// The full-resolution tooth sector of 195's face wheel, built from the baked exact
// worm envelope (src/data/face-worm-195.js, passed in by the offline bake and
// the tests) (scripts/generate-face-worm-195.mjs). Each grid cell is split
// along the baked crossings of the land boundary and of the envelope's cliffs,
// so land edges and cliff walls follow the true curves instead of stepping
// with the grid. The cut surface is smooth-shaded with creases, computed over
// the neighbouring sectors too so the instances shade seamlessly; the top
// land, walls and backing are flat or truly cylindrical.
export function faceWorm195Geometry(data){
 const {teeth,innerRadius:RI,outerRadius:RO,back,gridInnerRadius:RG,radialSteps:R,angularSteps:A,heights,crossings}=data;
 const pitch=2*Math.PI/teeth,wrap=j=>((j%A)+A)%A,H=(i,j)=>heights[i*A+wrap(j)];
 const radius=i=>RG+(RO-RG)*i/R,angle=j=>-pitch/2+pitch*j/A;
 const xy=(i,j)=>[radius(i)*Math.cos(angle(j)),radius(i)*Math.sin(angle(j))];
 const cross=new Map();for(const[kind,i,j,t,ha,hb]of crossings)cross.set(kind+':'+i+':'+j,{t,ha,hb});
 // Vertices of the smooth top surface (extended one column each side).
 const verts=[],ids=new Map();
 const vertex=(key,x,y,z)=>{let k=ids.get(key);if(k===undefined){k=verts.length;ids.set(key,k);verts.push([x,y,z]);}return k;};
 const corner=(i,j)=>{const[x,y]=xy(i,j);return{id:vertex('c'+i+':'+j,x,y,H(i,j)),x,y,z:H(i,j)};};
 const faces=[],cellFaces=[];
 const P=k=>verts[k];
 const tri=(a,b,c,wallLow=null)=>{
  if(a===b||b===c||a===c)return;
  const pa=P(a),pb=P(b),pc=P(c),ux=pb[0]-pa[0],uy=pb[1]-pa[1],uz=pb[2]-pa[2],vx=pc[0]-pa[0],vy=pc[1]-pa[1],vz=pc[2]-pa[2];
  let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const area=Math.hypot(nx,ny,nz);if(area<1e-14)return;
  // Top faces point up; walls point to their lower side.
  const flip=Math.abs(nz)>1e-9*area&&!wallLow?nz<0:wallLow?nx*wallLow[0]+ny*wallLow[1]<0:nz<0;
  const face=flip?[a,c,b]:[a,b,c];face.wall=!!wallLow;faces.push(face);
 };
 const lowSide=(from,to)=>[to[0]-from[0],to[1]-from[1]];
 const edge=(kind,i,j,forward,[ax,ay],[bx,by])=>{
  const c=cross.get(kind+':'+i+':'+wrap(j));if(!c)return null;
  const x=ax+(bx-ax)*(forward?c.t:1-c.t),y=ay+(by-ay)*(forward?c.t:1-c.t),key='x'+kind+':'+i+':'+j;
  const a={id:vertex(key+'a',x,y,c.ha),x,y,z:c.ha},b={id:vertex(key+'b',x,y,c.hb),x,y,z:c.hb};
  return forward?{x,y,before:a,after:b}:{x,y,before:b,after:a};
 };
 for(let j=-1;j<=A;j++){
  const first=faces.length;
  // The uncut ring inside the grid.
  {const r=[0,1].map(k=>{const a=angle(j+k);return vertex('ri'+(j+k),RI*Math.cos(a),RI*Math.sin(a),0);});
   const a=corner(0,j).id,b=corner(0,j+1).id;tri(r[0],r[1],b);tri(r[0],b,a);}
  for(let i=0;i<R;i++){
   const c=[corner(i,j),corner(i,j+1),corner(i+1,j+1),corner(i+1,j)];
   const X=[edge(1,i,j,true,[c[0].x,c[0].y],[c[1].x,c[1].y]),edge(0,i,j+1,true,[c[1].x,c[1].y],[c[2].x,c[2].y]),
    edge(1,i+1,j,false,[c[2].x,c[2].y],[c[3].x,c[3].y]),edge(0,i,j,false,[c[3].x,c[3].y],[c[0].x,c[0].y])];
   const k=X.filter(Boolean).length;
   if(!k){
    // Split along the diagonal that keeps the two halves closest to coplanar,
    // so steep strips do not zigzag across the flank.
    const nrm=(a,b,d)=>{const u=[b.x-a.x,b.y-a.y,b.z-a.z],v=[d.x-a.x,d.y-a.y,d.z-a.z],n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;return n.map(q=>q/l);};
    const dot=(p,q)=>p[0]*q[0]+p[1]*q[1]+p[2]*q[2];
    if(dot(nrm(c[0],c[1],c[2]),nrm(c[0],c[2],c[3]))>=dot(nrm(c[1],c[2],c[3]),nrm(c[1],c[3],c[0]))){tri(c[0].id,c[1].id,c[2].id);tri(c[0].id,c[2].id,c[3].id);}
    else{tri(c[1].id,c[2].id,c[3].id);tri(c[1].id,c[3].id,c[0].id);}
    continue;}
   // Runs of corners between consecutive crossings.
   const start=X.findIndex(Boolean),runs=[];let run=null;
   for(let s=0;s<4;s++){const e=(start+s)%4,x=X[e];if(x){if(run)run.push(x.before);run=[x.after];runs.push({points:run,from:x});}run.push(c[(e+1)%4]);}
   run.push(X[start].before);
   runs.forEach((r,m)=>r.to=runs[(m+1)%runs.length].from);
   const mean=pts=>pts.reduce((s,q)=>[s[0]+q.x/pts.length,s[1]+q.y/pts.length,s[2]+q.z/pts.length],[0,0,0]);
   if(k===1){
    const r=runs[0].points,[tx,ty,tz]=mean(r),T=vertex('t'+i+':'+j,tx,ty,tz);
    for(let m=0;m<r.length-1;m++)tri(T,r[m].id,r[m+1].id);
    const Xa=r.at(-1),Xb=r[0],low=Xa.z<Xb.z?r.at(-2):r[1];tri(T,Xa.id,Xb.id,lowSide([Xa.x,Xa.y],[low.x,low.y]));
   }else if(k===2){
    for(const{points:r}of runs)for(let m=1;m<r.length-1;m++)tri(r[0].id,r[m].id,r[m+1].id);
    const[r1,r2]=runs.map(r=>r.points),low=(r1[0].z+r1.at(-1).z<r2[0].z+r2.at(-1).z?r1:r2)[1];
    const mid=[(r1[0].x+r1.at(-1).x)/2,(r1[0].y+r1.at(-1).y)/2],dir=lowSide(mid,[low.x,low.y]);
    tri(r1[0].id,r1.at(-1).id,r2[0].id,dir);tri(r1[0].id,r2[0].id,r2.at(-1).id,dir);
   }else{
    const jx=runs.reduce((s,r)=>s+r.from.x/k,0),jy=runs.reduce((s,r)=>s+r.from.y/k,0);
    const J=runs.map((r,m)=>{const pts=r.points;return vertex('j'+i+':'+j+':'+m,jx,jy,(pts[0].z+pts.at(-1).z)/2);});
    runs.forEach(({points:r},m)=>{for(let n=0;n<r.length-1;n++)tri(J[m],r[n].id,r[n+1].id);});
    runs.forEach(({points:r},m)=>{const next=runs[(m+1)%k].points,end=r.at(-1),lowRun=end.z<next[0].z?r:next,low=lowRun[1]??lowRun[0];
     const dir=lowSide([end.x,end.y],[low.x,low.y]);tri(end.id,J[m],J[(m+1)%k],dir);tri(end.id,J[(m+1)%k],next[0].id,dir);});
   }
  }
  cellFaces.push({j,first,last:faces.length});
 }
 // Crease-aware corner normals over the extended surface.
 const crease=Math.cos(40*Math.PI/180),sheetCrease=Math.cos(80*Math.PI/180),fn=faces.map(([a,b,c])=>{const pa=P(a),pb=P(b),pc=P(c),u=[pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2]],v=[pc[0]-pa[0],pc[1]-pa[1],pc[2]-pa[2]];
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n);return{w:n,u:n.map(x=>x/l)};});
 const around=verts.map(()=>[]);faces.forEach((f,k)=>f.forEach(v=>around[v].push(k)));
 const positions=[],normals=[],index=[],out=new Map();
 const emit=(x,y,z,nx,ny,nz)=>{const key=[x,y,z,nx,ny,nz].map(q=>Math.round(q*1e7)).join();let k=out.get(key);if(k===undefined){k=positions.length/3;out.set(key,k);positions.push(x,y,z);normals.push(nx,ny,nz);}return k;};
 for(const{j,first,last}of cellFaces){if(j<0||j>=A)continue;
  for(let f=first;f<last;f++)index.push(...faces[f].map(v=>{let n=[0,0,0];const u=fn[f].u;
   const wall=faces[f].wall;for(const g of around[v]){const w=fn[g],cos=w.u[0]*u[0]+w.u[1]*u[1]+w.u[2]*u[2];if(g===f||(faces[g].wall===wall&&cos>=(wall?crease:sheetCrease)))n=n.map((q,d)=>q+w.w[d]);}
   const l=Math.hypot(...n);return emit(...P(v),...n.map(q=>q/l));}));
 }
 // Flat and cylindrical closing faces with exact normals.
 const flat=(pts,n)=>{const k=pts.map(q=>emit(...q,...(typeof n==='function'?n(q):n)));return k;};
 const quad=(a,b,c,d,n)=>{const[pa,pb,pc]=[a,b,c],u=[pb[0]-pa[0],pb[1]-pa[1],pb[2]-pa[2]],v=[pc[0]-pa[0],pc[1]-pa[1],pc[2]-pa[2]];
  const g=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];if(Math.hypot(...g)<1e-14)return;
  const nn=typeof n==='function'?n(a):n,ks=flat(g[0]*nn[0]+g[1]*nn[1]+g[2]*nn[2]<0?[a,d,c,b]:[a,b,c,d],n);index.push(ks[0],ks[1],ks[2],ks[0],ks[2],ks[3]);};
 const radial=s=>q=>{const l=Math.hypot(q[0],q[1]);return[s*q[0]/l,s*q[1]/l,0];};
 // Outer rim: the top row with the crossings on its chords.
 const rim=[];for(let j=0;j<A;j++){rim.push(P(corner(R,j).id));const x=edge(1,R,j,true,xy(R,j),xy(R,j+1));if(x)rim.push(P(x.before.id),P(x.after.id));}rim.push(P(corner(R,A).id));
 for(let k=0;k<rim.length-1;k++){const a=rim[k],b=rim[k+1];if(a[0]===b[0]&&a[1]===b[1])continue;quad(a,b,[b[0],b[1],back],[a[0],a[1],back],radial(1));}
 const inner=[];for(let j=0;j<=A;j++){const a=angle(j);inner.push([RI*Math.cos(a),RI*Math.sin(a),0]);}
 for(let k=0;k<A;k++){const a=inner[k],b=inner[k+1];quad(a,b,[b[0],b[1],back],[a[0],a[1],back],radial(-1));}
 // Sector sides: the radial profile down to the backing.
 for(const j of[0,A]){const a=angle(j),t=j?[-Math.sin(a),Math.cos(a),0]:[Math.sin(a),-Math.cos(a),0],prof=[[RI,0]];
  for(let i=0;i<R;i++){prof.push([radius(i),H(i,j)]);const x=edge(0,i,j,true,xy(i,j),xy(i+1,j));if(x){const r=Math.hypot(x.x,x.y);prof.push([r,x.before.z],[r,x.after.z]);}}
  prof.push([RO,H(R,j)]);const loop=[...prof,[RO,back],[RI,back]].filter((q,k,l)=>k===0||q[0]!==l[k-1][0]||q[1]!==l[k-1][1]);
  const ks=flat(loop.map(([r,z])=>[r*Math.cos(a),r*Math.sin(a),z]),t);
  for(const[u,v,w]of THREE.ShapeUtils.triangulateShape(loop.map(([r,z])=>new THREE.Vector2(r,z)),[])){
   const pa=loop[u],pb=loop[v],pc=loop[w],cz=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0]);
   // (r,z) orientation maps to +theta for positive area.
   index.push(...((cz>0)!==(j===A)?[ks[u],ks[v],ks[w]]:[ks[u],ks[w],ks[v]]));}
 }
 // Backing annulus sector, including every rim crossing.
 {const loop=[...rim.map(q=>[q[0],q[1]]),...inner.slice().reverse().map(q=>[q[0],q[1]])].filter((q,k,l)=>k===0||q[0]!==l[k-1][0]||q[1]!==l[k-1][1]);
  const ks=flat(loop.map(([x,y])=>[x,y,back]),[0,0,-1]);
  for(const[u,v,w]of THREE.ShapeUtils.triangulateShape(loop.map(([x,y])=>new THREE.Vector2(x,y)),[])){
   const pa=loop[u],pb=loop[v],pc=loop[w],cz=(pb[0]-pa[0])*(pc[1]-pa[1])-(pb[1]-pa[1])*(pc[0]-pa[0]);index.push(...(cz<0?[ks[u],ks[v],ks[w]]:[ks[u],ks[w],ks[v]]));}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(index);
 const{heights:_h,crossings:_c,...meta}=data;g.userData={profile:'exact-worm-envelope-face-sector',...meta,crossingCount:crossings.length};return g;
}
// The displayed sector: the dense sector adaptively simplified offline
// (scripts/bake-face-worm-195-mesh.mjs) to a few thousand triangles, dense
// only where the surface bends or creases. Surviving vertices lie on (or
// sink slightly below) the dense surface and keep its corner normals, so
// the look is the dense mesh's at about a twelfth of the triangles.
export function faceWorm195DisplayGeometry(data=displaySector){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(data.normals,3));g.setIndex(data.index);
 const{positions:_p,normals:_n,index:_i,...meta}=data;g.userData={profile:'adaptive-exact-worm-envelope-face-sector',...meta};return g;
}
function bored(mesh,radius,bore,length,replaced){
 replaced.add(mesh.geometry);
 mesh.geometry=boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64);mesh.userData.boreRadius=bore;
}
function mark(mesh,z,replaced,length=.42){replaced.add(mesh.geometry);mesh.geometry=new THREE.BoxGeometry(length,.045,.003);mesh.position.z=z;}
export function correctFeedWormAssembly(root,id){
 const d=root.userData,b=d.blocks;
 const journals=[],replaced=new Set();
 if(id===195){
  const sector=faceWorm195DisplayGeometry(),face=displaySector;
  for(const side of ['upper','lower']){
   const old=b[side+'WheelBody'],rotor=b[side+'WheelRotor'],sign=side==='upper'?1:-1;
   old.visible=false;for(const groove of b[side+'Grooves'])groove.visible=false;b[side+'VisibleRim'].visible=false;
   const geometry=sign<0?sector.clone().rotateX(Math.PI):sector;
   const body=new THREE.InstancedMesh(geometry,old.material,24),matrix=new THREE.Matrix4();
   for(let i=0;i<24;i++)body.setMatrixAt(i,matrix.makeRotationZ(i*Math.PI/12));
   body.userData.role=side+'-generated-face-worm-wheel';rotor.add(body);b[side+'GeneratedFace']=body;
   // 192 sides: its corners are the display sector's bore-arc vertices
   // (every pitch/8), so the centre and the teeth ring meet without a crack.
   const center=new THREE.Mesh(boredLatheGeometry([{radial:face.innerRadius,axial:-.36},{radial:face.innerRadius,axial:0}],.074,192),old.material);
   const back=new THREE.Mesh(boredLatheGeometry([{radial:face.outerRadius,axial:-.364},{radial:face.outerRadius,axial:-.359}],.074,96),old.material);back.rotation.x=sign*Math.PI/2;rotor.add(back);b[side+'SmoothBack']=back;
   center.rotation.x=Math.PI/2;if(sign<0)center.rotation.x=-Math.PI/2;rotor.add(center);b[side+'BoredCenter']=center;
   // Brown draws the same hub on both wheels: a boss about a quarter of the
   // wheel's radius with an inner circle half that size. It is turned in the
   // wheel's own metal as a boss with a short raised collar on each face.
   {const hub=b[side+'WheelHub'];replaced.add(hub.geometry);hub.material=old.material;
    hub.geometry=boredLatheGeometry([{radial:.16,axial:-.32},{radial:.16,axial:-.28},{radial:.32,axial:-.28},
     {radial:.32,axial:.28},{radial:.16,axial:.28},{radial:.16,axial:.32}],.074,96);hub.userData.boreRadius=.074;}
   back.userData.role=side+'-smooth-back-face';center.userData.role=side+'-bored-wheel-centre';
   journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.073,bore:.074});
   mark(b[side+'Index'],side==='upper'?.0015:.3655,replaced);b[side+'WheelShaft'].scale.z=.4;b[side+'WheelShaft'].position.z=side==='upper'?-.18:.18;
  }
  for(const x of[b.frameFoot,b.framePost,b.lowerBearingArm,b.upperBearingArm,...b.wheelBearings,...b.wormBearings,...b.wormBearingPosts])x.visible=false;
  b.wormIndex.visible=false;
  d.reconstructionNote='Identical face-toothed wheels lie on opposite sides of one screw and turn at equal opposite 24:1 rates. The face teeth are reconstructed from the finite worm sweep. Dimensions, thread section and running clearances are inferred; motion is prescribed and loaded friction/backlash are not solved. Unpictured bearing frames are omitted.';
 }else{
  for(const side of ['left','right']){
   // The generated wheel is bored 0.093 on the 0.092 shaft (its running fit).
   // The hub's bore is 0.003 wider, so inside the wheel it is buried in solid
   // metal instead of coinciding with the wheel's bore wall (a flickering
   // double surface).
   bored(b[side+'WheelHub'],.22,.096,.70,replaced);journals.push({shaft:b[side+'WheelShaft'],part:b[side+'WheelHub'],radius:.092,bore:.096});
   mark(b[side+'WheelIndex'],.1915,replaced,.36);b[side+'WheelShaft'].scale.z=.4;b[side+'WheelShaft'].position.z=0;
  }
  for(const x of[b.baseRail,...b.baseFeet,...b.wheelBearingPosts,...b.wheelBearings,...b.inputBearingPosts,...b.inputBearings])x.visible=false;
  b.shaftIndex.visible=false;
  d.reconstructionNote='Opposite-hand screws on one shaft turn equal 24-tooth wheels oppositely. Their reconstructed finite flanks retain small running clearance; rotation follows the ideal 24:1 law, without solved friction, load sharing or backlash. Unpictured bearing frames are omitted; full wheels continue the dotted source arcs.';
 }
 for(const geometry of replaced)geometry.dispose();
 d.sourceAnimation={available:false,sourceUrl:`https://507movements.com/mm_${id}.html`,reason:'Official HTML contains no registered add_model/mm_present animation.'};
 d.journalReview=journals;d.hideGround=true;d.cameraFov=8;d.cameraDistanceScale=1.02;d.minimumDisplayCycleSeconds=2*Math.PI/2.4;
 root.updateMatrixWorld(true);const box=new THREE.Box3();root.traverseVisible(o=>{if(o.isMesh){o.geometry.computeBoundingBox();if(o.isInstancedMesh){o.computeBoundingBox();box.union(o.boundingBox.clone().applyMatrix4(o.matrixWorld));}else box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));}for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m)m.fog=false;});
 // Tooth rotations fit within their source outer circle at every phase.
 box.expandByScalar(.08);d.cameraFitBounds=box;markShadows(root);
 return new THREE.Vector3(.15,.12,18);
}
