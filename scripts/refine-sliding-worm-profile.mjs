import fs from 'node:fs';
import {generateWormWheelProfile} from '../src/simulation/worm-wheel-profile.js';
const {parameters}=JSON.parse(fs.readFileSync('/dev/shm/143-worm-candidate-profile.json'));
const options={angularSteps:512,axialSteps:64,phaseSteps:1600,radialSteps:160,clearance:.0004};
const profile=generateWormWheelProfile(parameters,options);
fs.writeFileSync('/dev/shm/143-refined-profile.json',JSON.stringify({parameters,profile}));
console.log({options,samples:profile.radii.length});
