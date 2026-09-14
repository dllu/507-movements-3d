import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {rackRectifierStudySources} from './lib/rack-rectifier-study-sources.mjs';
import {freezeStudySources,verifyStudySources,hashStudyFile} from './lib/study-report-io.mjs';
const prefix=process.env.PROBE_PREFIX??'/dev/shm/116-integrated-final-review-a';
const read=name=>JSON.parse(fs.readFileSync('/dev/shm/116-'+name+'.json'));
const sources=freezeStudySources([...rackRectifierStudySources('scripts/freeze-rack-rectifier-review.mjs'),
 'src/simulation/model-loader.js','src/simulation/engine.js','src/data/movements.json',
 'docs/mujoco-116-rack-rectifier.md','docs/review-progress.md','tests/mujoco-rack-rectifier.test.mjs',
 'tests/e2e/mujoco.spec.mjs','tests/shifted-involute.test.mjs','tests/engine.test.mjs','tests/mujoco-runtime.test.mjs',
 'tests/helpers/solid-surface.mjs','scripts/lib/weighted-clutch-solid-audit.mjs','scripts/lib/source-circle-fit.mjs',
 ...fs.readdirSync('scripts').filter(n=>n.includes('rack-rectifier')&&n.endsWith('.mjs')).map(n=>'scripts/'+n)],prefix);
const evidence=[],add=file=>evidence.push({file,sha256:hashStudyFile(file)});
for(const name of ['baseline-a','baseline-a-inspection','candidate-a','candidate-a-inspection','source-a','source-b','source-c','fit-a','fit-b','ratchet-fit-a','comparison-b','comparison-c','comparison-d','comparison-e',
 ...Array.from({length:17},(_,i)=>'dynamics-'+String.fromCharCode(97+i)), 'clearances-b','clearances-c','integrated-a','integrated-a-inspection']){
 const r=read(name),differences=[];
 for(const s of r.sources??[]){if(s.archive)assert.equal(hashStudyFile(s.archive),s.sha256,s.archive);if(hashStudyFile(s.file)!==s.sha256)differences.push(s.file);}
 add('/dev/shm/116-'+name+'.json');evidence.at(-1).historicalSourceDifferences=differences;
 if(['dynamics-o','dynamics-p','dynamics-q','clearances-c'].includes(name))assert(differences.every(n=>n==='src/simulation/mujoco-rack-rectifier/visual.js'),'Native evidence changed beyond its display status');
}
const capture=read('integrated-a'),inspection=read('integrated-a-inspection');verifyStudySources(capture.sources);
assert(capture.integrated);assert.equal(capture.views.length,14);assert.deepEqual(capture.errors,[]);
for(const view of capture.views){assert.equal(hashStudyFile(view.file),view.sha256);assert(inspection.views.some(v=>v.file===view.file&&v.sha256===view.sha256&&v.inspected));add(view.file);}
const dynamics=read('dynamics-o'),audit=read('clearances-c');assert.equal(dynamics.duration,60);assert.equal(dynamics.timeResets,0);assert(dynamics.maximumPenetrationPixels<.2);assert(dynamics.steadyRates.rateMax<0);assert.equal(audit.maximumUnintendedPenetrationPixels,0);assert(audit.rows.every(r=>r.issues.length===0));
for(const [file,pattern]of [['/dev/shm/116-tests-c.log',/# pass 16\n# fail 0/],['/dev/shm/116-build-a.log',/built in/],['/dev/shm/116-browser-a.log',/32 passed/]]){assert(pattern.test(fs.readFileSync(file,'utf8')),file);add(file);}
for(const file of ['/dev/shm/116-playwright.config.mjs','/dev/shm/116-serve-build.mjs','/dev/shm/116-relocated-evidence-a.json'])add(file);
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{const file=dir+'/'+e.name;return e.isDirectory()?walk(file):[{file,bytes:fs.statSync(file).size,sha256:hashStudyFile(file)}];});
const rows=dynamics.rows.filter(r=>r.time>2),speed20ms=rows.slice(1).reduce((range,r,i)=>{const speed=(r.q.output-rows[i].q.output)/(r.time-rows[i].time);return [Math.min(range[0],speed),Math.max(range[1],speed)];},[Infinity,-Infinity]);
assert(speed20ms.every(v=>Math.abs(v+Math.PI/3)/(Math.PI/3)<.044));
const report={sources,evidence,speed20ms,build:walk('/dev/shm/116-integrated-build-a'),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),qualification:'116 is qualified for its documented unloaded, frictionless native reconstruction. Instantaneous shaft speed is not perfectly uniform. Historical failures are retained with explicit source differences. This progress does not complete the all-507 review.'};
verifyStudySources(sources);fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({sources:sources.length,evidence:evidence.length,buildFiles:report.build.length});
