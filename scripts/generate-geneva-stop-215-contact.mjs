// Rebuild with: node scripts/generate-geneva-stop-215-contact.mjs
// Construction, polygon clipping and bracketed finite-pin roots are offline.
import fs from 'node:fs';
import {createAuthoredIntermittentMovement as make} from '../src/simulation/authored-intermittent.js';
import {poly,circle,capsule,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
const model=make({id:215}),d=model.root.userData,g=d.geometry,source=d.sourceKinematics??d,step=Math.PI/3,cuts=[];
for(let k=-2;k<=2;k++)for(const[start,end]of[[k*2*Math.PI+step,k*2*Math.PI+step+.16],[(k+1)*2*Math.PI-.16,(k+1)*2*Math.PI]]){
 const points=Array.from({length:25},(_,i)=>source.stateAtInputTravel(start+(end-start)*i/24).engagement.pinInStopWheelLocal.toArray());
 for(let i=1;i<points.length;i++)cuts.push(capsule(points[i-1],points[i],g.pinRadius+.00004,64));
}
let regions=clip.difference(poly(g.stopWheelOutline.map(p=>p.toArray())),poly(circle([0,0],.5*g.sourceScale,96)),...cuts);
// Brown draws rounded ears where each concave lock meets a slot mouth. The
// construction leaves a narrow horn (the source animation's small tip arc
// meets the lock arc at a 45-degree corner). Roll a ball of earRadius into
// every horn: the lock arc and the relieved mouth are kept up to their
// tangent points, and only the horn's point is replaced by the ball's arc.
// This runs before the entry roots are solved, so they see the rounded ears.
const earRadius=.13;
function roundHorns(ring,R){
 const n=ring.length-1,pts=ring.slice(0,n),area=pts.reduce((s,p,i)=>{const q=pts[(i+1)%n];return s+p[0]*q[1]-q[0]*p[1];},0),sgn=Math.sign(area);
 const turn=i=>{const a=pts[(i-1+n)%n],b=pts[i],c=pts[(i+1)%n],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]];return sgn*Math.atan2(u[0]*v[1]-u[1]*v[0],u[0]*v[0]+u[1]*v[1]);};
 // Horn points: where a lock arc meets its small tip arc, at source radius
 // 4.814. The terminal sector's own corners are left alone.
 const tips=[];for(let i=0;i<n;i++)if(turn(i)>40*Math.PI/180&&Math.abs(Math.hypot(...pts[i])/g.sourceScale-4.814)<.01)tips.push(i);
 const replace=[];
 for(const i of tips){
  const win=[];for(let k=-600;k<=600;k++)win.push((i+k+n)%n);
  const segDist=c=>{let best=Infinity;for(let k=1;k<win.length;k++){const a=pts[win[k-1]],b=pts[win[k]],dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((c[0]-a[0])*dx+(c[1]-a[1])*dy)/len)):0;best=Math.min(best,Math.hypot(c[0]-a[0]-t*dx,c[1]-a[1]-t*dy));}return best;};
  const inside=c=>{let w=false;for(let k=0;k<n;k++){const a=pts[k],b=pts[(k+1)%n];if((a[1]>c[1])!==(b[1]>c[1])&&c[0]<a[0]+(b[0]-a[0])*(c[1]-a[1])/(b[1]-a[1]))w=!w;}return w;};
  let best=null,bestD=Infinity;const tip=pts[i];
  for(const h of[.004,.0005,.00005]){const c0=best??tip,span=best?h*12:3*R;for(let x=-span;x<=span;x+=h)for(let y=-span;y<=span;y+=h){const c=[c0[0]+x,c0[1]+y],dd=Math.hypot(c[0]-tip[0],c[1]-tip[1]);if(dd>=bestD||segDist(c)<R)continue;if(!inside(c))continue;best=c;bestD=dd;}}
  const dist=k=>Math.hypot(pts[k][0]-best[0],pts[k][1]-best[1]);
  let a=i;while(dist((a-1+n)%n)<dist(a))a=(a-1+n)%n;let b=i;while(dist((b+1)%n)<dist(b))b=(b+1)%n;
