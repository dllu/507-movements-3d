import{createMovementModel}from'../src/simulation/registry.js';
import{readFileSync,writeFileSync}from'node:fs';
const m=createMovementModel(JSON.parse(readFileSync(new URL('../src/data/movements.json',import.meta.url))).movements[401]),u=m.root.userData;
const poses=[...Array.from({length:1025},(_,i)=>i*4/1024),.9599609375].sort((a,b)=>a-b).map(time=>{const s=u.stateAtTime(time);return{time,lever:s.leverAngle,wheel:s.wheelAngle,event:s.wheelEvent,contact:s.activePalletContact};});
writeFileSync('/dev/shm/guernsey-input.json',JSON.stringify({g:u.geometry,poses,profiles:Object.fromEntries(['upper','lower'].map(side=>[side,Array.from({length:257},(_,i)=>u.palletFaceLocalPoint(side,.52*i/256).toArray())]))}));
