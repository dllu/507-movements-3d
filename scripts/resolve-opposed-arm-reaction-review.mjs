import fs from 'node:fs';
import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=name=>JSON.parse(fs.readFileSync('artifacts/review/'+name+'.json')),
 original=read('079-finest-reactions'),raw=read('079-load6-finest'),names=['079-reaction-edge-support','079-reaction-edge-support-second'],
 resolutions=names.map(read),expected=raw.rows.reduce((s,r)=>s+(r.contacts?.length??0),0),inputFile='artifacts/review/079-load6-finest.json',inputHash=hash(fs.readFileSync(inputFile));
if(original.checked!==expected||original.issues.length!==resolutions.length)throw Error('Reaction coverage is incomplete');
for(const r of [original,...resolutions]){
 if(!r.sources.some(s=>s.file===inputFile&&s.sha256===inputHash))throw Error('Different dynamics');
 for(const s of r.sources)if(hash(fs.readFileSync(s.archive))!==s.sha256)throw Error('Changed source archive: '+s.archive);
 for(const file of ['scripts/lib/opposed-arm-candidate.mjs','scripts/lib/opposed-arm-contact-study.mjs','scripts/lib/opposed-arm-forces-study.mjs'])
  if(!r.sources.some(s=>s.file===file&&s.sha256===hash(fs.readFileSync(file))))throw Error('Different geometry or contact interpretation');
}
const resolved=original.issues.map(issue=>{
 const r=resolutions.find(r=>r.startIndex===issue.index&&r.endIndex===issue.index);
 if(!r?.passed||r.issues.length||r.checked!==raw.rows[issue.index].contacts.length)throw Error('Unresolved reaction: '+issue.id);
 const point=r.supportChoices.find(p=>p.id===issue.id&&p.index===issue.index);if(!point)throw Error('Missing resolved support point');
 return{original:issue,resolved:point};
});
const files=['scripts/resolve-opposed-arm-reaction-review.mjs','artifacts/review/079-finest-reactions.json',...names.map(n=>'artifacts/review/'+n+'.json')],sources=[];
for(const file of files){const bytes=fs.readFileSync(file),archive=`artifacts/review/079-resolved-reactions-source-${sources.length}.txt`;fs.writeFileSync(archive,bytes,{flag:'wx'});sources.push({file,archive,sha256:hash(bytes)});}
const report={movement:79,status:'complete-physical-reactions-resolved',productionChanged:false,mechanicsPassed:false,passed:true,checked:expected,
 originalPassedCount:expected-original.issues.length,resolvedCount:resolved.length,resolved,input:{file:inputFile,sha256:inputHash},sources,
 maximumSeparation:Math.max(original.maximumSeparation,...resolutions.map(r=>r.maximumSeparation)),
 maximumBoundaryDistance:Math.max(original.maximumBoundaryDistance,...resolutions.map(r=>r.maximumBoundaryDistance)),
 maximumConeError:Math.max(original.maximumConeError,...resolutions.map(r=>r.maximumConeError)),acceptedJacobianErrorBound:2e-6,
 qualification:'The complete original checker certified every reaction except the listed edge/face cases. Each exception is rechecked at an alternative coincident support point and independently passes the unchanged actual-boundary, normal-cone and moment-arm tolerances. A nonunique contact edge can carry force at its center rather than at the nearest-point algorithm’s arbitrarily selected endpoint. The original failed report is retained; no dynamics or contact law is changed.'};
fs.writeFileSync('artifacts/review/079-resolved-reactions.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({passed:true,checked:expected,resolved:resolved.length,maximumSeparation:report.maximumSeparation,maximumConeError:report.maximumConeError});
