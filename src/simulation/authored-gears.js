export { makeMiterGear } from './miter-gear.js';
export { wormAndWheel } from './authored-gears-core.js';
// Synchronous compatibility entry point; browser routes load independent models.
import { createAuthoredGearCoreMovement } from './authored-gears-core.js';
import { makeWeightedClutch } from './weighted-clutch.js';
import { makeMutilatedBevelAlternator } from './mutilated-bevel.js';
import { makeDualInputDifferential } from './dual-input-differential.js';
import { makeHeldSideDifferential } from './held-side-differential.js';
import { makeDualBeltSpeeds } from './dual-belt-speeds.js';
import { makeTwoSpeedSelector } from './two-speed-selector.js';
import { makeThreeSpeedSelector } from './three-speed-selector.js';
import { makeBandEpicyclic } from './band-epicyclic.js';
import { makeLatheGearEngagement } from './lathe-gear-engagement.js';
import { makeCoaxialDifferentSpeeds } from './coaxial-gears.js';
import { makeStarMangle } from './star-mangle.js';
import { makeUniversalJoint } from './universal-joint.js';
import { makeRatchetBevel } from './ratchet-bevel.js';
import { makeJawClutch } from './jaw-clutch.js';
import { makeFrictionClutch } from './friction-clutch.js';
import {makeOpposedPumpRacks} from './opposed-pump-racks.js';
import { makePinClutch } from './pin-clutch.js';
import { makeReversingClutch } from './reversing-clutch.js';

export function createAuthoredGearMovement(movement) {
  switch (movement.id) {
    case 47: return makeFrictionClutch();
    case 48: return makeJawClutch();
    case 49: return makeRatchetBevel();
    case 50: return makeUniversalJoint(50);
    case 51: return makeUniversalJoint(51);
    case 52: return makePinClutch();
    case 53: return makeReversingClutch();
    case 54: return makeStarMangle();
    case 55: return makeCoaxialDifferentSpeeds();
    case 56: return makeLatheGearEngagement();
    case 57: return makeBandEpicyclic();
    case 58: return makeThreeSpeedSelector();
    case 59: return makeTwoSpeedSelector();
    case 60: return makeDualBeltSpeeds();
    case 61: return makeHeldSideDifferential();
    case 62: return makeDualInputDifferential();
    case 74: return makeMutilatedBevelAlternator();
    case 87: return makeWeightedClutch();
    case 127: return makeOpposedPumpRacks();
    default: return createAuthoredGearCoreMovement(movement);
  }
}
