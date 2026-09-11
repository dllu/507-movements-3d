import { readFile, writeFile } from 'node:fs/promises';
import { makeSmallSingleToothSourceProfiles } from './lib/small-single-tooth-source.mjs';
import { makeSmallSingleToothConstraintField } from './lib/small-single-tooth-constraint-field.mjs';

const fit = JSON.parse(await readFile('artifacts/review/069-source-profile-locking-fit.json', 'utf8'));
const toothShortening = Number(process.env.TOOTH_SHORTENING ?? 0);
const rootDeepening = Number(process.env.ROOT_DEEPENING ?? 0);
const circleSteps = Number(process.env.CIRCLE_STEPS ?? 2048);
const curveSteps = Number(process.env.CURVE_STEPS ?? 48);
const toothSteps = Number(process.env.TOOTH_STEPS ?? 128);
const shapeOptions = { toothShortening, rootDeepening, circleSteps, curveSteps, toothSteps };
const profile = makeSmallSingleToothSourceProfiles(shapeOptions);
const p = { ...fit.parameters, ...shapeOptions };
const phaseSteps = Number(process.env.PHASE_STEPS ?? 520), suffix = process.env.STUDY_SUFFIX ?? 'source-motion';
const begin = 2, end = 4.6, step = (end - begin) / phaseSteps;
const field = makeSmallSingleToothConstraintField(profile, p), tolerance = 1e-7;
const rows = [], failed = []; let advance = 0;
for (let i = 0; i <= phaseSteps; i++) {
  const angle = begin + i * step, intrusion = field.atAngle(angle), initial = intrusion(advance), previous = advance;
  if (initial > tolerance) {
    let evaluations = 0, pruned = 0, unresolved = 0, best = { depth: Infinity, advance };
    const firstAllowed = (low, high) => {
      const mid = (low + high) / 2, depth = intrusion(mid); evaluations++;
      if (depth < best.depth) best = { depth, advance: mid };
      if (depth - field.lipschitzBound * (high - low) / 2 > tolerance) { pruned++; return null; }
      if (high - low < 1e-10) {
        for (const at of [low, mid, high]) if (intrusion(at) <= tolerance) return at;
        unresolved++; return null;
      }
      return firstAllowed(low, mid) ?? firstAllowed(mid, high);
    };
    const permitted = firstAllowed(advance, 2 * p.pitch + 0.02);
    if (permitted === null || permitted - advance > 0.03) {
      failed.push({ i, angle, advance, initial, permitted, best, evaluations, pruned, unresolved,
        witness: intrusion(advance, true),
        reason: permitted === null ? 'No allowed forward pose found before the next two-pitch lock' : 'Disconnected forward configuration requires an unsupported jump' });
      break;
    }
    advance = permitted;
  }
  rows.push({ angle, outputAngle: p.initialQ - advance, advance, stepAdvance: advance - previous,
    speed: i ? (advance - previous) / step : 0, initialPenetration: initial, remainingPenetration: intrusion(advance) });
}
const result = { movement: 69, status: 'quasistatic-source-profile-diagnosis', productionChanged: false,
  parameters: { ...p, phaseSteps, begin, end },
  method: 'First forward allowed configuration of the two finite source polygons under passive resistance. Both dense polygon boundaries and every tooth tip are included. Conservative Euclidean angular bounds prune only intervals proven to penetrate. Complete triangle skins, force direction, entry events and convergence remain separate requirements.',
  inputVertices: field.inputVertices, outputVertices: field.outputVertices, activeOutputVertices: field.activeOutputVertices,
  poses: rows.length, expectedAdvance: 2 * p.pitch, actualAdvance: advance,
  maximumStep: Math.max(...rows.map(row => row.stepAdvance)), maximumSpeed: Math.max(...rows.map(row => row.speed)),
  failed, rows,
};
await writeFile(`artifacts/review/069-${suffix}.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log({ poses: result.poses, expectedAdvance: result.expectedAdvance, actualAdvance: advance,
  maximumStep: result.maximumStep, maximumSpeed: result.maximumSpeed, failed });
