import { makeGravityJumpCandidate } from './gravity-jump-candidate.mjs';
import wormProfile from './gravity-jump-refined-worm-profile.mjs';

export function makeGravityJumpRefinedCandidate(options = {}) {
  return makeGravityJumpCandidate({ wormProfile, wormOffset: 34 / 218,
    wheelPhase: -0.11841387694299989, pinOuter: 0.41,
    wormShaftLow: -275 / 218, wormShaftHigh: 190 / 218, ...options });
}
