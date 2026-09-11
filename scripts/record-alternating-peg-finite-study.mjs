import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const hash=data=>crypto.createHash('sha256').update(data).digest('hex'),review='artifacts/review',
 frozen=JSON.parse(fs.readFileSync(review+'/076-verification-source-hashes.json')),changed=[];
for(const[file,expected]of Object.entries(frozen))if(hash(fs.readFileSync(file))!==expected)changed.push(file);
if(changed.length)throw Error('Verified files changed: '+JSON.stringify(changed));
const sourcePool=new Map();
function scan(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){
 const file=path.join(directory,item.name);if(item.isDirectory())scan(file);
 else if(/\.(mjs|txt)$/.test(file)){const data=fs.readFileSync(file);sourcePool.set(hash(data),file);}
}}
for(const item of fs.readdirSync(review,{withFileTypes:true}))if(item.name.startsWith('077-')){
 const file=path.join(review,item.name);if(item.isDirectory())scan(file);else if(/\.(mjs|txt)$/.test(file))sourcePool.set(hash(fs.readFileSync(file)),file);
}
const reportNames=fs.readdirSync(review).filter(name=>name.startsWith('077-')&&name.endsWith('.json')&&!name.endsWith('-exit-status.json')),
 records=[],sourceRecords=new Map(),dynamics=[];
const archive=review+'/077-finite-study-sources';fs.mkdirSync(archive,{recursive:true});
for(const name of reportNames){
 const file=path.join(review,name),bytes=fs.readFileSync(file),data=JSON.parse(bytes);
 if(name==='077-finite-study-checkpoint.json')continue;
 records.push({file,sha256:hash(bytes),size:bytes.length});
 const sources=[...(data.sources??[]),...(data.source?.file&&data.source.sha256?[data.source]:[])];
 for(const source of sources){
  if(!source.file||!source.sha256||sourceRecords.has(source.sha256))continue;
  let original=sourcePool.get(source.sha256);
  if(fs.existsSync(source.file)&&hash(fs.readFileSync(source.file))===source.sha256)original=source.file;
  if(!original)throw Error('Missing exact source '+source.file+' '+source.sha256+' used by '+file);
  const destination=archive+'/'+source.sha256+'-'+path.basename(source.file);if(!fs.existsSync(destination))fs.copyFileSync(original,destination);
  if(hash(fs.readFileSync(destination))!==source.sha256)throw Error('Archive hash mismatch');
  sourceRecords.set(source.sha256,{file:source.file,archive:destination,sha256:source.sha256});
 }
 if(data.rows?.[0]?.x&&data.parameters?.inertia){
  const cycles=[],pitch=Math.PI/12;
  for(let i=0;i<Math.ceil(data.duration/data.parameters.period);i++){
   const rows=data.rows.filter(r=>r.time>=i*data.parameters.period-1e-7&&r.time<=(i+1)*data.parameters.period+1e-7);if(!rows.length)continue;
   cycles.push({cycle:i,netPitches:(rows.at(-1).x[0]-rows[0].x[0])/pitch,
    reversePitches:rows.slice(1).reduce((sum,r,j)=>sum+Math.min(0,r.x[0]-rows[j].x[0]),0)/pitch,
    stoppedFraction:rows.filter(r=>Math.abs(r.v[0])<1e-7).length/rows.length});
  }
  dynamics.push({file,sha256:hash(bytes),geometry:data.geometry,period:data.parameters.period,dt:data.dt,rows:data.rows.length,
   qmid:data.parameters.qmid,amplitude:data.parameters.amplitude,load:data.parameters.load,coulomb:data.parameters.coulomb??0,
   damping:data.parameters.damping,minimumGap:data.minimumGap,solverFailures:data.failures.map(f=>({reason:f.reason,time:f.time})),cycles});
 }
}
const exits=fs.readdirSync(review).filter(name=>name.startsWith('077-')&&name.endsWith('-exit-status.json')).map(name=>{
 const file=path.join(review,name),bytes=fs.readFileSync(file);return{file,sha256:hash(bytes),...JSON.parse(bytes)};
}),captures=['077-initial-candidate-captures.json','077-short-lip-dynamic-candidate-captures.json'].flatMap(name=>{
 const report=JSON.parse(fs.readFileSync(path.join(review,name)));for(const c of report.captures)if(!c.inspected||hash(fs.readFileSync(c.file))!==c.sha256)throw Error('Uninspected or changed capture '+c.file);return report.captures;
});
const originalFactory=fs.readFileSync(review+'/077-original-factory.txt','utf8'),originalTest=fs.readFileSync(review+'/077-original-test.txt','utf8');
if(!fs.readFileSync('src/simulation/authored-intermittent.js','utf8').includes(originalFactory)||!fs.readFileSync('tests/models.test.mjs','utf8').includes(originalTest))throw Error('Original 077 changed');
const checkpoint={movement:77,status:'finite-contact-reconstruction-in-progress',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 verifiedPrior:'076-integrated-checkpoint.json',unchangedFiles:Object.keys(frozen).length,
 findings:['Both finite geometry variants pass 62-solid topology checks. Twenty-one candidate images are inspected.',
  'The center-constrained cycle is rejected because the returning lower hook cannot reach its prescribed handoff seat.',
  'Independent mesh mass, moving-pivot force, contact derivative and contact projection checks pass; a separate 1000-case dry-friction projection check passes.',
  'The smallest successful swing tested so far uses amplitude 0.15 radians with shorter lower lips and a dry-friction output load. Its sampled steady cycles advance one pitch without rollback but stop about 31% of the time.',
  'Smaller amplitudes 0.125 and 0.135 cease indexing. Source contour fidelity, dwell behavior, convergence, energy accounting and complete 3D clearance remain unresolved.'],
 dynamics,reports:records,sources:[...sourceRecords.values()],exits,captures,
 remaining:['Resolve source hook contour and return-clearance tradeoff','Reduce or justify stopped intervals against the source behavior','Verify energy balance and time-step convergence','Audit all actual 3D surfaces across motion','Inspect fixed-camera playback and timing','Integrate only after verification, then run full regressions']};
fs.writeFileSync(review+'/077-finite-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n');
const baselineFile=review+'/077-reconstruction.json',baseline=JSON.parse(fs.readFileSync(baselineFile));
if(!fs.existsSync(review+'/077-baseline-reconstruction-checkpoint.json'))fs.copyFileSync(baselineFile,review+'/077-baseline-reconstruction-checkpoint.json');
baseline.status=checkpoint.status;baseline.finiteStudyCheckpoint='077-finite-study-checkpoint.json';baseline.productionChanged=false;baseline.mechanicsPassed=false;baseline.remaining=checkpoint.remaining;
fs.writeFileSync(baselineFile,JSON.stringify(baseline,null,2)+'\n');
console.log({unchangedFiles:checkpoint.unchangedFiles,dynamics:dynamics.length,sources:sourceRecords.size,reports:records.length,captures:captures.length,mechanicsPassed:false});
