import {writeFile} from 'node:fs/promises';
import {squareToothOutline} from '../src/simulation/square-tooth-outline.js';

// Brown draws Movement 214's wheels with square teeth: straight flanks, flat
// tips and flat roots, about 0.66 deep. The site construction's pitch
// circles (module 0.48, radii 2.4 and 2.88) and tooth phases are retained.
// Square flanks are not conjugate, so the 10:12 ratio stays prescribed. The
// width (0.66 at mid-height, tapering 0.03 per flank toward the tip) is the
// widest found that keeps the pair clear through a full mesh cycle at the
// 0.06 root clearance; the running backlash this leaves is at most about
// 0.04 rad of counterwheel play (0.12 at its pitch circle), 0.012 rad on the
// nearer flank.
const parameters={module:.48,addendum:.3,dedendum:.36,width:.66,taper:.03,rootSamples:8};
const profiles={};
for(const teeth of [10,12]){
  const radius=parameters.module*teeth/2;
  const square=squareToothOutline({teeth,radius,addendum:parameters.addendum,dedendum:parameters.dedendum,
    width:parameters.width,taper:parameters.taper,rootSamples:parameters.rootSamples});
  profiles[teeth]={outline:square.points.map(p=>p.toArray().map(v=>Math.round(v*1e10)/1e10)),
    ...parameters,pitchRadius:radius,rootRadius:square.rootRadius,tipRadius:square.tipRadius,
    radialClearance:0,toothProfile:'square-straight-flank-flat-tip-flat-root'};
  console.log({teeth,vertices:profiles[teeth].outline.length});
}
await writeFile(new URL('../src/simulation/baked/gear-finger-stop-teeth.js',import.meta.url),
  `// Generated offline by scripts/generate-gear-finger-stop-teeth.mjs.\nexport default ${JSON.stringify(profiles)};\n`);