replace.push({a,b,c:best});
 }
 const drop=new Set(),insertAfter=new Map();
 for(const{a,b,c}of replace){for(let k=(a+1)%n;k!==b;k=(k+1)%n)drop.add(k);
  let t0=Math.atan2(pts[a][1]-c[1],pts[a][0]-c[0]),t1=Math.atan2(pts[b][1]-c[1],pts[b][0]-c[0]),sw=t1-t0;
  if(sgn>0)while(sw<0)sw+=2*Math.PI;else while(sw>0)sw-=2*Math.PI;
  const m=Math.max(8,Math.ceil(Math.abs(sw)*96));insertAfter.set(a,Array.from({length:m-1},(_,j)=>{const t=t0+sw*(j+1)/m;return[c[0]+R*Math.cos(t),c[1]+R*Math.sin(t)];}));}
 const out=[];for(let k=0;k<n;k++){if(drop.has(k))continue;out.push(pts[k]);if(insertAfter.has(k))out.push(...insertAfter.get(k));}
 console.log({roundedHorns:replace.length,earRadius:R});
 return[...out,out[0]];
}
regions=[[roundHorns(regions[0][0],earRadius),...regions[0].slice(1)]];
let outline=regions[0][0];
function gap(u,a){
 const p=d.pinCenterAtInputTravel(u).sub(g.stopWheelCenter).rotateAround({x:0,y:0},-a);let best=Infinity,inside=false;
 for(let i=1;i<outline.length;i++){const x=outline[i-1],y=outline[i],dx=y[0]-x[0],dy=y[1]-x[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p.x-x[0])*dx+(p.y-x[1])*dy)/len)):0;best=Math.min(best,Math.hypot(p.x-x[0]-t*dx,p.y-x[1]-t*dy));if((x[1]>p.y)!==(y[1]>p.y)&&p.x<x[0]+dx*(p.y-x[1])/dy)inside=!inside;}
 return(inside?-best:best)-g.pinRadius;
}
// Small resisting torque in forward motion selects the lower feasible angle.
// Reverse use of this same branch assumes an assisting preload, not dynamics.
function solve(u){const nominal=source.stopWheelAngleAtInputTravel(u);let low=Math.max(0,nominal-.012),high=nominal;if(gap(u,low)>=0)return low;if(gap(u,high)<-1e-6)throw Error(`Unbracketed pin root ${u}`);for(let i=0;i<30;i++){const mid=(low+high)/2;if(gap(u,mid)<0)low=mid;else high=mid;}return high;}
const entryEnd=.025,entry=Array.from({length:257},(_,i)=>solve(entryEnd*i/256)),tailStart=step-.025,tailEnd=step+.03,blendStart=step+.015,atBlend=solve(blendStart),tail=[];
// The final <=3.3e-5-rad settling uses the existing finite-profile tolerance.
for(let i=0;i<=768;i++){const u=tailStart+(tailEnd-tailStart)*i/768;let angle=solve(u);if(u>blendStart){const x=Math.min(1,(u-blendStart)/(tailEnd-blendStart)),blend=x*x*x*(10+x*(-15+6*x));angle=Math.max(angle,atBlend+(step-atBlend)*blend);}tail.push(angle);}
function convexHull(points){const p=points.map(q=>[q[0],q[1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]),lower=[],upper=[];
 for(const q of p){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),q)<=0)lower.pop();lower.push(q);}
 for(const q of p.reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),q)<=0)upper.pop();upper.push(q);}
 const ring=[...lower.slice(0,-1),...upper.slice(0,-1)];return[[...ring,ring[0]]];}
// The entry rows are solved once, against the first slot, and reused for
// every index. The slot beside the convex terminal sector has a different
// mouth, so the pin's actual entry path (k steps plus the shared entry rows)
// is also relieved in every slot. Cutting only along that path leaves the
// first slot's solved rows valid.
{const entryCuts=[];
 for(let k=1;k<=4;k++){const path=Array.from({length:65},(_,i)=>{const u=k*2*Math.PI+entryEnd*i/64,x=i*4,j=Math.min(255,Math.floor(x)),angle=k*step+entry[j]+(entry[j+1]-entry[j])*(x-j);return{u,angle};});
  if(Math.min(...path.map(({u,angle})=>gap(u,angle)))>=-1e-5)continue;
  // The short entry path is nearly straight, so the convex hull of the pin
  // circles along it is its swept area to within ~2e-4 on the inner side.
  const points=path.flatMap(({u,angle})=>circle(d.pinCenterAtInputTravel(u).sub(g.stopWheelCenter).rotateAround({x:0,y:0},-angle).toArray(),g.pinRadius+.0001,256));
  entryCuts.push(convexHull(points));
  console.log({relievedEntryIndex:k});}
 if(entryCuts.length)regions=clip.difference(regions,clip.union(...entryCuts));
 const area=r=>r.reduce((sum,[x,y],i)=>{const [u,v]=r[(i+1)%r.length];return sum+(x*v-u*y)/2;},0),before=Math.abs(area(outline));
 if(Math.abs(Math.abs(area(regions[0][0]))-before)>.01*before)throw Error('Entry relief changed the outline too much');}
const text='// Generated by scripts/generate-geneva-stop-215-contact.mjs; do not hand edit.\nexport const geneva215ContactData='+JSON.stringify({regions,entry,entryEnd,tail,tailStart,tailEnd})+';\n';
fs.writeFileSync(new URL('../src/simulation/geneva-stop-215-contact-data.js',import.meta.url),text);
console.log({points:outline.length,bytes:text.length});
