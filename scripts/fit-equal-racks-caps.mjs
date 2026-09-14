import fs from 'node:fs';
import {makeEqualRacksGeometry} from '../src/simulation/mujoco-equal-racks/geometry.js';
import {disposeObject3D} from '../src/simulation/dispose-model.js';
import {freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';
import {equalRacksStudySources} from './lib/equal-racks-study-sources.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-cap-fit',input=process.env.SOURCE_REPORT??'/dev/shm/115-source-a.json',sources=freezeStudySources([...equalRacksStudySources('scripts/fit-equal-racks-caps.mjs'),input],prefix),s=JSON.parse(fs.readFileSync(input)),v=makeEqualRacksGeometry(),f=v.root.userData.profile;
const local=([x,y])=>[(Math.cos(s.tilt)*(x-s.axis[0])+Math.sin(s.tilt)*(s.axis[1]-y))/100,(-Math.sin(s.tilt)*(x-s.axis[0])+Math.cos(s.tilt)*(s.axis[1]-y))/100];
const solve=(a,b)=>{const m=a.map((r,i)=>[...r,b[i]]);for(let i=0;i<b.length;i++){let j=i;for(let k=i+1;k<b.length;k++)if(Math.abs(m[k][i])>Math.abs(m[j][i]))j=k;[m[i],m[j]]=[m[j],m[i]];const d=m[i][i];if(Math.abs(d)<1e-12)throw Error('Singular fit');for(let k=i;k<=b.length;k++)m[i][k]/=d;for(let j=0;j<b.length;j++)if(j!==i){const d=m[j][i];for(let k=i;k<=b.length;k++)m[j][k]-=d*m[i][k];}}return m.map(r=>r.at(-1));};
try{
 const caps={};for(const [name,top,bottom]of [['innerLeft',151,141],['innerRight',386,381]]){
  const hi=local([top,s.axis[1]])[0],lo=local([bottom,s.axis[1]])[0],c0=(hi+lo)/2,c1=(hi-lo)/2;
  const points=s.curves[name].points.map(local).map(([x,y])=>{const t=y/f.rootY,h=Math.sqrt(1-t*t);return{x,y,t,b:[h,t*h,t*t*h],residual:x-c0-c1*t};});
  const a=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>points.reduce((s,p)=>s+p.b[i]*p.b[j],0))),b=Array.from({length:3},(_,i)=>points.reduce((s,p)=>s+p.b[i]*p.residual,0)),c=solve(a,b),residuals=points.map(p=>100*(p.residual-p.b.reduce((s,b,i)=>s+b*c[i],0)));
  caps[name]={coefficients:[c0,c1,...c],rms:Math.sqrt(residuals.reduce((s,e)=>s+e*e,0)/residuals.length),maximum:Math.max(...residuals.map(Math.abs)),points,residuals};
 }
 verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,rootY:f.rootY,caps,qualification:'Least-squares horizontal fit to independent measured inner cap ink midpoints. x=c0+c1*t+sqrt(1-t²)*(c2+c3*t+c4*t²), y=rootY*t. Endpoints fixed from the drawn rack span; roof height adjusted for involute tooth clearance.'},null,2)+'\n',{flag:'wx'});console.log(caps);
}finally{disposeObject3D(v.root);}
