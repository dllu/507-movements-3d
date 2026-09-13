import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import loadMujoco from '@mujoco/mujoco';
import {makeMujocoSpringRatchet} from './lib/mujoco-spring-ratchet-candidate.mjs';
import {auditClutchSourceSolids} from './lib/weighted-clutch-fit-audit.mjs';

const file = process.argv[2]; assert(file, 'Provide a saved dynamics probe');
const report = JSON.parse(fs.readFileSync(file));
for (const [path,hash] of Object.entries(report.sourceHashes))
  assert.equal(createHash('sha256').update(fs.readFileSync(path)).digest('hex'),hash,path+' changed after the probe');
const v = makeMujocoSpringRatchet(await loadMujoco(),report.parameters), u = v.root.userData;
try {
  assert.equal(v.physics.model.nu,1);
  assert.equal(v.physics.model.actuator_trnid[0],v.physics.id('mjOBJ_JOINT','driver'));
  assert.equal(v.physics.model.nq,2 + 4 * (report.parameters.segments - 1));
  let maximumLengthError = 0;
  const pitch = u.ratchet.pitch, cycles = [];
  for (const row of [report.initial,...report.rows]) for (let side = 0; side < 2; side++) {
    const points = row.points[side];
    for (let i = 0; i < points.length - 1; i++)
      maximumLengthError = Math.max(maximumLengthError,Math.abs(Math.hypot(...points[i+1].map((x,k)=>x-points[i][k]))-u.beams[side][i].length));
  }
  assert.ok(maximumLengthError < 1e-8, 'a displayed beam loses its joint or changes length');
  for (let i = 0; i < Math.floor(report.seconds / report.parameters.period + 1e-8); i++) {
    const rows = report.rows.filter(r=>r.time >= i * report.parameters.period && r.time < (i+1)*report.parameters.period+1e-8);
    const initial = i ? report.rows.reduce((a,b)=>Math.abs(a.time-i*report.parameters.period)<Math.abs(b.time-i*report.parameters.period)?a:b) : report.initial;
    let furthest = initial.wheelAngle, rollback = 0;
    for (const row of rows) { furthest = Math.min(furthest,row.wheelAngle);rollback = Math.max(rollback,row.wheelAngle-furthest); }
    cycles.push({cycle:i+1,advanceTeeth:(initial.wheelAngle-rows.at(-1).wheelAngle)/pitch,maximumRollbackTeeth:rollback/pitch});
  }
  // Adjacent rigid beam cells overlap to represent one deforming leaf. This
  // screen groups each complete leaf; it does not certify leaf self-contact.
  for (const name of Object.keys(u.parts)) if (/^[BC]/.test(name)) u.families[name] = name[0];
  const poses = [];
  for (const time of [0,3.5,4,4.5,5,7.5]) {
    const state = time === 0 ? report.initial : report.rows.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);
    const data = v.physics.data;data.qpos.set(state.qpos);data.qvel.set(state.qvel);data.time=state.time;v.sync();
    const {topology,topologyIssues,checks,issues} = auditClutchSourceSolids(v);
    poses.push({time:state.time,solids:topology.length,topologyIssues,checks,issues});
  }
  const output = {input:file,sourceHashes:report.sourceHashes,maximumLengthError,cycles,poses,
    qualification:'Diagnostic of an isolated candidate. Whole-leaf pairs and wheel pairs are screened at six poses; overlapping cells within a leaf are excluded. Large rollback, incomplete supports, unverified beam refinement and source end geometry prevent acceptance.'};
  fs.writeFileSync(file.replace(/\.json$/,'-audit.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  console.log({maximumLengthError,cycles,poses:poses.map(({issues,topologyIssues,...p})=>({...p,issues:issues.length,topologyIssues:topologyIssues.length})),
    maximumRollbackTeeth:Math.max(...cycles.map(c=>c.maximumRollbackTeeth))});
} finally {v.dispose();}
