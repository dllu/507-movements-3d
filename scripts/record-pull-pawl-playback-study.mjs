import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const review='artifacts/review',hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex'),
 frozen=JSON.parse(fs.readFileSync(review+'/077-verification-source-hashes.json'));
for(const [file,expected]of Object.entries(frozen))if(hash(fs.readFileSync(file))!==expected)throw Error('Verified input changed: '+file);
const pool=new Map(),scan=directory=>{
 for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);if(entry.isDirectory())scan(file);
  else if(/\.(mjs|txt|json)$/.test(file))pool.set(hash(fs.readFileSync(file)),file);
 }
};
for(const entry of fs.readdirSync(review,{withFileTypes:true}))if(entry.name.startsWith('078-')){
 const file=path.join(review,entry.name);if(entry.isDirectory())scan(file);
 else if(/\.(mjs|txt|json)$/.test(file))pool.set(hash(fs.readFileSync(file)),file);
}
const archive=review+'/078-playback-study-sources';fs.mkdirSync(archive,{recursive:true});
const sources=new Map(),preserve=source=>{
 if(!source?.file||!source.sha256||sources.has(source.sha256))return;
 let original=pool.get(source.sha256);
 if(fs.existsSync(source.file)&&hash(fs.readFileSync(source.file))===source.sha256)original=source.file;
 if(!original)throw Error('Missing exact source: '+JSON.stringify(source));
 const target=archive+'/'+source.sha256+'-'+path.basename(source.file);
 if(!fs.existsSync(target))fs.copyFileSync(original,target);
 if(hash(fs.readFileSync(target))!==source.sha256)throw Error('Archive mismatch: '+target);
 sources.set(source.sha256,{file:source.file,sha256:source.sha256,archive:target});
};
const reports=[],exits=[],dynamics=[];
for(const name of fs.readdirSync(review).filter(n=>n.startsWith('078-')&&n.endsWith('.json')&&n!=='078-playback-study-checkpoint.json')){
 const file=path.join(review,name),bytes=fs.readFileSync(file),data=JSON.parse(bytes);
 reports.push({file,sha256:hash(bytes),size:bytes.length});
 for(const source of [...(data.sources??[]),data.source,data.script,data.prior])preserve(source);
 if(name.endsWith('-exit-status.json'))exits.push({file,code:data.code??data.exitCode,seconds:data.seconds??data.durationSeconds,sha256:hash(bytes)});
 if(data.rows?.[0]?.x&&data.parameters?.inertia){
  const pitch=2*Math.PI/26,cycles=[];
  for(let cycle=0;cycle<Math.floor(data.duration/data.parameters.period);cycle++){
   const start=Math.round(cycle*data.parameters.period/data.dt),end=Math.min(data.rows.length-1,Math.round((cycle+1)*data.parameters.period/data.dt));
   if(start>=end)break;let reverse=0,stopped=0;
   for(let i=start+1;i<=end;i++){reverse+=Math.max(0,data.rows[i].x[0]-data.rows[i-1].x[0]);if(Math.abs(data.rows[i].v[0])<1e-5)stopped++;}
   cycles.push({cycle,clockwisePitches:(data.rows[start].x[0]-data.rows[end].x[0])/pitch,reversePitches:reverse/pitch,stoppedFraction:stopped/(end-start)});
  }
  dynamics.push({file,sha256:hash(bytes),rows:data.rows.length,dt:data.dt,period:data.parameters.period,duration:data.duration,
   amplitude:data.parameters.amplitude,coulomb:data.parameters.coulomb,minimumGap:data.minimumGap,solverFailures:data.failures,cycles});
 }
}
for(const dir of ['scripts','scripts/lib'])for(const name of fs.readdirSync(dir))if(name.includes('pull-pawl')&&name.endsWith('.mjs')){
 const file=path.join(dir,name);preserve({file,sha256:hash(fs.readFileSync(file))});
}
const captures=['078-baseline-captures.json','078-initial-candidate-captures.json','078-relieved-dynamic-candidate-captures.json','078-playback-browser.json'].flatMap(name=>{
 const data=JSON.parse(fs.readFileSync(path.join(review,name)));for(const c of data.captures)if(!c.inspected||hash(fs.readFileSync(c.file))!==c.sha256)throw Error('Capture is uninspected or changed: '+c.file);
 return data.captures;
});
const plots=['078-source-tooth-sequence','078-source-inner-rim-fit','078-source-inner-rim-masked','078-source-undercut-rays'].map(name=>{
 const data=JSON.parse(fs.readFileSync(path.join(review,name+'.json'))),file=path.join(review,name+'.png');if(!data.inspected)throw Error('Uninspected source plot: '+name);
 return{file,sha256:hash(fs.readFileSync(file)),inspected:true,visualPassed:data.visualPassed};
});
plots.push({file:review+'/078-left-source-overlap.png',sha256:hash(fs.readFileSync(review+'/078-left-source-overlap.png')),inspected:true,visualPassed:false,
 inspection:'The initial candidate overlay exposes the finite left-hook overlap. Later source rays correct the tooth-face interpretation.'});
