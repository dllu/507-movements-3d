import * as THREE from 'three';
import {makePumpCatchCandidate} from './pump-catch-candidate.mjs';
import {makePumpCatchRearDriveGeometry} from '../../src/simulation/pump-catch-rear-drive.js';
export {THREE};

// The study candidate uses the production rear drive (the endless laid rope
// on two grooved sheaves), so candidate and production geometry stay equal.
export function makePumpCatchRearDriveCandidate({model=makePumpCatchCandidate()}={}){
  return makePumpCatchRearDriveGeometry({model});
}
