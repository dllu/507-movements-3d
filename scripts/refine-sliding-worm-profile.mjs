import fs from 'node:fs';
import {generateWormWheelProfile} from '../src/simulation/worm-wheel-profile.js';
import {slidingWormDimensions as g} from '../src/simulation/sliding-worm-kinematics.js';
const parameters={teeth:g.teeth,pitchRadius:g.pitchRadius,wormPitchRadius:g.wormPitchRadius,wormLength:g.wormLength,depth:g.depth,pressureAngle:Math.PI/9};
const options={angularSteps:512,axialSteps:64,phaseSteps:1600,radialSteps:160,clearance:.0004};
const profile=generateWormWheelProfile(parameters,options);
fs.writeFileSync('/dev/shm/143-refined-profile.json',JSON.stringify({parameters,profile}));
console.log({options,samples:profile.radii.length});
