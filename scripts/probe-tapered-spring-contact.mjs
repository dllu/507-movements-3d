import { readFile, writeFile } from 'node:fs/promises';
import { taperedSpringContacts } from './lib/tapered-spring-contact.mjs';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';

let maximumOverestimate=0,maximumGridExcess=0,gridCases=0;
for(let k=0;k<48;k++){
  const a=[0,0],b=[1+.3*Math.sin(k),.1*Math.cos(k)],c=[-.3+.05*k,.25+.01*k],d=[c[0]+.8,c[1]+.2*Math.sin(k)];
  const radii=[.02+.005*Math.sin(k),.025,.03,.035+.004*Math.cos(k)];
  const hits=taperedSpringContacts(a,b,c,d,radii),analytic=Math.min(...hits.map(h=>Math.hypot(...h.delta)-h.radius));
  let sampled=Infinity;
  for(let i=0;i<=240;i++)for(let j=0;j<=240;j++){
    const s=i/240,t=j/240,dx=a[0]+s*(b[0]-a[0])-c[0]-t*(d[0]-c[0]),dy=a[1]+s*(b[1]-a[1])-c[1]-t*(d[1]-c[1]);
    sampled=Math.min(sampled,Math.hypot(dx,dy)-radii[0]-s*(radii[1]-radii[0])-radii[2]-t*(radii[3]-radii[2]));
  }
  maximumOverestimate=Math.max(maximumOverestimate,analytic-sampled);
  maximumGridExcess=Math.max(maximumGridExcess,sampled-analytic);gridCases++;
}
const saved=JSON.parse(await readFile('artifacts/review/073-full-memory-elastic-study.json','utf8')),rows=[];
for(const pose of [saved.snapshots[0],...saved.snapshots.filter(p=>[128,150,168,171].includes(p.step))]){
  const study=makeElasticRatchetStudy({...saved.parameters,springContactMode:'tapered'});
  for(const {key,gap}of study.evaluate(pose.x,pose.input).gaps)if(gap<.002)study.multipliers.set(key,.2);
  const state=study.evaluate(pose.x,pose.input,{details:true});let maximumRelativeError=0,worst;
  for(let i=0;i<pose.x.length;i++){
    const a=[...pose.x],b=[...pose.x],h=1e-7;a[i]-=h;b[i]+=h;
    const numerical=(study.evaluate(b,pose.input).energy-study.evaluate(a,pose.input).energy)/(2*h);
    const relative=Math.abs(numerical-state.gradient[i])/Math.max(1,Math.abs(numerical),Math.abs(state.gradient[i]));
    if(relative>maximumRelativeError){maximumRelativeError=relative;worst={i,numerical,analytic:state.gradient[i]};}
  }
  rows.push({step:pose.step,maximumRelativeError,worst,activeContacts:state.contacts.length});
}
const report={gridCases,gridSamples:gridCases*241**2,maximumOverestimate,maximumGridExcess,gradientChecks:rows,
  qualification:'Analytic linear-radius segment clearance compared with a dense independent material-coordinate grid, plus full elastic/contact-potential finite differences at saved driving poses. This is a contact-model check, not full-cycle or 3D acceptance.'};
await writeFile('artifacts/review/073-tapered-contact-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(report);
if(maximumOverestimate>1e-10||maximumGridExcess>2e-5||rows.some(r=>r.maximumRelativeError>1e-5))process.exitCode=1;
