// Offline finite cutter envelopes for the prescribed 371/394 kinematics.
// This generates mating solids, not a passive force/contact simulation.
import fs from 'node:fs';
import {createAuthoredMangleWheelMovement as mangle} from '../src/simulation/authored-mangle-wheels.js';
import {createAuthoredParsonsRackMovement as parsons} from '../src/simulation/authored-parsons-racks.js';
const result = {};

{
const d=mangle({id:371}).root.userData,g=d.geometry,mesh=d.blocks.pinion.userData.rotor.children[0],outline=(mesh.userData.sourceOutline ?? mesh.geometry.parameters.shapes.getPoints().map(p=>p.toArray())).map(p=>[...p]);if(outline[0][0]===outline.at(-1)[0]&&outline[0][1]===outline.at(-1)[1])outline.pop();
const cross=(a,b,c,d)=>a*d-b*c;
function inside(x,y){let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
const radialBands=64,angularSamples=128,radii=Array.from({length:radialBands+1},(_,i)=>1.30+.80*i/radialBands),clearance=.0006,samples=9*1024;
const profiles=[];
for(const index of[0,20,40]){
 const theta=g.firstTerminalAngle+index*g.wheelAngularPitch,heights=radii.map(r=>Array.from({length:angularSamples},(_,j)=>{const a=j*2*Math.PI/angularSamples;return 1/Math.hypot(Math.cos(a)/(.5*g.toothTangentialWidth),Math.sin(a)/.14)}));let centers=0;
 for(let k=0;k<=samples;k++){
  const s=d.stateAtInputTravel(k*g.mechanismCycleInputAngle/samples),angle=theta+s.wheelAngle,c=Math.cos(angle),sn=Math.sin(angle),cp=Math.cos(s.pinionAngle),sp=Math.sin(s.pinionAngle),cx=s.pinionCenter.x,cz=s.pinionCenter.z;
  if(Math.abs(g.wheelPitchRadius*sn)>.57)continue;
  for(let band=0;band<radii.length;band++){
   const r=radii[band],ox=cp*cz+sp*r*sn,oy=-sp*cz+cp*r*sn,oz=r*c-cx;
   if(Math.abs(oz)>.4||Math.hypot(ox,oy)>.57)continue;
   const centerInside=inside(ox,oy);if(centerInside&&Math.abs(oz)<g.pinionDepth/2)centers++;
   const edges=[];for(let i=0;i<outline.length;i++){const a=outline[i],b=outline[(i+1)%outline.length];if(Math.max(a[0],b[0])<ox-.15||Math.min(a[0],b[0])>ox+.15||Math.max(a[1],b[1])<oy-.15||Math.min(a[1],b[1])>oy+.15)continue;edges.push([a[0]-ox,a[1]-oy,b[0]-a[0],b[1]-a[1]]);}
   for(let j=0;j<angularSamples;j++){
    const psi=j*2*Math.PI/angularSamples,ct=Math.cos(psi),st=Math.sin(psi),dx=sp*c*ct-cp*st,dy=cp*c*ct+sp*st,dz=-sn*ct;let lo=0,hi=heights[band][j]+clearance;
    if(Math.abs(dz)<1e-12){if(Math.abs(oz)>=g.pinionDepth/2)continue;}else{const a=(-g.pinionDepth/2-oz)/dz,b=(g.pinionDepth/2-oz)/dz;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b));if(lo>=hi)continue;}
    const events=[];for(const[ax,ay,ex,ey]of edges){const den=cross(dx,dy,ex,ey);if(Math.abs(den)<1e-15)continue;const hit=cross(ax,ay,ex,ey)/den,u=cross(ax,ay,dx,dy)/den;if(hit>=0&&hit<=hi&&u>=0&&u<1)events.push(hit);}events.sort((a,b)=>a-b);
    let inPoly=centerInside,entry=0;for(const end of[...events,hi]){if(inPoly&&Math.max(entry,lo)<Math.min(end,hi)){heights[band][j]=Math.max(0,Math.min(heights[band][j],Math.max(entry,lo)-clearance));break;}entry=end;inPoly=!inPoly;}
   }
  }
 }
 const final=heights.map((row,i)=>row.map((v,j)=>Math.min(...[-1,0,1].flatMap(di=>[-1,0,1].map(dj=>heights[Math.max(0,Math.min(radialBands,i+di))][(j+dj+angularSamples)%angularSamples])))-.0009));
 // A conservative coarse loft bounds each retained station by the fine
 // cutter neighborhood. The expensive 64x128 search stays offline; only
 // 32x32 cells per bar are sent to the renderer.
 const coarseRadii=radii.filter((_,i)=>i%2===0);
 const coarseHeights=coarseRadii.map((_,i)=>Array.from({length:32},(_,j)=>Math.min(...[-1,0,1].flatMap(di=>[-2,-1,0,1,2].map(dj=>final[Math.max(0,Math.min(radialBands,2*i+di))][(4*j+dj+angularSamples)%angularSamples])))));
 profiles.push({index,theta,radii:coarseRadii,heights:coarseHeights,angularSamples:32});console.log({index,centers,min:Math.min(...final.flat()),zero:final.flat().filter(x=>x===0).length});
}
result[371]={outline,profiles,clearance,finishingAllowance:.0009,samples};
}
{
const d=parsons({id:394}).root.userData,g=d.geometry,mesh=d.blocks.outputRotor.userData.pinion,outline=(mesh.userData.sourceOutline ?? mesh.geometry.parameters.shapes.getPoints().map(p=>p.toArray())).map(p=>[...p]);if(outline[0][0]===outline.at(-1)[0]&&outline[0][1]===outline.at(-1)[1])outline.pop();
const frames=d.blocks.rackCarrier.userData.pitchCurve,count=46*128,clearance=.0005,root=-.155,stock=.11;
const points=Array.from({length:count},(_,i)=>{const t=i/count,p=frames.getPoint(t),v=frames.getTangent(t),phase=i%128;return{p:[p.x,p.y],n:[-v.y,v.x],h:Math.abs(p.x)<1.85&&Math.abs(v.x)>.99?stock:(phase>=28&&phase<=100?stock:-.105)};});
const edges=outline.map((a,i)=>{const b=outline[(i+1)%outline.length];return[a[0],a[1],b[0]-a[0],b[1]-a[1]];});
for(let k=0;k<=8192;k++){
 const s=d.stateAtTime(8*k/8192),cx=-s.rackPosition.x,cy=-s.rackPosition.y,c=Math.cos(s.outputAngle+g.pinionAngularPitch/2),sn=Math.sin(s.outputAngle+g.pinionAngularPitch/2);
 for(const p of points){if(Math.hypot(p.p[0]-cx,p.p[1]-cy)>1.02)continue;
  const wx=p.p[0]+root*p.n[0]-cx,wy=p.p[1]+root*p.n[1]-cy,ox=c*wx+sn*wy,oy=-sn*wx+c*wy,dx=c*p.n[0]+sn*p.n[1],dy=-sn*p.n[0]+c*p.n[1];let cut=p.h-root;
  for(const[ax,ay,ex,ey]of edges){const det=dx*ey-dy*ex;if(Math.abs(det)<1e-12)continue;const qx=ax-ox,qy=ay-oy,t=(qx*ey-qy*ex)/det,u=(qx*dy-qy*dx)/det;if(t>=0&&t<cut&&u>=0&&u<=1)cut=t;}
  if(cut<p.h-root)p.h=root+cut-clearance;
 }
}
// Restore the source's individual tooth gaps where the cutter never reached
// the initial stock. This leaves all cutter-selected working flanks intact.
for(let i=0;i<count;i++)if(points[i].h>=stock-1e-9&&(i%128<28||i%128>100))points[i].h=-.105;
const heights=points.map((p,i)=>Math.min(p.h,points[(i+count-1)%count].h,points[(i+1)%count].h));
const teeth=Array.from({length:46},(_,j)=>{const pts=Array.from({length:129},(_,i)=>{let k=(j*128+i)%count,p=points[k];return[p.p[0]+heights[k]*p.n[0],p.p[1]+heights[k]*p.n[1]];});for(let k of[(j+1)*128%count,j*128]){const p=points[k];pts.push([p.p[0]-.145*p.n[0],p.p[1]-.145*p.n[1]]);}return pts;});
result[394]={outline,teeth,heights,clearance,samples:8192,mountingPhase:g.pinionAngularPitch/2};
}

// Stable decimal output makes the offline artifact reviewable and reproducible.
const rounded=JSON.parse(JSON.stringify(result,(_,v)=>typeof v==='number'?Math.round(v*1e10)/1e10:v));
const output=`// Generated by scripts/generate-reversing-transmission-profiles.mjs.\nexport default ${JSON.stringify(rounded)};\n`;
const path=new URL('../src/simulation/baked/reversing-transmission-profiles.js',import.meta.url);
if(process.argv.includes('--check')){
 if(fs.readFileSync(path,'utf8')!==output)throw new Error('Reversing profile bake differs');
 console.log('Reversing profile bake is byte-identical.');
}else fs.writeFileSync(path,output);
