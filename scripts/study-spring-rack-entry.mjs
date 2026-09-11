import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackContact} from './lib/spring-rack-contact-study.mjs';
const prefix='artifacts/review/081-entry-stop-study',options=JSON.parse(fs.readFileSync('artifacts/review/081-fitted-source-pose.json')).options,
 model=makeSpringRackCandidate(options),p=model.root.userData.geometry,contact=makeSpringRackContact(model),rows=[];
for(let i=0;i<=100;i++){
 const y=p.stop.minimumY+(i/100-.5)*p.pitch;
 let previous=1.2,found=null;
 for(let time=1.202;time<1.85;time+=.002){
  if(contact.pair(-Math.PI*time,y,0).minimumGap<=0){
   let lo=previous,hi=time;for(let j=0;j<30;j++){const mid=(lo+hi)/2;if(contact.pair(-Math.PI*mid,y,0).minimumGap>0)lo=mid;else hi=mid;}
   const at=(lo+hi)/2,c=contact.pair(-Math.PI*at,y,1e-8);
   found={time:at,gap:c.minimumGap,contacts:c.rows.map(r=>({id:r.id,gap:r.gap,J:r.J,normal:r.normal,inputJ:r.inputJ,
    rackVelocity:Math.abs(r.J)>1e-12?Math.PI*r.inputJ/r.J:null}))};break;
  }previous=time;
 }
 rows.push({y,stopTop:p.stop.sourceY-p.stop.pinRadius+y*p.source.scale,...found});
}
const sources=['scripts/study-spring-rack-entry.mjs','scripts/lib/spring-rack-contact-study.mjs','scripts/lib/spring-rack-candidate.mjs',
 'scripts/lib/spring-rack-coil.mjs','scripts/lib/spring-rack-source.mjs','artifacts/review/081-fitted-source-pose.json'].map((file,i)=>{
 const archive=prefix+'-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);
 return {file,archive,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};
});
const good=rows.filter(r=>r.contacts?.length&&r.contacts.every(c=>c.J>.8&&c.rackVelocity>0));
fs.writeFileSync(prefix+'.json',JSON.stringify({movement:81,status:'isolated-leading-tooth-entry-stop-sweep',rows,good,sources,
 qualification:'First actual finite-profile contact after spring-return dwell, swept over one tooth pitch of an unpictured stop position. This locates compatible leading-flank entry; it does not solve subsequent dynamics.'},null,2)+'\n',{flag:'wx'});
console.log({sampled:rows.length,good:good.length,candidates:good.filter((_,i)=>i%5===0)});
