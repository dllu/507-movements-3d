import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makeWiperStampCandidate} from './lib/wiper-stamp-candidate.mjs';
import {makeWiperStampContact} from './lib/wiper-stamp-contact.mjs';
import {readStudyReport, freezeStudySources, hashStudyFile, verifyStudySources, writeGzipStudyReport} from './lib/study-report-io.mjs';

const step = Number(process.env.PROBE_STEP ?? .001), duration = Number(process.env.PROBE_DURATION ?? 8);
const prefix = process.env.PROBE_PREFIX ?? 'artifacts/review/085-first-dynamics';
assert(step > 0 && duration > 0 && Math.abs(duration/step-Math.round(duration/step)) < 1e-7);
const frozen = readStudyReport('artifacts/review/084-integrated-source-hashes.json');
const verifyProduction = () => {for (const [file, hash] of Object.entries(frozen)) assert.equal(hashStudyFile(file), hash, file);};
verifyProduction();
const sources = freezeStudySources(['scripts/study-wiper-stamp-dynamics.mjs', 'scripts/lib/wiper-stamp-candidate.mjs',
  'scripts/lib/wiper-stamp-source.mjs', 'scripts/lib/wiper-stamp-contact.mjs', 'scripts/lib/study-report-io.mjs',
  'src/simulation/finite-plate-geometry.js', 'src/simulation/conforming-plate-mesh.js', 'src/simulation/clutch-section-geometry.js', 'src/simulation/primitives.js'], prefix);
const model = makeWiperStampCandidate(), contact = makeWiperStampContact(model), minimum = model.root.userData.geometry.minimumStampY;
const gravity = 9.81, angularSpeed = -Math.PI/2, rows = [{time:0, camAngle:0, stampY:0, velocity:0, impulse:0, contact:null}], events = [];
let position = 0, velocity = 0, previous = null, inputWork = 0, stepLoss = 0, maximumMomentumResidual = 0;
for (let i = 1; i <= Math.round(duration/step); i++) {
  const time = i*step, angle = angularSpeed*time, cam = contact.support(angle), limit = Math.max(minimum, cam?.height ?? -Infinity);
  const freeVelocity = velocity-gravity*step, freePosition = position+step*freeVelocity, next = Math.max(limit,freePosition), v = (next-position)/step;
  const impulse = v-freeVelocity, active = impulse > 1e-10 ? (cam && cam.height>minimum ? 'cam' : 'bed') : null;
  assert(impulse >= -1e-10); assert(Number.isFinite(next) && Number.isFinite(v));
  const residual = v-velocity+gravity*step-impulse; maximumMomentumResidual = Math.max(maximumMomentumResidual,Math.abs(residual));
  // Exact backward-Euler work identity, including the contact's displacement
  // work and its numerical kinetic-energy loss. This is not a continuum proof.
  inputWork += impulse*v; stepLoss += .5*(v-velocity)**2;
  if (active !== previous) events.push({time, from:previous, to:active, stampY:next, velocity:v});
  const row = {time, camAngle:angle, stampY:next, velocity:v, impulse, contact:active};
  if (active === 'cam') Object.assign(row, {cam});
  rows.push(row); position = next; velocity = v; previous = active;
}
verifyProduction(); verifyStudySources(sources);
const energyChange = .5*velocity**2+gravity*position;
const summary = {movement:85, status:'finite-cam-support-backward-euler-study', productionChanged:false, mechanicsPassed:false,
  candidateIntegrated:false, step, duration, gravity, angularSpeed, sourcePixelsPerUnit:240, minimumStampY:minimum,
  rows:rows.length, camBoundaryEdges:contact.boundary.length, camContacts:rows.filter(r=>r.contact==='cam').length,
  bedContacts:rows.filter(r=>r.contact==='bed').length, freeStates:rows.filter(r=>r.contact===null).length,
  minimumPosition:Math.min(...rows.map(r=>r.stampY)), maximumPosition:Math.max(...rows.map(r=>r.stampY)), events,
  maximumMomentumResidual, energyChange, contactDisplacementWork:inputWork, backwardEulerLoss:stepLoss,
  energyResidual:energyChange-inputWork+stepLoss, sources, frozenProductionInputsMatched:Object.keys(frozen).length,
  qualification:'One ideal prismatic stamp coordinate, gravity 9.81, unit normalized mass, rigid perfectly inelastic support/bed contact and a prescribed four-second shaft revolution. The support comes from actual rendered cam boundary segments clipped to the flat projection span. Cam geometry, guide engagement, finite-surface clearance, reactions and time-step agreement still require independent qualification. Contact displacement work is not yet audited against shaft work.'};
const packed = await writeGzipStudyReport(prefix+'.json.gz',{...summary,rows});
fs.writeFileSync(prefix+'-summary.json',JSON.stringify({...summary,trajectory:{file:prefix+'.json.gz',...packed}},null,2)+'\n',{flag:'wx'});
console.log({...summary,sources:undefined,events:events.slice(0,30)});
