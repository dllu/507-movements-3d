// Compatibility entry point for synchronous reviews and existing callers.
// Production routes load the core directly when no recorded-contact factory is needed.
import { createAuthoredIntermittentCoreMovement } from './authored-intermittent-core.js';
import {makeEccentricTwoStop} from './eccentric-two-stop.js';
import { makePumpCatchDrive } from './pump-catch.js';
import { makeWiperStampDrive } from './wiper-stamp.js';
import { makeSelectorRackDrive } from './selector-rack.js';
import { makeSpringRackDrive } from './spring-rack.js';
import { makeCrossedRackDrive } from './crossed-rack.js';
import { makeOpposedArmDrive } from './opposed-arm.js';
import { makePullPawlDrive } from './pull-pawl.js';
import { makeAlternatingPegPawlDrive } from './alternating-peg-pawl.js';
import { makeJointedTappetCounter } from './jointed-tappet.js';
import { makeSpringJumpCam } from './spring-jump-cam.js';
import { makeTappetStudStop } from './tappet-stud-stop.js';
import { makeGravityJumpWeight } from './gravity-jump-weight.js';
import { makeGravityTumbler } from './gravity-tumbler.js';
import { makeSingleToothIndex } from './single-tooth-index.js';
import { makeSmallSingleToothIndex } from './small-single-tooth-index.js';
import { makeOpenRimTappetIndex } from './open-rim-tappet.js';
import { makeFourLobeTiltHammer } from './tilt-hammer.js';
import { makeReciprocatingPawlRatchet } from './reciprocating-pawl.js';

export function createAuthoredIntermittentMovement(movement) {
  switch (movement.id) {
    case 64: return makeSpringJumpCam();
    case 65: return makeTappetStudStop();
    case 66: return makeGravityJumpWeight();
    case 67: return makeGravityTumbler();
    case 68: return makeSingleToothIndex();
    case 69: return makeSmallSingleToothIndex();
    case 70: return makeOpenRimTappetIndex();
    case 72: return makeFourLobeTiltHammer();
    case 75: return makeReciprocatingPawlRatchet();
    case 76: return makeJointedTappetCounter();
    case 77: return makeAlternatingPegPawlDrive();
    case 78: return makePullPawlDrive();
    case 79: return makeOpposedArmDrive();
    case 80: return makeCrossedRackDrive();
    case 81: return makeSpringRackDrive();
    case 84: return makeSelectorRackDrive();
    case 85: return makeWiperStampDrive();
    case 86: return makePumpCatchDrive();
    case 88: return makeEccentricTwoStop();
    default: return createAuthoredIntermittentCoreMovement(movement);
  }
}
