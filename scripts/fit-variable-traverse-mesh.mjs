import fs from 'node:fs';
import {roundedRackGear} from '../src/simulation/coaxial-gear-geometry.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/122-mesh-fit',input=process.env.SOURCE_REPORT??'/dev/shm/122-source-a.json',centersFile=process.env.CENTER_REPORT??'/dev/shm/122-center-fit-a.json',s=JSON.parse(fs.readFileSync(input)),fits=JSON.parse(fs.readFileSync(centersFile));
const sources=freezeStudySources([input,centersFile,'scripts/fit-variable-traverse-mesh.mjs','src/simulation/coaxial-gear-geometry.js','scripts/lib/study-report-io.mjs'],prefix),upper=29,lower=23;
const centers=Object.fromEntries(Object.entries(fits.result).map(([n,r])=>[n,r.candidates[0].center]));
const a=centers.upper,b=centers.lower,distance=Math.hypot(b[0]-a[0],b[1]-a[1]),lineAngle=Math.atan2(a[1]-b[1],b[0]-a[0]),module=2*distance/(upper+lower),rows=[];
const points=Object.fromEntries(Object.entries(s.gears).map(([n,g])=>[n,g.points.map(([x,y])=>({a:Math.atan2(centers[n][1]-y,x-centers[n][0]),r:Math.hypot(x-centers[n][0],y-centers[n][1])}))]));
const radial=(rs,n,a)=>{const t=(((a/(2*Math.PI/n)+.5)%1+1)%1)*96,i=Math.floor(t),f=t-i;return rs[i]*(1-f)+rs[(i+1)%96]*f;};
const outline=(n,addendum,dedendum,profileShift)=>{const g=roundedRackGear({teeth:n,module:1,depth:1,boreRadius:.1,addendum,dedendum,profileShift,tipRadius:.12,samples:96,cutterSteps:2048}),r=g.userData.outline.slice(0,96).map(p=>p.length());g.dispose();return r;};
for(const upperShift of [-.75,-.5,-.25,0])for(const addendum of [.6,.8,1])for(const dedendum of [1,1.25,1.5,1.75]){
 const U=outline(upper,addendum,dedendum,upperShift),L=outline(lower,addendum,dedendum,-upperShift);let best;
 for(let i=0;i<512;i++){
  const upperPhase=i*2*Math.PI/upper/512,lowerPhase=((upper+lower)*lineAngle+lower*Math.PI-upper*upperPhase-Math.PI)/lower;
  const error=(name,rs,n,phase)=>{const es=points[name].map(p=>module*radial(rs,n,p.a-phase)-p.r);return{rms:Math.sqrt(es.reduce((sum,e)=>sum+e*e,0)/es.length),maximum:Math.max(...es.map(Math.abs))};};
  const u=error('upper',U,upper,upperPhase),l=error('lower',L,lower,lowerPhase),score=u.rms*u.rms+l.rms*l.rms;
  if(!best||score<best.score)best={upper,lower,upperShift,lowerShift:-upperShift,modulePixels:module,upperPhase,lowerPhase,addendum,dedendum,upperError:u,lowerError:l,score};
 }rows.push(best);
}
rows.sort((a,b)=>a.score-b.score);verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,centers,distance,lineAngle,candidates:rows,qualification:'Compatible 29:23 involute pair at regularized measured gear axes. Equal-and-opposite profile shifts preserve center distance. Radial fitting is followed by actual-edge, native contact and full linkage qualification.'},null,2)+'\n',{flag:'wx'});console.log(rows.slice(0,6));
