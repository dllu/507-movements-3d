import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeReciprocatingPawlCandidate} from './lib/reciprocating-pawl-candidate.mjs';
import {makeReciprocatingPawlRatchet} from '../src/simulation/reciprocating-pawl.js';

const candidate=makeReciprocatingPawlCandidate(),production=makeReciprocatingPawlRatchet(),issues=[],buffers=[];
const buffer=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),hash=a=>createHash('sha256').update(buffer(a)).digest('hex');
for(const [name,a] of Object.entries(candidate.root.userData.parts)){
  const b=production.root.userData.parts[name];if(!b){issues.push({name,reason:'Missing production part'});continue;}
  for(const key of new Set([...Object.keys(a.geometry.attributes),...Object.keys(b.geometry.attributes),'index'])){
    const x=key==='index'?a.geometry.index:a.geometry.attributes[key],y=key==='index'?b.geometry.index:b.geometry.attributes[key];
    if(!x&&!y)continue;
    const identical=!!x&&!!y&&x.itemSize===y.itemSize&&buffer(x.array).equals(buffer(y.array));
    buffers.push({name,key,identical,sha256:x?hash(x.array):null});if(!identical)issues.push({name,key,reason:'Buffer mismatch'});
  }
}
let matrixError=0,stateError=0;
const p=production.root.userData.geometry,phases=[0,.5,1,p.sourcePhase,...Array.from({length:1021},(_,i)=>(i+.273)/1021)];
for(const cycle of [-2,0,8,33])for(const phase of phases){
  const time=(cycle+phase-p.sourcePhase)*p.period;candidate.update(time);production.update(time);
  candidate.root.updateMatrixWorld(true);production.root.updateMatrixWorld(true);
  for(const [name,a] of Object.entries(candidate.root.userData.parts)){
    const b=production.root.userData.parts[name];for(let i=0;i<16;i++)matrixError=Math.max(matrixError,Math.abs(a.matrixWorld.elements[i]-b.matrixWorld.elements[i]));
  }
  const a=candidate.root.userData.kinematics,b=production.root.userData.kinematics;
  for(const key of ['barAngle','wheelAngle','angleB','angleH','rodY','rodRadius'])stateError=Math.max(stateError,Math.abs(a[key]-b[key]));
  for(const key of ['B','H'])for(const field of ['angle','gap','gravityMoment'])stateError=Math.max(stateError,Math.abs(a[key][field]-b[key][field]));
}
if(matrixError||stateError)issues.push({matrixError,stateError});
const sources=[];
for(const file of ['src/data/reciprocating-pawl-profile.js','src/simulation/reciprocating-pawl-motion.js',
  'src/simulation/reciprocating-pawl.js','scripts/lib/reciprocating-pawl-candidate.mjs'])
  sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:75,status:'isolated-to-production-parity',parts:Object.keys(candidate.root.userData.parts).length,
  poses:phases.length*4,buffers,matrixError,stateError,issues,sources,
  qualification:'Production construction is compared byte-for-byte with the audited candidate geometry. All part world matrices and selected contact/motion scalars are compared at independent and boundary phases across positive and negative cycles.'};
await writeFile('artifacts/review/075-production-parity.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({parts:report.parts,poses:report.poses,buffers:buffers.length,matrixError,stateError,issues});if(issues.length)process.exitCode=1;
