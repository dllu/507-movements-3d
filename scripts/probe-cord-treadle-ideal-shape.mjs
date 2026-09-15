import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {idealCordShape} from '../src/simulation/mujoco-cord-treadle/ideal-cord-shape.js';
const input='/dev/shm/159-ideal-scaled-finer.json',native=JSON.parse(fs.readFileSync(input)),samples=native.filter(s=>s.time>=12-1e-8).filter((_,i)=>i%4===0),rows=samples.map(s=>{const shape=idealCordShape(...s.qpos);return{time:s.time,disk:s.qpos[0],treadle:s.qpos[1],pulley:shape.pulleyAngle,...shape};});
const sources=['scripts/probe-cord-treadle-ideal-shape.mjs','src/simulation/mujoco-cord-treadle/ideal-cord-shape.js','src/simulation/cord-treadle-motion.js',input];
const report={movement:159,samples:rows.length,maximumLengthError:Math.max(...rows.map(s=>Math.abs(s.lengthError))),maximumSlack:Math.max(...rows.map(s=>s.slack)),maximumTendonExtension:Math.max(...rows.map(s=>s.tendonExtension)),maximumAmplitude:Math.max(...rows.map(s=>s.amplitude)),sources:sources.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync('/dev/shm/159-ideal-shaped.json',JSON.stringify(rows));fs.writeFileSync('docs/validation/159-ideal-shape.json',JSON.stringify(report,null,2)+'\n');console.log(report);
