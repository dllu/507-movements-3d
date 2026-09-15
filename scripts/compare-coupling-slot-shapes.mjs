import fs from 'node:fs';import {createHash} from 'node:crypto';
import {createAuthoredEngineCouplingMovement} from '../src/simulation/authored-engine-couplings.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const a=createAuthoredEngineCouplingMovement({id:176}),b=createAuthoredEngineCouplingMovement({id:177});try{
 const g=b.root.userData.geometry,r=g.crankRadius,w=g.slotHalfWidth;
 const samples=[0,.3,.5].map(x=>({x,releasedCenterline:b.root.userData.passageCenterlineY(x),straightWalls:[-w,w],releasedWalls:[Math.sqrt((r-w)**2-x*x)-r,Math.sqrt((r+w)**2-x*x)-r]}));
 const report={status:'shared-physical-slot-inconsistency-open',movements:[176,177],samples,meaning:'At equal local half-width, the released annular passage is curved while a quarter-turn of the engaged straight passage stays straight. These are not the same physical selector. Both renderings must be revised and requalified against a shared profile.',sources:['scripts/compare-coupling-slot-shapes.mjs','src/simulation/authored-engine-couplings.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/176-177-slot-consistency.json',JSON.stringify(report,null,2)+'\n');console.log(samples);
}finally{disposeObject3D(a.root);disposeObject3D(b.root);}
