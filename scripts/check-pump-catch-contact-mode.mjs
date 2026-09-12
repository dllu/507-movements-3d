import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pumpCatchHasSlidingCam} from './lib/pump-catch-contact-mode.mjs';
import {readStudyReport,freezeStudySources,verifyStudySources} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-contact-mode-controls',input='artifacts/review/086-complete-sixteenth-ms.json.gz',data=readStudyReport(input);
verifyStudySources(data.sources);const seated=data.rows[Math.round(.5/data.step)],cam=seated.active.filter(c=>c.kind==='cam');
assert.equal(cam.length,2);assert(!pumpCatchHasSlidingCam(seated.active),'Two physical cam constraints close both angles without seed metadata');
assert(pumpCatchHasSlidingCam([cam[0]]),'A single cam equation leaves a free angular coordinate');
assert(pumpCatchHasSlidingCam([cam[0],{...cam[0]}]),'Duplicate faces do not add an independent constraint');
assert(!pumpCatchHasSlidingCam(seated.active.filter(c=>c.kind!=='cam')),'A free return is not a sliding-cam phase');
const sources=freezeStudySources([input,'scripts/check-pump-catch-contact-mode.mjs','scripts/lib/pump-catch-contact-mode.mjs'],prefix);verifyStudySources(sources);
const report={movement:86,passed:true,angularConstraintDeterminant:cam[0].gradient[0]*cam[1].gradient[1]-cam[0].gradient[1]*cam[1].gradient[0],controls:4,sources,
  qualification:'An actual seated pose has two independent angular cam equations. Removing optional closure metadata cannot change that rank. A single face and duplicated parallel faces still require sliding refinement; a free return does not.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
