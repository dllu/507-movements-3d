// Bounded configuration-space paths. These prescribe clear return/drop motion;
// they are not a force or passive spring simulation. Node18+ and npm deps.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createAuthoredIntermittentMovement as create} from '../src/simulation/authored-intermittent.js';
const d=create({id:235}).root.userData,g=d.geometry,N=1000,step=.006,low=-200,high=150,width=high-low+1,K=20,limit=Math.floor(K/N/step),margin=.00035;
const nominal=d.nominalStateAtCycleCoordinate??d.stateAtCycleCoordinate;
const midStates=Array.from({length:N+1},(_,i)=>[.25,.5,.75].map(f=>nominal((Math.max(1,i)-1+f)/N)));
const outline=d.blocks.ratchet.userData.profilePoints.filter((p,i,a)=>!i||p.distanceTo(a[i-1])>1e-8);
function clearance(s,delta,kind){
 const angle=kind==='tappet'?s.carrierAngle+g.tappetRestRelativeAngle+delta:g.holdingClickRestAngle+delta;
 const pivot=kind==='tappet'?s.tappetHinge:g.holdingClickPivot,length=kind==='tappet'?g.tappetLength:g.holdingClickLength;
 const x=pivot.x+length*Math.cos(angle),y=pivot.y+length*Math.sin(angle),c=Math.cos(s.wheelAngle),v=Math.sin(s.wheelAngle),px=x*c+y*v,py=-x*v+y*c;let best=Infinity,inside=false;
 for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[j],b=outline[i],dx=b.x-a.x,dy=b.y-a.y,u=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/(dx*dx+dy*dy)));best=Math.min(best,Math.hypot(px-a.x-u*dx,py-a.y-u*dy));if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;}
 return (inside?-best:best)-(kind==='tappet'?g.tappetNoseRadius:g.holdingClickRadius);
}
const states=Array.from({length:N+1},(_,i)=>(d.nominalStateAtCycleCoordinate??d.stateAtCycleCoordinate)(i/N));
// The flat tappet hook and holding click share the star's plane, so the whole
// plate outline (not only the nose circle) must clear the star. Only outline
// points that can reach the star's tip circle are tested.
const bodies={tappet:d.blocks.tappetBody,holding:d.blocks.holdingClickBody};
const rings=Object.fromEntries(Object.entries(bodies).map(([k,m])=>{const polygons=m.geometry.userData.plate.polygons;assert.equal(polygons.length,1,`${k} is one plate`);return[k,polygons[0][0].map(([x,y])=>({x,y}))];}));
const signed=(ring,px,py)=>{let best=Infinity,inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i],dx=b.x-a.x,dy=b.y-a.y,l=dx*dx+dy*dy;if(l<1e-18)continue;const u=Math.max(0,Math.min(1,((px-a.x)*dx+(py-a.y)*dy)/l));best=Math.min(best,Math.hypot(px-a.x-u*dx,py-a.y-u*dy));if((a.y>py)!==(b.y>py)&&px<(b.x-a.x)*(py-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside?-best:best;};
function bodyGap(s,delta,kind){
 const angle=kind==='tappet'?s.carrierAngle+g.tappetRestRelativeAngle+delta:g.holdingClickRestAngle+delta,pivot=kind==='tappet'?s.tappetHinge:g.holdingClickPivot;
 const ca=Math.cos(angle),sa=Math.sin(angle),cw=Math.cos(s.wheelAngle),sw=Math.sin(s.wheelAngle),ring=rings[kind],R=g.ratchetOuterRadius+.02;let gap=Infinity;
 for(const p of ring){const x=pivot.x+ca*p.x-sa*p.y,y=pivot.y+sa*p.x+ca*p.y;if(x*x+y*y>R*R)continue;gap=Math.min(gap,signed(outline,x*cw+y*sw,-x*sw+y*cw));}
 for(const q of outline){const x=q.x*cw-q.y*sw-pivot.x,y=q.x*sw+q.y*cw-pivot.y;gap=Math.min(gap,signed(ring,ca*x+sa*y,-sa*x+ca*y));}
 return gap;
}
function path(kind){
 let costs=new Float64Array(width).fill(Infinity);costs[-low]=0;const parents=[];
 for(let i=1;i<=N;i++){
  const s=states[i],next=new Float64Array(width).fill(Infinity),back=new Int16Array(width).fill(-1);
  const radius=kind==='tappet'?g.tappetNoseRadius:g.holdingClickRadius;
  for(let j=0;j<width;j++){
   const delta=(j+low)*step;
   if((kind==='tappet'&&s.cyclePhase<d.timeline.driveEndPhase||kind==='holding'&&s.cyclePhase>=d.timeline.driveEndPhase||i===N)&&j!==-low)continue;
   const angle=kind==='tappet'?s.carrierAngle+g.tappetRestRelativeAngle+delta:g.holdingClickRestAngle+delta;
   const pivot=kind==='tappet'?s.tappetHinge:g.holdingClickPivot,length=kind==='tappet'?g.tappetLength:g.holdingClickLength;
   const center=pivot.clone().add({x:length*Math.cos(angle),y:length*Math.sin(angle)});
   const gap=Math.min(d.profileClearanceAt(center,radius,s.wheelAngle).clearance,bodyGap(s,delta,kind));
   const seated=delta===0&&(kind==='tappet'?s.cyclePhase<=d.timeline.driveEndPhase:s.cyclePhase===0||s.cyclePhase>=d.timeline.driveEndPhase);
   if(gap < (seated?-1e-10:margin))continue;
   for(let k=Math.max(0,j-limit);k<=Math.min(width-1,j+limit);k++){
    if(!Number.isFinite(costs[k]))continue;
    const previous=(k+low)*step;
    if(midStates[i].some((state,idx)=>clearance(state,previous+(delta-previous)*(idx+1)/4,kind)<-.0001))continue;
    const cost=costs[k]+delta*delta+1.5*(j-k)**2*step*step;
    if(cost<next[j]){next[j]=cost;back[j]=k;}
   }
  }
  if(!next.some(Number.isFinite))throw new Error(`${kind}: no path at ${i/N}`);
  costs=next;parents.push(back);
 }
 assert.ok(Number.isFinite(costs[-low]),`${kind}: no seated closure`);
 const angles=new Array(N+1);let j=-low;angles[N]=0;for(let i=N;i>0;i--){j=parents[i-1][j];angles[i-1]=(j+low)*step;}
 return angles;
}
const data={samples:N+1,step,maximumSlope:limit*step*N,margin,tappet:path('tappet'),holding:path('holding')};
const file=new URL('../src/simulation/baked/star-tappet-paths.js',import.meta.url),output=`// Generated by scripts/generate-star-tappet-paths.mjs.\nexport default ${JSON.stringify(data)};\n`;
if(process.argv.includes('--check'))assert.equal(await readFile(file,'utf8'),output);else await writeFile(file,output);
console.log({bytes:output.length,tappet:[Math.min(...data.tappet),Math.max(...data.tappet)],holding:[Math.min(...data.holding),Math.max(...data.holding)]});
