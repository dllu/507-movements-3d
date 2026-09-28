import fs from 'node:fs';
import os from 'node:os';
import {Worker,isMainThread,parentPort} from 'node:worker_threads';
import * as THREE from 'three';
import {makeSolidWorm} from '../src/simulation/solid-worm.js';
import {faceWorm195Geometry} from '../src/simulation/feed-worm-assembly-parts.js';

// Movement 195's face teeth, cut by the actual worm. The worm's integral
// straight-flanked thread is evaluated analytically (not its triangulated
// display mesh), grown by the running clearance as a true offset of its
// axial section and its end faces, and swept through the synchronised
// worm/wheel phases. At each face point the wheel keeps the material below
// the lowest point the sweep ever reaches: the exact lower envelope h(x,y).
//
// That envelope has three kinds of edge: where the cut leaves the flat top
// land, cliffs where the sweep's silhouette folds (h jumps), and smooth
// regions between. A height grid alone rasterises the first two into stair
// steps, so the bake also records every grid edge's exact crossing of the
// land boundary or of a cliff (bisected to 1e-9 of the edge) with the heights
// on both sides. feed-worm-assembly-parts.js splits each grid cell along
// those crossings, so the rendered land edges and cliff walls follow the true
// curves and the smooth regions shade smoothly.
const p={teeth:24,innerRadius:.84,outerRadius:1.22,back:-.36,clearance:.0035,
 gridInnerRadius:.894,radialSteps:132,angularSteps:112,phaseStep:.04,phaseRange:24};
const pitch=2*Math.PI/p.teeth;

