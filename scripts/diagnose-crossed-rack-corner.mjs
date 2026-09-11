import fs from 'node:fs';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {makeCrossedRackCandidate} from './lib/crossed-rack-candidate.mjs';
import {makeCrossedRackDynamics,advanceCrossedRackStep} from './lib/crossed-rack-dynamics-study.mjs';
import {dot} from './lib/crossed-rack-contact-study.mjs';

const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),
 input='artifacts/review/080-initial-dynamics.json',data=JSON.parse(fs.readFileSync(input)),
 archived=data.sources.find(s=>s.file==='scripts/lib/crossed-rack-contact-study.mjs');
assert.equal(hash(archived.archive),archived.sha256);
for(const s of data.sources)if(s.file!==archived.file)assert.equal(hash(s.file),s.sha256,'Changed reproduction input: '+s.file);
const raw=fs.readFileSync(archived.archive,'utf8'),directory=path.dirname(path.resolve(archived.file)),
 code=raw.replace(/from '([^']+)'/g,(_,relative)=>'from '+JSON.stringify(pathToFileURL(path.resolve(directory,relative)).href)),
 oldModule=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')),
 model=makeCrossedRackCandidate(data.geometry),original=makeCrossedRackDynamics(model,data.parameters),
 oldContact=oldModule.makeCrossedRackContact(model),trace=[];
original.constraints=(x,time,padding=.003)=>{
 const k=original.input(time),rows=[],gaps={};
 for(const [i,key]of ['left','right'].entries()){
  const result=oldContact.pair(key,k.q,x[0],x[i+1],padding);gaps[key]=result.minimumGap;
  for(const f of result.rows){const J=[f.J[0],0,0];J[i+1]=f.J[1];rows.push({...f,J,point:f.pawlPoint,inputNormalVelocity:dot(f.normal,k.pawls[key].velocity)});}
 }
 trace.push({x:[...x],gaps,rows});return{rows,gaps};
};
const oldResult=advanceCrossedRackStep(original,data.rows.at(-1),data.dt),
 revised=makeCrossedRackDynamics(model,data.parameters),newResult=advanceCrossedRackStep(revised,data.rows.at(-1),data.dt),
 profile=revised.contact.profiles.right,vertex=27,previous=profile.edges[vertex-1],next=profile.edges[vertex];
assert.equal(oldResult.okay,false);assert.equal(oldResult.reason,'nonlinear-iteration-limit');assert.equal(newResult.okay,true);
const files=[input,archived.archive,'scripts/diagnose-crossed-rack-corner.mjs','scripts/lib/crossed-rack-contact-study.mjs',
 'scripts/lib/crossed-rack-dynamics-study.mjs','scripts/lib/crossed-rack-candidate.mjs'],sources=files.map((file,i)=>{
 const archive='artifacts/review/080-corner-diagnostic-source-'+i+'.txt';fs.copyFileSync(file,archive,fs.constants.COPYFILE_EXCL);return{file,archive,sha256:hash(file)};
});
const report={movement:80,status:'concave-corner-contact-diagnostic',productionChanged:false,mechanicsPassed:false,
 oldResult,newResult,trace,concaveHookVertex:{index:vertex,point:profile.points[vertex],turn:previous.d[0]*next.d[1]-previous.d[1]*next.d[0],
 normals:[previous.normal,next.normal]},sources,
 qualification:'The original checker is imported from its exact archived bytes with only relative module locations rewritten. At this event it incorrectly treats a concave hook vertex as an independent point against the rack, then switches arbitrary endpoint normals at coincidence. Convex contact vertices and the two actual facets of the concave target corner resolve this event without changing geometry, forces, time step or tolerance. This is a local diagnostic, not validation of the complete contact law or motion.'};
fs.writeFileSync('artifacts/review/080-corner-diagnostic.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({oldFailure:oldResult.reason,iterations:trace.length,newOkay:newResult.okay,newMinimumGap:newResult.diagnostic.minimumGap});
