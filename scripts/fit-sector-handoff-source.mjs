import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/123-fit',input=process.env.SOURCE_REPORT??'/dev/shm/123-source-a.json',s=JSON.parse(fs.readFileSync(input));
const sources=freezeStudySources([input,'scripts/fit-sector-handoff-source.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),result={},profiles=new Map();
const radial=(rs,n,a)=>{const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};
const profile=teeth=>{if(!profiles.has(teeth)){const g=roundedRackGear({teeth,module:1,depth:1,boreRadius:.1,addendum:1,dedendum:1.25,tipRadius:.12,samples:96,cutterSteps:2048});profiles.set(teeth,g.userData.outline.slice(0,96).map(p=>p.length()));g.dispose();}return profiles.get(teeth);};
function fit(g,teeth,center){const rs=profile(teeth),points=g.points.map(([x,y])=>({a:Math.atan2(center[1]-y,x-center[0]),r:Math.hypot(x-center[0],y-center[1])}));let best;
 for(let i=0;i<192;i++){const phase=i*2*Math.PI/teeth/192,unit=points.map(p=>radial(rs,teeth,p.a-phase)),module=points.reduce((sum,p,j)=>sum+p.r*unit[j],0)/unit.reduce((sum,r)=>sum+r*r,0),score=points.reduce((sum,p,j)=>sum+(module*unit[j]-p.r)**2,0)/points.length;if(!best||score<best.score)best={teeth,center,modulePixels:module,phase,score,rms:Math.sqrt(score)};}return best;}
for(const[name,g]of Object.entries(s.gears)){
 const counts=name.endsWith('Sector')?Array.from({length:19},(_,i)=>28+i):Array.from({length:19},(_,i)=>22+i),centered=counts.map(n=>fit(g,n,g.center)).sort((a,b)=>a.score-b.score),refined=[];
 for(const{teeth}of centered.slice(0,4)){let best;for(let dx=-8;dx<=8;dx+=2)for(let dy=-8;dy<=8;dy+=2){const row=fit(g,teeth,[g.center[0]+dx,g.center[1]+dy]);if(!best||row.score<best.score)best=row;}refined.push(best);}
 result[name]={centered,refined:refined.sort((a,b)=>a.score-b.score)};console.log(name,result[name].refined);
}
const rack={};for(const[name,raw]of Object.entries(s.rack)){const points=raw.filter(p=>p[1]<175||p[1]>345),mean=points.reduce((sum,p)=>sum+p[0]/points.length,0);let best;
 for(let pitch=17;pitch<=24;pitch+=.005){let c=0,d=0;for(const[x,y]of points){c+=(x-mean)*Math.cos(2*Math.PI*y/pitch);d+=(x-mean)*Math.sin(2*Math.PI*y/pitch);}const score=Math.hypot(c,d)/points.length;if(!best||score>best.score)best={pitch,phase:Math.atan2(d,c)*pitch/(2*Math.PI),score,points:points.length,mean};}rack[name]=best;
}
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,result,rack,qualification:'Independent radial count/module fits with bounded free centers; rack periodicity from unoccluded top/bottom samples. This does not yet impose equal side-gear ratios, compatible sector/rack meshes or native handoff.'},null,2)+'\n',{flag:'wx'});console.log({rack});
