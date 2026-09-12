import {advanceSpringSectorStep} from './spring-sector-dynamics.mjs';
import {advanceSpringSectorBdfStep, sameSpringSectorContacts} from './spring-sector-bdf-step.mjs';

export function makeSpringSectorBdfIntegrator(physics, initial, {eventStep, minimumStep, checkStep = () => ({passed: true})}) {
  if (![eventStep, minimumStep].every(Number.isFinite) || minimumStep <= 0 || eventStep < minimumStep) throw Error('Invalid step limits');
  const rows = [initial], rejectedSteps = [], failures = [];
  let smoothIntervals = 0;
  const advance = dt => {
    const state = rows.at(-1), previous = rows.at(-2);
    const sameStep = previous && Math.abs(state.time - previous.time - dt) <= 1e-10 * dt + 2e-14;
    const useBdf = sameStep && smoothIntervals >= 2;
    let result = useBdf ? advanceSpringSectorBdfStep(physics, state, previous, dt) : advanceSpringSectorStep(physics, state, dt);
    let method = useBdf ? 'bdf2' : 'backward-euler', reset = false;
    if (useBdf && (!result.okay || !sameSpringSectorContacts(state.active, result.state.active))) {
      rejectedSteps.push({time: state.time, dt, method, reason: result.okay ? 'bdf-contact-transition' : result.reason});
      result = advanceSpringSectorStep(physics, state, dt); method = 'backward-euler'; reset = true;
    }
    const transition = result.okay && !sameSpringSectorContacts(state.active, result.state.active);
    let continuous;
    if (result.okay && (transition || reset) && dt > eventStep * (1 + 1e-12)) {
      result = {okay: false, reason: 'contact-event-refinement'};
    }
    if (result.okay) {
      continuous = checkStep(state, result.state);
      if (!continuous.passed) result = {okay: false, reason: 'continuous-primary-clearance', failure: continuous.failure};
    }
    if (!result.okay) {
      const rejected = {time: state.time, dt, method, ...result}; rejectedSteps.push(rejected);
      if (dt / 2 < minimumStep) {failures.push(rejected); return false;}
      return advance(dt / 2) && advance(dt / 2);
    }
    // Two complete, stable BE intervals after an impact remove impact velocity
    // from both history entries. Otherwise BDF2 could manufacture a rebound
    // from the pre-impact velocity even when the contact stays closed.
    smoothIntervals = transition || reset ? 0 : sameStep ? smoothIntervals + 1 : 1;
    rows.push({...result.state, dt, ...result.diagnostic, method, transition, continuous});
    return true;
  };
  return {rows, rejectedSteps, failures, advance};
}
