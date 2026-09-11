import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { Fluid } from './fluid.js';

const start=performance.now();
const fluid=new Fluid('light');
const checkpoints=[];
const inspect=label=>{
  const stats=fluid.stats();
  assert.equal(stats.particleBalance,0,`${label}: particle conservation`);
  assert.equal(stats.finite,true,`${label}: finite positions`);
  assert.equal(stats.penetrations,0,`${label}: gate solid intersections`);
  assert.equal(stats.neighborOverflow,0,`${label}: neighbor capacity`);
  checkpoints.push({label,...stats});
  process.stdout.write(`${label}: ${stats.count} particles, head ${stats.head.toFixed(2)}, gate ${stats.angle.toFixed(1)}°\n`);
};
for(let i=0;i<120;i++)fluid.step();
inspect('settled');
assert.ok(fluid.angle<.01,'ordinary water should leave the gate closed');
const settledPositions=fluid.positions.slice(0,fluid.count*3);
const settledCount=fluid.count;
fluid.reset();
for(let i=0;i<120;i++)fluid.step();
assert.equal(fluid.count,settledCount);
assert.deepEqual(fluid.positions.slice(0,fluid.count*3),settledPositions,'reset reproduces the same fixed-step run');
fluid.flood();
let maximumAngle=0;
for(let i=0;i<600;i++){
  fluid.step();maximumAngle=Math.max(maximumAngle,fluid.angle);
  if(i%120===119)inspect(`flood +${(i+1)/60}s`);
}
assert.ok(maximumAngle>.25,'flood must open automatic gates');
fluid.inflow=0;fluid.automatic=false;fluid.manualAngle=.68;fluid.floodUntil=0;
const headBeforeDrain=fluid.upstreamHead,drainedBefore=fluid.drained;
for(let i=0;i<480;i++)fluid.step();
inspect('open gates, inlet stopped');
assert.ok(fluid.drained>drainedBefore+50,'water exits through the open downstream end');
assert.ok(fluid.upstreamHead<headBeforeDrain-.1,'upstream water recedes when inflow stops');
fluid.manualAngle=0;
for(let i=0;i<100;i++)fluid.step();
inspect('manual reclose');
assert.ok(fluid.angle<.001);
const result={status:'passed',date:new Date().toISOString(),elapsedMs:performance.now()-start,maximumAutomaticGateDegrees:maximumAngle*180/Math.PI,
  checks:['particle conservation','finite positions','no sampled gate intersections','neighbor capacity','deterministic reset','automatic flood response','drainage','manual closure'],checkpoints,
  qualification:'Prototype diagnostics only; no continuum convergence, engineering accuracy, or continuous-collision certificate.'};
await writeFile(new URL('./verification.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
process.stdout.write(`Passed in ${(result.elapsedMs/1000).toFixed(1)} seconds.\n`);