const read=name=>JSON.parse(fs.readFileSync(review+'/'+name+'.json')),
 topology=read('078-relieved-topology'),surface=read('078-amplitude-038-surfaces'),formula=read('078-formula-check'),convergence=read('078-finest-convergence');
for(const name of ['078-playback-finest-contact-bounds','078-secondary-complete-clearance-bounds','078-pawl-body-clearance-bounds','078-reaction-cones','078-bound-formulas','078-playback-finest-compression-study'])if(!read(name).passed)throw Error('Failed selected check: '+name);
if(topology.issues.length||!surface.passed||!formula.passed||!convergence.passed)throw Error('Selected candidate checks are not passing');
if(!fs.readFileSync('src/simulation/authored-intermittent.js','utf8').includes(fs.readFileSync(review+'/078-original-factory.txt','utf8'))||
 !fs.readFileSync('tests/models.test.mjs','utf8').includes(fs.readFileSync(review+'/078-original-test.txt','utf8')))throw Error('Production 078 changed');
const checkpoint={movement:78,status:'bounded-playback-candidate-ready-for-integration',created:new Date().toISOString(),productionChanged:false,mechanicsPassed:false,
 verifiedPrior:'077-integrated-checkpoint.json',unchangedFiles:Object.keys(frozen).length,
 geometry:{solids:topology.rows.length,teeth:26,spokes:6,innerRadius:.8318725251107733,rootRadius:.872,rootAngle:-.045,
  initialWheelAngle:-.0175,leftRearRelief:'Rear sole cut at source x <= 304 and below the line from [180,518] to [304,553]. The visible front hook remains source traced.',
  sourceSeatErrorPixels:{left:6.516966519199863,right:8.179730735427553},assumptions:'The concentric wheel, repeated spoke openings, hidden boundaries and rear relief are reconstruction choices.'},
 selectedDynamics:'078-amplitude-038-finest.json',selectedPlayback:'078-playback-finest-candidate.json',
 checks:{topology:{solids:topology.rows.length,issues:0},surface:{poses:surface.poses,pairs:surface.pairCount,checks:surface.checks,inside:surface.inside},
  formulas:{counts:formula.counts,maximum:formula.maximum},convergence:{coarserSourcePixels:convergence.comparisons[0].maximumSourcePixels,finerSourcePixels:convergence.comparisons[1].maximumSourcePixels},
  continuous:{primary:read('078-playback-finest-contact-bounds'),secondary:read('078-secondary-complete-clearance-bounds'),body:read('078-pawl-body-clearance-bounds')},reactions:read('078-reaction-cones'),boundFormulas:read('078-bound-formulas'),browser:read('078-playback-browser'),energy:{finest:read('078-amplitude-038-finest-energy').totals,fine:read('078-amplitude-038-fine-energy').totals,finer:read('078-amplitude-038-finer-energy').totals,
   qualification:'Both fine comparisons span 16 seconds. Positive work residual decreases under refinement. The coarse report spans 24 seconds and its total is not directly comparable.'}},
 dynamics,reports,sources:[...sources.values()],exits,captures,plots,
 preservedFailures:[
  'The first compressed dt=0.0005 playback crossed a contact transition by 1.49e-6. It remains rejected; the dt=0.00025 playback passes complete face bounds at the unchanged 1e-6 tolerance.',
  'The first secondary capsule bound could not separate the two pawn bodies. Their actual filled faces pass an independent continuous bound.',
  'The first reaction runner failed on assignment to a constant. Its exact failed source and exit are preserved; the corrected runner passes.',
  'The last two spatial refinement differences are 0.1870 and 0.1881 source pixels. Both pass the 0.25-pixel criterion, but the spatial difference does not decrease monotonically.',
  'Two early construction errors are preserved as exact source snapshots. The first used intersecting wheel-opening contours; the second repeated floating-point tooth endpoints.',
  'The initial outward-face wheel, the mirrored variant misleadingly named correct-flank, and the first undercut wheel with an unrelieved hook all retain failed actual-surface reports.',
  'Pixel-ray evidence supersedes the earlier mirrored-face interpretation: the engraving shows undercuts.',
  'The first rim fit selected two spoke points. Its failed report is unchanged; the masked fit is separately inspected.',
  'The first source-ray reader exceeded the default subprocess buffer. Its source is retained; the corrected reader uses a 4 MiB buffer.',
  'The 0.22-radian motion run completed numerically but stopped after advancing 0.356 tooth. It is not a valid counting solution.',
  'The 0.002-to-0.001 refinement difference is 0.646 source pixels; only the subsequent 0.001-to-0.0005 comparison passes the 0.25-pixel spatial criterion.'
 ],
 remaining:[
  'Integrate geometry and motion, verify exact parity, update focused tests and run full final regressions'
 ],full507GoalStillActive:true};
fs.writeFileSync(review+'/078-playback-study-checkpoint.json',JSON.stringify(checkpoint,null,2)+'\n',{flag:'wx'});
console.log({unchangedFiles:checkpoint.unchangedFiles,dynamics:dynamics.length,reports:reports.length,sources:sources.size,captures:captures.length,plots:plots.length,productionChanged:false,mechanicsPassed:false});
