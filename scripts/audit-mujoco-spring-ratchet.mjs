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
  if (v.physics.model.neq) {
    const {mujoco} = v.physics;
    const flags = new mujoco.DoubleBuffer(v.physics.model.neq);
    try {
      mujoco.mj_getState(v.physics.model,v.physics.data,flags.GetView(),mujoco.mjtState.mjSTATE_EQ_ACTIVE.value);
      assert(Array.from(flags.GetView()).every(active=>!active),'Assembly fixtures must be inactive during playback');
    } finally {flags.delete();}
  }
  assert.equal(v.physics.model.nq,2 + 4 * (report.parameters.segments - (report.parameters.elasticClamp ? 0 : 1)));
  if (report.parameters.continuousLeaves) {
    assert.equal(v.physics.model.nflex,report.parameters.rigidWheel ? 3 : 2);
    assert.deepEqual(Object.keys(u.parts).sort(),['Bleaf','Cleaf','driver','ratchet']);
    assert(report.minimumFlexVolumeRatio > 0);
  }
  let maximumLengthError = 0;
  const pitch = u.ratchet.pitch, cycles = [];
  let furthestAngle = report.initial.wheelAngle, maximumRollbackTeeth = 0;
  for (const row of report.rows) {
    furthestAngle = Math.min(furthestAngle,row.wheelAngle);
    maximumRollbackTeeth = Math.max(maximumRollbackTeeth,(row.wheelAngle-furthestAngle)/pitch);
  }
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
    const dwell = rows.filter(r=>r.time >= i * report.parameters.period + 1.2 && r.time <= i * report.parameters.period + 3);
    cycles.push({cycle:i+1,advanceTeeth:(initial.wheelAngle-rows.at(-1).wheelAngle)/pitch,maximumRollbackTeeth:rollback/pitch,
      settledDwellDriftTeeth:dwell.length ? (Math.max(...dwell.map(r=>r.wheelAngle))-Math.min(...dwell.map(r=>r.wheelAngle)))/pitch : null});
  }
  // Adjacent rigid beam cells overlap to represent one deforming leaf. This
  // screen groups each complete leaf; it does not certify leaf self-contact.
  for (const name of Object.keys(u.parts)) if (/^[BC]/.test(name)) u.families[name] = name[0];
  const poses = [];
  for (const time of [0,3.5,4,4.5,5,7.5]) {
    const state = time === 0 ? report.initial : report.rows.reduce((a,b)=>Math.abs(a.time-time)<Math.abs(b.time-time)?a:b);
    const data = v.physics.data;data.qpos.set(state.qpos);data.qvel.set(state.qvel);data.time=state.time;v.sync();
    const {topology,topologyIssues,checks,issues} = auditClutchSourceSolids(v);
    poses.push({time:state.time,solids:topology.length,topologyIssues,checks,issues,
      minimumFlexVolumeRatio:u.state.minimumFlexVolumeRatio});
  }
  const output = {input:file,sourceHashes:report.sourceHashes,maximumLengthError,maximumRollbackTeeth,cycles,poses,
    qualification:'Diagnostic of an isolated candidate. Whole-leaf pairs and wheel pairs are screened at six poses; within-leaf self-contact is not certified. Positive tetrahedral volumes rule out local element inversion at saved samples, not distant self-intersection. Dwell measurements use 1.2–3 seconds after each nominal cycle start. Incomplete supports, unverified beam refinement and source depth assumptions prevent assembly acceptance; rollback and drift are reported independently.'};
  fs.writeFileSync(file.replace(/\.json$/,'-audit.json'),JSON.stringify(output,null,2)+'\n',{flag:'wx'});
  console.log({maximumLengthError,cycles,poses:poses.map(({issues,topologyIssues,...p})=>({...p,issues:issues.length,topologyIssues:topologyIssues.length})),
    maximumRollbackTeeth});
} finally {v.dispose();}
