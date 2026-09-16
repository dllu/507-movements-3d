import fs from 'node:fs';
import {generateWormWheelProfile} from '../src/simulation/worm-wheel-profile.js';
const parameters={teeth:24,pitchRadius:1,wormPitchRadius:25.5/86,wormLength:Math.PI/4,depth:.38,pressureAngle:20*Math.PI/180,wormRootRadius:25.5/86-1.25/12,wormTipRadius:25.5/86+1/12};
const started=Date.now();
const profile=generateWormWheelProfile(parameters,{angularSteps:128,axialSteps:16,phaseSteps:800,radialSteps:60,clearance:.0065});
delete profile.generatingPhases;
profile.radii=profile.radii.map(value=>Number(value.toFixed(8)));
fs.writeFileSync('src/data/feed-worm-wheel-profile.js',`// Offline synchronized hob envelope. Regenerate with scripts/generate-feed-worm-wheel.mjs.\nexport const feedWormWheelParameters=${JSON.stringify(parameters)};\nexport const feedWormWheelCut=${JSON.stringify(profile)};\n`);
console.log({seconds:(Date.now()-started)/1000, samples:profile.radii.length,seam:profile.maximumSeamResidual});
