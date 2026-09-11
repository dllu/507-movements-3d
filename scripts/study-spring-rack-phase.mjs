import fs from 'node:fs';
import crypto from 'node:crypto';
import {makeSpringRackCandidate} from './lib/spring-rack-candidate.mjs';
import {makeSpringRackContact} from './lib/spring-rack-contact-study.mjs';
const options=JSON.parse(process.env.CANDIDATE_OPTIONS??'{}'),model=makeSpringRackCandidate(options),p=model.root.userData.geometry,
 contact=makeSpringRackContact(model),samples=[];
for(let i=0;i<=400;i++){const y=p.pitch*(i/400-.5),r=contact.pair(0,y,0);samples.push({y,gap:r.minimumGap});}
const best=samples.reduce((a,b)=>a.gap>b.gap?a:b),valid=samples.filter(s=>s.gap>=0),boundaries=[];
for(let i=1;i<samples.length;i++)if((samples[i-1].gap<0)!==(samples[i].gap<0)){
 let a=samples[i-1],b=samples[i];for(let k=0;k<36;k++){const y=(a.y+b.y)/2,m={y,gap:contact.pair(0,y,0).minimumGap};if((m.gap<0)===(a.gap<0))a=m;else b=m;}
 const y=(a.y+b.y)/2;boundaries.push({y,sourcePixels:y*p.source.scale,contacts:contact.pair(0,y,1e-7)});
}
const prefix=process.env.PROBE_OUTPUT_PREFIX??'artifacts/review/081-first-phase-study',
 hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),sources=[];
for(const file of ['scripts/study-spring-rack-phase.mjs','scripts/lib/spring-rack-contact-study.mjs','scripts/lib/spring-rack-candidate.mjs','scripts/lib/spring-rack-coil.mjs',
 'scripts/lib/spring-rack-source.mjs','scripts/lib/pull-pawl-contact-study.mjs']){
 const archive=prefix+'-source-'+sources.length+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);sources.push({file,archive,sha256:hash(file)});
}
const report={movement:81,status:'isolated-relative-phase-study',productionChanged:false,mechanicsPassed:false,options,samples,best,
 validSamples:valid.length,boundaries,sources,qualification:'Both actual Float32 profile directions are screened at fixed wheel angle while shifting the rack through one pitch. This locates candidate source-pose clearance intervals; it does not establish contact compatibility throughout the drive or return.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({best,validSamples:valid.length,boundaries:boundaries.map(b=>({y:b.y,pixels:b.sourcePixels,gap:b.contacts.minimumGap,contacts:b.contacts.rows.map(r=>({id:r.id,J:r.J,inputJ:r.inputJ}))}))});
