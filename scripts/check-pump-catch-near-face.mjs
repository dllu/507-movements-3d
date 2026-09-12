import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {makePumpCatchNormalContact} from './lib/pump-catch-normal-contact.mjs';
import {rotate2} from './lib/pump-catch-contact.mjs';
import {readStudyReport,hashStudyFile,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-exact-face-controls',seating=readStudyReport('artifacts/review/086-first-cam-seating.json'),
  previous=readStudyReport('artifacts/review/086-guarded-quarter-ms-12s-summary.json'),oldSource=previous.sources.find(s=>s.file==='scripts/lib/pump-catch-normal-contact.mjs');
if(hashStudyFile(oldSource.archive)!==oldSource.sha256)throw Error('Changed historical contact source');
const dependency=previous.sources.find(s=>s.file==='scripts/lib/pump-catch-contact.mjs');if(hashStudyFile(dependency.file)!==dependency.sha256)throw Error('Historical dependency changed');
const historicalCode=fs.readFileSync(oldSource.archive,'utf8').replace("'./pump-catch-contact.mjs'",JSON.stringify(pathToFileURL(process.cwd()+'/scripts/lib/pump-catch-contact.mjs').href)),
  historicalModule=await import('data:text/javascript;base64,'+Buffer.from(historicalCode).toString('base64')),model=makePumpCatchCandidate(),current=makePumpCatchNormalContact(model),historical=historicalModule.makePumpCatchNormalContact(model);
const sources=freezeStudySources(['scripts/check-pump-catch-near-face.mjs',oldSource.archive,'artifacts/review/086-first-cam-seating.json',...previous.sources.map(s=>s.file)],prefix);
const counts={poses:0,currentMissing:0,historicalMissing:0},errors={normal:0,tangential:0},examples=[];
for(let i=0;i<73;i++)for(const sign of [-1,1])for(let exponent=3;exponent<=12;exponent++){
  const rotation=i*2*Math.PI/73,cam=seating.angle+sign*10**(-exponent)+rotation,q=[rotation,rotation],expected=rotate2(seating.normal,rotation),match=c=>c.kind==='cam'&&c.feature.pointOn==='cam'&&c.feature.vertex===100&&c.feature.edge===52;
  const a=current.query(q,cam).find(match),b=historical.query(q,cam).find(match);counts.poses++;
  if(!a)counts.currentMissing++;else{
    errors.normal=Math.max(errors.normal,Math.hypot(...a.normal.map((v,k)=>v-expected[k])));
    const d=a.point.map((v,k)=>v-a.feature.otherPoint[k]);errors.tangential=Math.max(errors.tangential,Math.abs(d[0]*a.normal[1]-d[1]*a.normal[0]));
  }
  if(!b){counts.historicalMissing++;if(examples.length<10)examples.push({q,cam,gap:a?.gap});}
}
verifyStudySources(sources);const report={movement:86,status:'near-face-normal-roundoff-regression',passed:!counts.currentMissing&&counts.historicalMissing>0&&errors.normal<1e-12&&errors.tangential<1e-12,
  mechanicsPassed:false,candidateIntegrated:false,counts,errors,examples,sources,
  qualification:'The independently seated cam vertex is swept toward and through the same hook face, at 73 common rotations and gaps over ten angle scales. Historical tiny-gap normalization demonstrably loses valid faces; current exact face normals must retain them. This is a feature-preservation regression, not full trajectory qualification.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});if(!report.passed)process.exitCode=1;
