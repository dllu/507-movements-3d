import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const floor=process.env.FLOOR==='1';
const files=floor?['/dev/shm/159-floor-coarse-samples.json','/dev/shm/159-floor-fine-samples.json']:['/dev/shm/159-passive-samples.json','/dev/shm/159-passive-fine-samples.json','/dev/shm/159-no-cord-samples.json'];
const [coarse,fine]=files.map(file=>JSON.parse(fs.readFileSync(file)));assert.equal(coarse.length,fine.length);
const maxima=[0,0];for(let i=0;i<coarse.length;i++){assert.ok(Math.abs(coarse[i].time-fine[i].time)<1e-8);for(let j=0;j<2;j++)maxima[j]=Math.max(maxima[j],Math.abs(coarse[i].qpos[j]-fine[i].qpos[j]));}
const noCordSummary=floor?undefined:JSON.parse(fs.readFileSync('/dev/shm/159-no-cord.json')).summary;
const sources=['scripts/compare-cord-treadle-native.mjs',...files,...(floor?[]:['/dev/shm/159-no-cord.json'])];
const report={movement:159,floor,method:'Compare synchronized .005s samples over four four-second cycles at .0005s and .00025s native timesteps. Diagnostic uniform-beam inertia and tension-only tendon; full visible assembly not qualified.',maximumCoordinateDifferences:{disk:maxima[0],treadle:maxima[1]},noCordSummary,sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(floor?'docs/validation/159-floor-native-comparison.json':'docs/validation/159-native-comparison.json',JSON.stringify(report,null,2)+'\n');console.log(report.maximumCoordinateDifferences);assert.ok(maxima.every(x=>x<(floor ? .01 : .001)));
