import fs from'node:fs';import{createAuthoredEccentricCrownGearMovement as a}from'../src/simulation/authored-eccentric-crown-gears.js';import{createAuthoredScrollGearMovement as b}from'../src/simulation/authored-scroll-gears.js';
const c=JSON.parse(fs.readFileSync('src/data/movements.json')).movements,rows=[];
for(const id of[219,414]){const m=(id===219?a:b)(c[id-1]),u=m.root.userData,blocks=u.blocks,teeth=id===219?blocks.crownTeeth:blocks.workingScrollTeeth,poses=[];
 for(let i=0;i<=4096;i++){const t=(id===219?u.transmission.inputCyclePeriod:u.motion.oneWayMotionDuration)*i/4096;m.update(t);const state=u.stateAtTime(t);poses.push(id===219?[state.crownAngle,state.pinionAngle,state.pinionCenter.x,u.geometry.pinionCenterZ]:[state.plateAngle,state.pinionAngle,state.pinionCenterY,u.geometry.pinionAxisZ]);}
 rows.push({id,cutter:u.faceCutter,teeth:teeth.map(t=>({spec:t.userData.faceSpec,position:t.position.toArray(),angle:t.rotation.z})),poses});
}
fs.writeFileSync('/dev/shm/variable-face-gears.json',JSON.stringify(rows));
