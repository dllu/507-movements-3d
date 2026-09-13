import fs from 'node:fs';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {springRatchetSource as source} from './lib/spring-pressed-ratchet-source.mjs';

const file = 'artifacts/reference/brown-073-detail.png', width = 1250, height = 1170;
const prefix = process.env.PROBE_PREFIX ?? '/dev/shm/073-full-profile';
const decoded = spawnSync('convert',[file,'-depth','8','rgb:-'],{maxBuffer:8*1024*1024});
assert.equal(decoded.status,0);assert.equal(decoded.stdout.length,width*height*3);
// Previously counted source corners, now used individually instead of averaged
// into a regular pitch. They are construction measurements, not validation data.
const tips = [[644,330],[799,337],[938,447],[977,610],[920,756],[793,843],[635,846],[506,762],[444,600],[497,432]];
const roots = [[650,390],[786,389],[889,468],[929,605],[870,719],[784,784],[650,795],[555,731],[495,600],[538,465]];
const turn=2*Math.PI,mod=x=>(x%turn+turn)%turn;
const angle=p=>Math.atan2(p[1]-source.center[1],p[0]-source.center[0]);
const bezier=(p,t)=>[0,1].map(k=>(1-t)**3*p[0][k]+3*(1-t)**2*t*p[1][k]+3*(1-t)*t*t*p[2][k]+t**3*p[3][k]);
const nearest=(curve,p)=>{
  let low=0,high=1;const loss=t=>bezier(curve,t).reduce((s,x,k)=>s+(x-p[k])**2,0);
  for(let i=0;i<45;i++){const a=(2*low+high)/3,b=(low+2*high)/3;if(loss(a)<loss(b))high=b;else low=a;}
  const t=(low+high)/2;return {t,distance:Math.sqrt(loss(t))};
};
const read = a => {
  let start=null;const intervals=[];
  for(let r=.65*source.scale;r<=1.09*source.scale;r+=.25){
    const x=Math.round(source.center[0]+r*Math.cos(a)),y=Math.round(source.center[1]+r*Math.sin(a));
    const dark=decoded.stdout[3*(y*width+x)]<100;
    if(dark&&start===null)start=r;
    if(!dark&&start!==null){const radius=(start+r-.25)/2;intervals.push({radius,thickness:r-.25-start,
      point:[source.center[0]+radius*Math.cos(a),source.center[1]+radius*Math.sin(a)]});start=null;}
  }
  return intervals;
};
const arcs=tips.map((tip,i)=>{
  const root=roots[(i+1)%10],start=angle(tip),span=mod(angle(root)-start),training=[],validation=[];
  assert(span>.3&&span<.9);
  const midpoint=tip.map((v,k)=>(v+root[k])/2),delta=root.map((v,k)=>v-tip[k]),chord=Math.hypot(...delta),normal=[-delta[1]/chord,delta[0]/chord];
  // Use the counted endpoints and a rough common curvature only to select
  // the nearby outline stroke among lettering. Reserve those selected odd
  // rays before fitting; do not reselect them against the fitted result.
  const roughCenter=midpoint.map((v,k)=>v+180*normal[k]-source.center[k]),roughRadius=Math.hypot(chord/2,180);
  for(let j=0;j<160;j++){
    const a=start+.06+(span-.12)*(j+.5)/160,intervals=read(a);assert(intervals.length,'Missing source ray');
    const projection=roughCenter[0]*Math.cos(a)+roughCenter[1]*Math.sin(a);
    const predicted=projection+Math.sqrt(roughRadius**2-roughCenter[0]**2-roughCenter[1]**2+projection**2);
    const r=intervals.reduce((best,r)=>Math.abs(r.radius-predicted)<Math.abs(best.radius-predicted)?r:best);
    (j%2?validation:training).push({angle:a,predicted,intervals,...r});
  }
  const fit=offset=>{const center=midpoint.map((v,k)=>v+offset*normal[k]),radius=Math.hypot(chord/2,offset);
    const residuals=training.map(r=>Math.hypot(...r.point.map((v,k)=>v-center[k]))-radius);
    return {center,radius,loss:residuals.reduce((s,r)=>s+r*r,0)};};
  let best=0;for(let offset=0;offset<=1200;offset+=5)if(fit(offset).loss<fit(best).loss)best=offset;
  let low=Math.max(0,best-5),high=best+5;
  for(let j=0;j<70;j++){const a=(2*low+high)/3,b=(low+2*high)/3;if(fit(a).loss<fit(b).loss)high=b;else low=a;}
  const fitted=fit((low+high)/2),errors=validation.map(r=>Math.hypot(...r.point.map((v,k)=>v-fitted.center[k]))-fitted.radius);
  let parameters=training.map((_,j)=>(j+.5)/training.length),curve;
  for(let iteration=0;iteration<100;iteration++){
    let aa=0,ab=0,bb=0;const ay=[0,0],by=[0,0];
    parameters.forEach((t,j)=>{
      const a=3*(1-t)**2*t,b=3*(1-t)*t*t;aa+=a*a;ab+=a*b;bb+=b*b;
      for(let k=0;k<2;k++){const residual=training[j].point[k]-(1-t)**3*tip[k]-t**3*root[k];ay[k]+=a*residual;by[k]+=b*residual;}
    });
    const determinant=aa*bb-ab*ab;
    curve=[tip,ay.map((v,k)=>(v*bb-by[k]*ab)/determinant),by.map((v,k)=>(v*aa-ay[k]*ab)/determinant),root];
    parameters=training.map(r=>nearest(curve,r.point).t);
  }
  const cubicErrors=validation.map(r=>nearest(curve,r.point).distance);
  return {tooth:i,tip,root,center:fitted.center,radius:fitted.radius,
    rms:Math.sqrt(errors.reduce((s,r)=>s+r*r,0)/errors.length),maximum:Math.max(...errors.map(Math.abs)),
    cubic:{controlPoints:curve,rms:Math.sqrt(cubicErrors.reduce((s,r)=>s+r*r,0)/cubicErrors.length),maximum:Math.max(...cubicErrors)},training,validation};
});
const report={source:{file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex'),width,height},
  arcs,qualification:'Circle and cubic fits constrained to individually measured source tip/root corners. Alternating interior radial readings are reserved for validation; endpoint readings remain construction data. The candidate uses all ten cubic flanks, without assuming equal pitch. Source overlays and contact behavior need review.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
const overlay = arcs.map(a =>
  `<path d="M${a.cubic.controlPoints[0]} C${a.cubic.controlPoints.slice(1).map(p=>p.join(',')).join(' ')} L${arcs[(a.tooth+1)%10].tip}" fill="none" stroke="#ee2244" stroke-width="2"/>`+
  a.validation.map(r=>`<circle cx="${r.point[0]}" cy="${r.point[1]}" r="1.5" fill="#00aaff"/>`).join('')).join('');
fs.writeFileSync(prefix+'.svg',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`+
  `<image href="data:image/png;base64,${fs.readFileSync(file).toString('base64')}" width="${width}" height="${height}"/>${overlay}</svg>\n`,{flag:'wx'});
if(process.env.PROFILE_MODULE) {
  const data={source:report.source,center:source.center,scale:source.scale,
    flanks:arcs.map(a=>a.cubic.controlPoints),
    heldOutErrors:arcs.map(a=>({rms:a.cubic.rms,maximum:a.cubic.maximum})),
    qualification:report.qualification};
  fs.writeFileSync(process.env.PROFILE_MODULE,
    '// Generated by scripts/measure-spring-ratchet-full-profile.mjs.\n'+
    'export const tracedRatchetProfile = '+JSON.stringify(data,null,2)+';\n',{flag:'wx'});
}
console.log(arcs.map(({tooth,center,radius,rms,maximum,cubic,training,validation})=>({tooth,center,radius,rms,maximum,cubic,
  maximumStrokeWidth:Math.max(...training.concat(validation).map(r=>r.thickness))})));
