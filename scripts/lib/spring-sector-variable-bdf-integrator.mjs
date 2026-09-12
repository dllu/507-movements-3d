import {advanceSpringSectorStep} from './spring-sector-dynamics.mjs';
import {advanceSpringSectorVariableBdfStep, sameSpringSectorContacts} from './spring-sector-variable-bdf-step.mjs';

export function makeSpringSectorVariableBdfIntegrator(physics, initial, {eventStep, minimumStep, checkStep = () => ({passed: true})}) {
  if (![eventStep, minimumStep].every(Number.isFinite) || minimumStep <= 0 || eventStep < minimumStep) throw Error('Invalid step limits');
  const rows = [initial], rejectedSteps = [], failures = [];
  let smoothIntervals = 0, settlingIntervals = 2;
  const advance = dt => {
    // Resolve post-impact velocity at the same small scale as the event.
    // A large next step otherwise spreads the remaining stopping impulse
    // over a base interval. Apply the same bounded startup treatment.
    if (settlingIntervals > 0 && dt > eventStep * (1 + 1e-12)) return advance(dt / 2) && advance(dt / 2);
    const state = rows.at(-1), previous = rows.at(-2);
    // Retain quadratic history as the step grows after a resolved event.
    // Split before solving so every accepted growth ratio remains at most two.
    if (previous && smoothIntervals >= 2 && dt > 2 * (state.time - previous.time) * (1 + 1e-9))
      return advance(dt / 2) && advance(dt / 2);
    const useBdf = previous && smoothIntervals >= 2;
    let result = useBdf ? advanceSpringSectorVariableBdfStep(physics, state, previous, dt) : advanceSpringSectorStep(physics, state, dt);
    let method = useBdf ? 'variable-bdf2' : 'backward-euler', reset = false;
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
    smoothIntervals = transition || reset ? 0 : smoothIntervals + 1;
    const eventRelaxation = settlingIntervals > 0;
    settlingIntervals = transition || reset ? 2 : Math.max(0, settlingIntervals - 1);
    rows.push({...result.state, dt, ...result.diagnostic, method, transition, eventRelaxation, continuous});
    return true;
  };
  return {rows, rejectedSteps, failures, advance};
}
