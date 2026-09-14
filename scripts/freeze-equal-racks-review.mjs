import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {equalRacksStudySources} from './lib/equal-racks-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/115-integrated-final-review',read=n=>JSON.parse(fs.readFileSync('/dev/shm/115-'+n+'.json'));
const files=equalRacksStudySources('scripts/freeze-equal-racks-review.mjs').concat([
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-115-equal-racks.md','docs/review-progress.md',
 ...['mujoco-equal-racks','shifted-involute','coaxial-gears','mujoco-rack-pinion','mujoco-double-rack','mujoco-runtime','engine'].map(n=>'tests/'+n+'.test.mjs'),
 'tests/e2e/mujoco.spec.mjs','tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('equal-racks')&&n.endsWith('.mjs')).map(n=>'scripts/'+n),
]);
const sources=freezeStudySources(files,prefix),names=['source-a','fit-a','fit-b','fit-c','cap-fit-a','comparison-a','comparison-b','baseline-a','baseline-a-inspection','candidate-a','candidate-a-inspection','clearances-a','integrated-a','integrated-a-inspection',...Array.from({length:16},(_,i)=>'dynamics-'+String.fromCharCode(97+i))];
const evidence=names.map(name=>{
 const file='/dev/shm/115-'+name+'.json',r=read(name),differences=[];
 for(const s of r.sources??[]){if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);if(hashStudyFile(s.file)!==s.sha256)differences.push(s.file);}
 if(['comparison-b','clearances-a',...['j','k','l','m','n','o','p'].map(c=>'dynamics-'+c)].includes(name))assert(differences.every(f=>f==='src/simulation/mujoco-equal-racks/visual.js'),'Qualified geometry/physics changed: '+name);
 return{file,sha256:hashStudyFile(file),historicalSourceDifferences:differences};
});
const capture=read('integrated-a');verifyStudySources(capture.sources);assert(capture.integrated);assert.equal(capture.views.length,12);assert.deepEqual(capture.errors,[]);assert.equal(capture.runtime.fog,null);assert.equal(capture.runtime.hideGround,true);assert(capture.runtime.simulationTime/capture.runtime.wallSeconds>.99);
for(const name of ['baseline-a','candidate-a','integrated-a'])for(const view of read(name).views){assert.equal(hashStudyFile(view.file),view.sha256);assert(read(name+'-inspection').views.some(v=>v.file===view.file&&v.sha256===view.sha256&&v.inspected));evidence.push({file:view.file,sha256:view.sha256});}
const audit=read('clearances-a'),dynamics=read('dynamics-k');assert.equal(audit.rows.length,25);assert(audit.rows.every(r=>!r.issues.length));assert.equal(audit.maximumUnintendedPenetrationPixels,0);assert.equal(dynamics.duration,60);
for(const c of ['k','l','m','n','o','p']){const r=read('dynamics-'+c);assert.equal(r.timeResets,0);assert(Math.abs(r.finalNativeTime-r.duration)<.003);assert(r.maximumPenetrationPixels<.015);assert(r.maximumMeshErrorPixels<.09);assert(r.contactPairs['1/3']>1000&&r.contactPairs['2/3']>1000);}
for(const name of ['final-tests-a-log.txt','build-a-log.txt','e2e-a-log.txt','unshifted-parity-a.json']){
 const file='/dev/shm/115-'+name,text=fs.readFileSync(file,'utf8');
 if(name.includes('tests'))assert(text.includes('# pass 29')&&text.includes('# fail 0'));
 if(name.includes('build'))assert(text.includes('built in'));
 if(name.includes('e2e'))assert(/31 passed/.test(text));
 if(name.includes('parity'))assert(JSON.parse(text).rows.every(r=>r.unchanged));
 evidence.push({file,sha256:hashStudyFile(file)});
}
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const build=walk('/dev/shm/115-integrated-build-a');for(const entry of build)assert.equal(hashStudyFile(entry.file.replace('/dev/shm/115-integrated-build-a','dist')),entry.sha256,'Tested build changed');
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify({sources,evidence,build,baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualification:'115 is verified for the documented equal-torque reconstruction with ideal shaft/slide constraints. All twelve integrated views were inspected. Native evidence predates only the visible status text and catalog registration; qualified geometry and physics hashes match. Historical failures and source differences remain explicit. This does not complete the all-507 review.'},null,2)+'\n',{flag:'wx'});console.log({sources:sources.length,evidence:evidence.length,buildFiles:build.length});