function makeEvaluator(){
 const wormPitch=2*Math.PI*.98/24,worm=makeSolidWorm({length:5*wormPitch,radius:.16,pitch:wormPitch,shaftRadius:.067});
 const g=worm.userData.thread.geometry.userData,lead=wormPitch/(2*Math.PI),c=p.clearance;
 const R=v=>{v=Math.abs(v);return v<=g.tipHalfWidth?g.tipRadius:v>=g.rootHalfWidth?g.rootRadius:
  g.tipRadius+(g.rootRadius-g.tipRadius)*(v-g.tipHalfWidth)/(g.rootHalfWidth-g.tipHalfWidth);};
 // Axial-section outline of the thread grown by the clearance (a Minkowski
 // offset by a disc of radius c), tabulated over one pitch.
 const N=8192,table=new Float64Array(N+1);
 for(let i=0;i<=N;i++){const v=-wormPitch/2+wormPitch*i/N;let best=0;
  for(let k=-256;k<=256;k++){const dw=c*k/256;let w=v+dw;w=((w+wormPitch/2)%wormPitch+wormPitch)%wormPitch-wormPitch/2;best=Math.max(best,R(w)+Math.sqrt(Math.max(0,c*c-dw*dw)));}
  table[i]=best;}
 const Rc=v=>{let s=((v+wormPitch/2)/wormPitch)%1;if(s<0)s+=1;const f=s*N,i=Math.floor(f);return table[i]+(table[Math.min(N,i+1)]-table[i])*(f-i);};
 const tipc=g.tipRadius+c,half=g.length/2+c,turnOffset=Math.PI*worm.userData.turns;
 // The display mesh is cylindricalWormGeometry rotated by pi*turns about its axis.
 const inside=(x,y,z)=>{if(Math.abs(z)>half)return false;const rho=Math.hypot(x,y);if(rho>tipc)return false;
  return rho<=Rc(z-lead*(Math.atan2(y,x)-turnOffset));};
 // The same synchronised pose as the rendered model: wheel frame -> worm thread frame.
 const frame=q=>{worm.userData.rotor.rotation.z=-5*Math.PI+q;worm.updateMatrixWorld(true);
  return new THREE.Matrix4().makeRotationZ(Math.PI/2+q/24).multiply(new THREE.Matrix4().makeTranslation(0,-1.14,0)).multiply(worm.userData.thread.matrixWorld).invert().elements;};
 // Lowest cutter point on the wheel-frame vertical through (px,py). The wheel
 // Z direction is perpendicular to the worm axis, so the line keeps one axial
 // coordinate in the worm frame.
 const lowest=(e,px,py)=>{
  const lx=e[0]*px+e[4]*py+e[12],ly=e[1]*px+e[5]*py+e[13],lz=e[2]*px+e[6]*py+e[14];if(Math.abs(lz)>half)return 0;
  const dx=e[8],dy=e[9],z0=-(lx*dx+ly*dy),d=Math.hypot(lx+z0*dx,ly+z0*dy);if(d>=tipc)return 0;
  const span=Math.sqrt(tipc*tipc-d*d),lo=z0-span,hi=Math.min(0,z0+span);if(lo>hi)return 0;
  const f=z=>inside(lx+z*dx,ly+z*dy,lz);if(f(lo))return lo;
  const steps=Math.max(4,Math.ceil((hi-lo)/.0015));let previous=lo;
  for(let i=1;i<=steps;i++){const z=lo+(hi-lo)*i/steps;if(f(z)){let a=previous,b=z;for(let k=0;k<44;k++){const m=(a+b)/2;if(f(m))b=m;else a=m;}return b;}previous=z;}
  return 0;
 };
 const phases=[];for(let q=-p.phaseRange;q<=p.phaseRange+1e-9;q+=p.phaseStep)phases.push(q);
 const frames=phases.map(frame);
 const height=(x,y)=>{
  let best=0,bestIndex=-1;
  for(let i=0;i<frames.length;i++){const z=lowest(frames[i],x,y);if(z<best){best=z;bestIndex=i;}}
  if(bestIndex<0)return 0;
  // Golden-section refinement of the envelope phase.
  let a=phases[bestIndex]-p.phaseStep,b=phases[bestIndex]+p.phaseStep;const k=(Math.sqrt(5)-1)/2,F=q=>lowest(frame(q),x,y);
  let x1=b-k*(b-a),x2=a+k*(b-a),f1=F(x1),f2=F(x2);
  for(let n=0;n<32;n++){if(f1<f2){b=x2;x2=x1;f2=f1;x1=b-k*(b-a);f1=F(x1);}else{a=x1;x1=x2;f1=f2;x2=a+k*(b-a);f2=F(x2);}}
  return Math.min(best,f1,f2);
 };
 return height;
}
const point=(i,j)=>{const r=p.gridInnerRadius+(p.outerRadius-p.gridInnerRadius)*i/p.radialSteps,a=-pitch/2+pitch*j/p.angularSteps;return[r*Math.cos(a),r*Math.sin(a)];};
// Classify one grid edge a->b (heights ha, hb). Land is exactly zero.
function crossing(height,a,b,ha,hb){
 const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 if((ha===0)!==(hb===0)){
  // Bisect the land boundary; the cut side keeps its limiting height.
  let lo=0,hi=1,hCut=ha===0?hb:ha;
  for(let k=0;k<30;k++){const m=(lo+hi)/2,hm=height(...at(m));
   if(ha===0){if(hm===0)lo=m;else{hi=m;hCut=hm;}}else if(hm===0)hi=m;else{lo=m;hCut=hm;}}
  return ha===0?{t:hi,ha:0,hb:hCut}:{t:lo,ha:hCut,hb:0};
 }
 if(ha===0||Math.abs(ha-hb)<.004)return null;
 // Follow the largest height change down to 1e-9 of the edge: a cliff
 // keeps a finite jump, a steep but continuous wall does not.
 let lo=0,hi=1,hl=ha,hh=hb;
 for(let k=0;k<30;k++){const m=(lo+hi)/2,hm=height(...at(m));if(Math.abs(hm-hl)>=Math.abs(hh-hm)){hi=m;hh=hm;}else{lo=m;hl=hm;}}
 if(Math.abs(hh-hl)<3e-4)return null;
 return{t:(lo+hi)/2,ha:hl,hb:hh};
}
if(!isMainThread){
 const height=makeEvaluator();
 parentPort.on('message',({id,kind,items})=>parentPort.postMessage({id,out:kind==='h'?items.map(([x,y])=>height(x,y)):items.map(([a,b,ha,hb])=>crossing(height,a,b,ha,hb))}));
}else{
 const workers=Math.max(1,Math.min(40,os.cpus().length-2));
 const run=async(kind,items)=>{
  const chunk=Math.max(1,Math.ceil(items.length/(workers*6))),jobs=[];for(let i=0;i<items.length;i+=chunk)jobs.push(i);
  const out=new Array(items.length);let next=0;
  await Promise.all(Array.from({length:Math.min(workers,jobs.length)},()=>new Promise((resolve,reject)=>{
   const w=new Worker(new URL(import.meta.url));
   const go=()=>{if(next>=jobs.length){w.terminate();resolve();return;}const id=next++;w.postMessage({id,kind,items:items.slice(jobs[id],jobs[id]+chunk)});};
   w.on('message',({id,out:o})=>{o.forEach((v,k)=>out[jobs[id]+k]=v);go();});w.on('error',reject);go();
  })));
  return out;
 };
 const R=p.radialSteps,A=p.angularSteps,S=A,grid=[];
 for(let i=0;i<=R;i++)for(let j=0;j<A;j++)grid.push(point(i,j));
 const H=await run('h',grid),h=(i,j)=>H[i*S+((j%A)+A)%A];
 for(let j=0;j<A;j++)if(h(0,j)!==0)throw Error('The grid must start inside the uncut land');
 // Radial edges (i,j)-(i+1,j) and angular edges (i,j)-(i,j+1).
 const edges=[];
 for(let i=0;i<R;i++)for(let j=0;j<A;j++)edges.push(['r',i,j,point(i,j),point(i+1,j),h(i,j),h(i+1,j)]);
 for(let i=0;i<=R;i++)for(let j=0;j<A;j++)edges.push(['a',i,j,point(i,j),point(i,j+1),h(i,j),h(i,j+1)]);
 const found=await run('c',edges.map(e=>e.slice(3)));
 const crossings=[];found.forEach((c,k)=>{if(c){const[kind,i,j]=edges[k];crossings.push([kind==='r'?0:1,i,j,+c.t.toFixed(9),+c.ha.toFixed(7),+c.hb.toFixed(7)]);}});
 // The rendered surface is linear between samples. Where the envelope is
 // strongly curved (the foot of a cliff, the sqrt rise of the tip-cylinder
 // edge) a chord would stand above it and eat the running clearance, so
 // lower the cut grid points until the built surface lies no more than
 // `allowance` above the exact envelope at nine checks per cut cell (each
 // height is lowered by at most 0.012), then smooth that lowering.
 const allowance=.001,checks=[];
 for(let i=0;i<R;i++)for(let j=0;j<A;j++){if([h(i,j),h(i,j+1),h(i+1,j),h(i+1,j+1)].every(x=>x===0))continue;
  for(const u of[.25,.5,.75])for(const v of[.25,.5,.75]){const a=point(i,j),b=point(i,j+1),c=point(i+1,j+1),d=point(i+1,j);
   checks.push([0,1].map(k=>(1-u)*((1-v)*a[k]+v*b[k])+u*((1-v)*d[k]+v*c[k])));}}
 const exact=await run('h',checks);let rounds=0,worst=0,maximumLowering=0;
 // Lowerable heights: cut grid points and the cut side of every crossing.
 const original=new Map(),where=new Map(),pristineH=Float64Array.from(H),pristineC=crossings.map(c=>c.slice());
 const pass=apply=>{
  const key=(x,y,z)=>Math.round(x*1e5)+','+Math.round(y*1e5)+','+Math.round(z*1e6);
  const owners=new Map(),own=(x,y,o)=>{const k=key(x,y,o.get());if(!owners.has(k))owners.set(k,[]);owners.get(k).push(o);};
  for(let i=0;i<=R;i++)for(let j=0;j<=A;j++){const q=point(i,j),n=i*S+(j%A);if(H[n]<0){own(q[0],q[1],{id:'g'+n,get:()=>H[n],set:v=>{H[n]=v;}});if(j<A)where.set('g'+n,q);}}
  crossings.forEach((c,ci)=>{const[kind,i,j,t]=c;for(const jj of[j,j+A]){const a=point(i,jj),b=kind===0?point(i+1,jj):point(i,jj+1),x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
  for(const side of[4,5])if(c[side]<0){own(x,y,{id:'c'+ci+':'+side,get:()=>c[side],set:v=>{c[side]=v;}});if(jj===j)where.set('c'+ci+':'+side,[x,y]);}}});
  const g=faceWorm195Geometry({...p,heights:Array.from(H),crossings}),pos=g.attributes.position,index=g.index.array,cell=.004,buckets=new Map();
  const V=k=>[pos.getX(k),pos.getY(k),pos.getZ(k)];
  for(let f=0;f<index.length;f+=3){const t=[index[f],index[f+1],index[f+2]].map(V),nz=(t[1][0]-t[0][0])*(t[2][1]-t[0][1])-(t[1][1]-t[0][1])*(t[2][0]-t[0][0]);
   if(nz<=1e-12||t.every(q=>q[2]===0))continue;
   const x0=Math.floor(Math.min(...t.map(q=>q[0]))/cell),x1=Math.floor(Math.max(...t.map(q=>q[0]))/cell),y0=Math.floor(Math.min(...t.map(q=>q[1]))/cell),y1=Math.floor(Math.max(...t.map(q=>q[1]))/cell);
   for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){const k=x+','+y;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(t);}}
  const ownerOf=q=>(owners.get(key(q[0],q[1],q[2]))??[])[0];
  let changed=0;worst=0;const want=new Map();
  checks.forEach(([x,y],n)=>{for(const t of buckets.get(Math.floor(x/cell)+','+Math.floor(y/cell))??[]){
   const[a,b,c]=t,det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]),w0=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det,w1=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det,w=[w0,w1,1-w0-w1];
   if(w.some(q=>q<-1e-9))continue;const z=w[0]*a[2]+w[1]*b[2]+w[2]*c[2],excess=z-exact[n];worst=Math.max(worst,excess);if(excess<=allowance)return;
   // Each vertex's owning baked height (matched by position and height).
   const own=t.map(ownerOf);
   const free=own.map((o,m)=>o?w[m]:0),sum=free.reduce((s,q)=>s+q,0);if(sum<.02)return;
   if(!apply)return;const d=(excess-allowance*.5)/sum;own.forEach((o,m)=>{if(o&&free[m]>0)want.set(o.id,{o,d:Math.max(want.get(o.id)?.d??0,d)});});return;}});
  for(const[id,{o,d}]of want){if(!original.has(id))original.set(id,{o,v:o.get()});const next=Math.max(original.get(id).v-.012,o.get()-d);if(next<o.get()-1e-9){o.set(next);changed++;}}
    g.dispose();console.log({round:rounds,apply,worstExcess:worst,changed});return changed;
 };
 for(;rounds<8;rounds++)if(!pass(true))break;
 // Per-point lowering leaves neighbouring points at different depths, which
 // shades as streaks along the steep flanks. Spread each point's lowering
 // over its neighbourhood with a smooth bump (radius ~3 cells, never less
 // than the point's own need) and re-apply it to the exact heights.
 {const radius=.008,need=[...original].map(([id,{o,v}])=>[where.get(id),v-o.get()]).filter(([q,d])=>q&&d>1e-9),rot=[-pitch,0,pitch].map(a=>[Math.cos(a),Math.sin(a)]);
  const spread=([x,y])=>{let L=0;for(const[[ux,uy],d]of need)for(const[c,s]of rot){const dx=c*ux-s*uy-x,dy=s*ux+c*uy-y,r2=(dx*dx+dy*dy)/(radius*radius);if(r2<1)L=Math.max(L,d*(1-r2)*(1-r2));}return L;};
  H.forEach((_,n)=>{H[n]=pristineH[n];});crossings.forEach((c,k)=>{c[4]=pristineC[k][4];c[5]=pristineC[k][5];});
  for(const[id,q]of where){const L=spread(q);if(!L)continue;if(id[0]==='g'){const n=+id.slice(1);H[n]=pristineH[n]-L;}else{const[ci,side]=id.slice(1).split(':').map(Number);crossings[ci][side]=pristineC[ci][side]-L;}}
  maximumLowering=Math.max(...[...where.keys()].map(id=>id[0]==='g'?pristineH[+id.slice(1)]-H[+id.slice(1)]:(([ci,side])=>pristineC[ci][side]-crossings[ci][side])(id.slice(1).split(':').map(Number))));}
 pass(false);
 if(Math.min(...H)<p.back+.02)throw Error('Cutter breaches backing');
 const data={...p,allowance,heights:Array.from(H,x=>+x.toFixed(6)),crossings:crossings.map(([k,i,j,t,ha,hb])=>[k,i,j,t,+ha.toFixed(7),+hb.toFixed(7)])};
 const text=`// Exact swept worm envelope with land and cliff crossings; scripts/generate-face-worm-195.mjs.\nexport default ${JSON.stringify(data)};\n`,file='src/data/face-worm-195.js';
 if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Bake differs');}else fs.writeFileSync(file,text);
 console.log({maximumLowering,worstExcess:worst,samples:H.length,crossings:crossings.length,cliffs:crossings.filter(c=>c[4]!==0&&c[5]!==0).length,min:Math.min(...H),bytes:text.length});
}
