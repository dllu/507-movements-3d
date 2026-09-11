import { readFile, writeFile } from 'node:fs/promises';
import { makeStarMangleCandidate } from '../artifacts/review/054-candidate-model.mjs';
import { firstPinionContact } from './lib/star-mangle-angular-contact.mjs';

const profilePath = process.env.PROFILE_INPUT ?? 'artifacts/review/054-candidate32-shifted-profiles.json';
const output = process.env.PROBE_OUTPUT ?? 'artifacts/review/054-candidate32-shifted-engagement.json';
const model = makeStarMangleCandidate(JSON.parse(await readFile(profilePath, 'utf8')));
const { parts, geometry: p } = model.root.userData;
const samples = Number(process.env.PROBE_STEPS ?? 128), pitch = 2 * Math.PI / p.pinionTeeth;
const report = { profilePath, status: 'contact-curve-diagnostic', branches: [] };
function contact(pathTravel) {
  model.root.userData.updateTravel(pathTravel); model.root.updateMatrixWorld(true);
  const result = firstPinionContact({ teeth: parts.teeth, pinion: parts.pinion, maximumAdvance: 0.15 });
  if (!result.witness) throw new Error(`No contact within search interval at ${pathTravel}`);
  return { pathTravel, ...result };
}
for (const [name, start, length] of [
  ['front', Math.floor(p.toothCount / 2) * pitch, pitch],
  ['last-crossover', p.runTravel, Math.PI],
  ['rear', p.rearStart + Math.floor(p.toothCount / 2) * pitch, pitch],
  ['first-crossover', p.returnStart, Math.PI],
]) {
  const poses = Array.from({ length: samples + 1 }, (_, i) => contact(start + length * i / samples));
  let worst = 0;
  for (let i = 1; i < poses.length; i += 1) if (Math.abs(poses[i].advance - poses[i - 1].advance)
    > Math.abs(poses[worst + 1].advance - poses[worst].advance)) worst = i - 1;
  let left = poses[worst], right = poses[worst + 1]; const refinement = [];
  for (let i = 0; i < 22; i += 1) {
    const middle = contact((left.pathTravel + right.pathTravel) / 2);
    if (Math.abs(middle.advance - left.advance) > Math.abs(right.advance - middle.advance)) right = middle;
    else left = middle;
    refinement.push({ width: right.pathTravel - left.pathTravel, jump: right.advance - left.advance, left, right });
  }
  const branch = { name, poses, largestSampleStep: poses[worst + 1].advance - poses[worst].advance,
    minimumAdvance: Math.min(...poses.map(v => v.advance)), maximumAdvance: Math.max(...poses.map(v => v.advance)), refinement };
  report.branches.push(branch); console.log(JSON.stringify({ name, minimumAdvance: branch.minimumAdvance,
    maximumAdvance: branch.maximumAdvance, largestSampleStep: branch.largestSampleStep, refined: refinement.at(-1) }));
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
