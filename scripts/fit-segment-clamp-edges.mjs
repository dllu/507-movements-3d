import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/120-edge-fit',input=process.env.SOURCE_REPORT??'/dev/shm/120-source-c.json',assembly=process.env.ASSEMBLY_REPORT??'/dev/shm/120-assembly-fit-c.json',s=JSON.parse(fs.readFileSync(input)),f=JSON.parse(fs.readFileSync(assembly));
const sources=freezeStudySources([input,assembly,'scripts/fit-segment-clamp-edges.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix);
const inv=r=>{const t=Math.sqrt(Math.max(0,r*r-1));return t-Math.atan(t);};
function outline(n,m,internal){
 if(!internal){const g=roundedRackGear({teeth:n,module:m,depth:1,boreRadius:.1,addendum:.8,dedendum:1,tipRadius:.12*m,samples:96,cutterSteps:2048}),points=g.userData.outline.map(p=>p.toArray());g.dispose();return points;}
 const R=n*m/2,base=R*Math.cos(Math.PI/9),half=r=>Math.PI/(2*n)-.004*m/R-inv(R/base)+inv(r/base);
 return Array.from({length:n*96},(_,i)=>{const a=(i/96-.5)*2*Math.PI/n,angle=Math.abs(((i%96)/96-.5)*2*Math.PI/n);let lo=R-.8*m,hi=R+m;for(let j=0;j<40;j++){const mid=(lo+hi)/2;if(half(mid)<angle)lo=mid;else hi=mid;}const r=(lo+hi)/2;return[r*Math.cos(a),r*Math.sin(a)];});
}
const readings=name=>{const c=s.contours[name];return c.points.map(([x,y])=>[x-c.center[0],c.center[1]-y]);};
function distances(points,outline,n,phase){
 const co=Math.cos(phase),si=Math.sin(phase),count=outline.length,errors=[];
 for(const [px,py]of points){const x=px*co+py*si,y=-px*si+py*co,center=Math.round((Math.atan2(y,x)/(2*Math.PI/n)+.5)*96);let best=Infinity;
  for(let j=center-96;j<=center+96;j++){const a=outline[((j%count)+count)%count],b=outline[(((j+1)%count)+count)%count],dx=b[0]-a[0],dy=b[1]-a[1],den=dx*dx+dy*dy,t=den?Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/den)):0;best=Math.min(best,(x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2);}errors.push(Math.sqrt(best));
 }return{rms:Math.sqrt(errors.reduce((sum,v)=>sum+v*v,0)/errors.length),maximum:Math.max(...errors)};
}
const candidates={};for(const [name,pinionName,n]of [['external','small',13],['internal','large',23]]){
 const rows=[],internal=name==='internal',pp=readings(pinionName),sp=readings(name);
 for(const row of f.candidates[name].filter(r=>r.pinionTeeth===n||r===f.candidates[name][0])){
  const p=outline(row.pinionTeeth,row.modulePixels,false),q=outline(row.sectorTeeth,row.modulePixels,internal);let best;
  for(let j=-24;j<=24;j++){
   const phase=row.phase+j*.004,sectorPhase=internal?((row.sectorTeeth-row.pinionTeeth)*f.lineAngle+row.pinionTeeth*phase-Math.PI)/row.sectorTeeth:((row.sectorTeeth+row.pinionTeeth)*f.lineAngle+row.pinionTeeth*Math.PI-row.pinionTeeth*phase-Math.PI)/row.sectorTeeth,
    pinion=distances(pp,p,row.pinionTeeth,phase),sector=distances(sp,q,row.sectorTeeth,sectorPhase),score=pinion.rms**2+sector.rms**2;
   if(!best||score<best.score)best={...row,phase,sectorPhase,pinion,sector,score};
  }rows.push(best);
 }candidates[name]=rows.sort((a,b)=>a.score-b.score);console.log(name,candidates[name].slice(0,5));
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,candidates,qualification:'Nearest generated outline segments within one angular tooth pitch of each source point. Refines phases of source-count candidates at fixed measured shaft spacing; source-outline regularization remains explicit. Final rendered triangles and native contacts are separate checks.'},null,2)+'\n',{flag:'wx'});
