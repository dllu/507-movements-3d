import * as THREE from 'three';
import {createDiagonalCatchScaffold} from '../authored-diagonal-catches.js';
import {disposeObject3D} from '../dispose-model.js';
import {poly,circle,polygonClipping as clip} from '../finite-plate-geometry.js';
import {convexProfilePieces} from '../mujoco-bench-clamp/profile.js';
import {diagonalCatchProfile,diagonalLatchFinger} from './catch-profile.js';

// Offline position projection of MuJoCo's soft-contact trajectory. This does
// not prescribe latch events or drive either handle: it only separates finite
// contact surfaces by a small clearance, starting from the simulated pose.
export function createDiagonalContactProjector({gap=.00003}={}){
 const model=createDiagonalCatchScaffold({id:181}),g=model.root.userData.geometry,b=model.root.userData.blocks;
 const parts=[];
 const add=(name,body,pivot,polygons)=>{
  const pieces=polygons.map(p=>p[0]).flatMap(ring=>{
   const points=ring.slice(0,-1).map(p=>new THREE.Vector2(...p));
   return convexProfilePieces(points,THREE.ShapeUtils.triangulateShape(points,[]))
    .map(piece=>piece.map(i=>points[i].toArray()));
  });
  parts.push({name,body,pivot,polygons,pieces});
 };
 for(const [side,body]of [['upper',0],['lower',1]]){
  const f=diagonalLatchFinger(side),tip=b[side+'HandleWorkingTip'];
  add(side+'Working',body,f.fit.pivot,clip.union(b[side+'HandleWorkingArm'].children[0].geometry.userData.plate.polygons,
   poly(circle([tip.position.x,tip.position.y],.10,64))));
 }
 for(const [side,body]of [['upper',0],['lower',1]]){
  const f=diagonalLatchFinger(side);add(side+'Finger',body,f.fit.pivot,f.polygons);
 }
 add('catch',2,[0,0],diagonalCatchProfile().polygons);
 add('shoe',3,[0,0],poly([[g.tappetShoeLeftX,-.25],[g.tappetShoeRightX,-.25],
  [g.tappetShoeRightX,.25],[g.tappetShoeLeftX,.25]]));
 disposeObject3D(model.root);
 const pairs=[[0,5],[1,5],[2,4],[3,4]];
 const transform=(part,q,p)=>{
  if(part.body===3)return[p[0],p[1]+q[3]];
  const c=Math.cos(q[part.body]),s=Math.sin(q[part.body]);
  return [part.pivot[0]+c*p[0]-s*p[1],part.pivot[1]+s*p[0]+c*p[1]];
 };
 const posed=q=>parts.map(part=>part.pieces.map(piece=>{
  const points=piece.map(p=>transform(part,q,p));
  return {points,low:[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1]))],
   high:[Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))]};
 }));
 function separatingAxis(a,b){
  const boxGap=Math.max(b.low[0]-a.high[0],a.low[0]-b.high[0],b.low[1]-a.high[1],a.low[1]-b.high[1]);
  if(boxGap>=gap)return {distance:boxGap};
  let best={distance:-Infinity};
  for(const polygon of [a.points,b.points])for(let i=0;i<polygon.length;i++){
   const p=polygon[i],next=polygon[(i+1)%polygon.length],dx=next[0]-p[0],dy=next[1]-p[1],length=Math.hypot(dx,dy);
   if(length<1e-12)continue;
   const n=[-dy/length,dx/length],dot=p=>p[0]*n[0]+p[1]*n[1];
   const av=a.points.map(dot),bv=b.points.map(dot),amax=Math.max(...av),amin=Math.min(...av),bmax=Math.max(...bv),bmin=Math.min(...bv);
   const forward=bmin-amax,backward=amin-bmax;
   if(forward>best.distance)best={distance:forward,normal:n,a:a.points[av.indexOf(amax)],b:b.points[bv.indexOf(bmin)]};
   if(backward>best.distance)best={distance:backward,normal:n.map(v=>-v),a:a.points[av.indexOf(amin)],b:b.points[bv.indexOf(bmax)]};
   if(best.distance>=gap)return best;
  }
  return best;
 }
 function clearance(q){
  const world=posed(q);let worst={distance:Infinity};
  for(const [a,b]of pairs)for(const pa of world[a])for(const pb of world[b]){
   const result=separatingAxis(pa,pb);
   if(result.distance<worst.distance)worst={...result,parts:[a,b]};
  }
  return worst;
 }
 const gradient=(part,point,n)=>part.body===3?n[1]:-(point[1]-part.pivot[1])*n[0]+(point[0]-part.pivot[0])*n[1];
 function project(input,{maxIterations=80}={}){
  const q=[...input];let worst,iterations=0;
  for(;iterations<maxIterations;iterations++){
   worst=clearance(q);if(worst.distance>=gap-1e-9)break;
   const [a,b]=worst.parts.map(i=>parts[i]),j=[0,0,0,0];
   j[a.body]-=gradient(a,worst.a,worst.normal);j[b.body]+=gradient(b,worst.b,worst.normal);
   const norm=j.reduce((s,v)=>s+v*v,0);if(norm<1e-15)break;
   const step=(gap-worst.distance+1e-9)/norm;
   for(let k=0;k<4;k++)q[k]+=step*j[k];
  }
  worst=clearance(q);
  return {q,iterations,gap:worst.distance,converged:worst.distance>=gap-1e-9,correction:q.map((v,i)=>v-input[i])};
 }
 return {parts,pairs,gap,clearance,project,polygons:q=>parts.map(part=>part.polygons.map(p=>p.map(r=>r.map(v=>transform(part,q,v)))))};
}
