// Deterministic offline export. Usage: node scripts/export-seven-tooth-238-profiles.mjs /dev/shm/input.json
import{writeFileSync}from'node:fs';import{createAuthoredEscapementMovement as create}from'../src/simulation/authored-escapements.js';
const d=create({id:238}).root.userData,g=d.geometry,poses=1024;
const outline=Array.from({length:14},(_,i)=>{const a=g.wheelMountPhase+i*Math.PI/7,r=i%2?g.wheelRootRadius:g.contactRadius;return[r*Math.cos(a),r*Math.sin(a)];});
const cutters=[];for(let i=0;i<=poses;i++){const s=d.stateAtCycleCoordinate(i/poses);for(const side of['B','C']){const f=d.faceAt(side,s.palletAngle),n=f.normal,a=f.rootPoint,b=f.tipPoint,polygon=[a.clone().addScaledVector(n,-.0005),b.clone().addScaledVector(n,-.0005),b.clone().addScaledVector(n,-.0605),a.clone().addScaledVector(n,-.0605)];for(let k=0;k<7;k++){const angle=-s.wheelAngle+k*g.toothPitch,c=Math.cos(angle),v=Math.sin(angle);cutters.push(polygon.map(p=>[p.x*c-p.y*v,p.x*v+p.y*c]));}}}
writeFileSync(process.argv[2],JSON.stringify({outline,cutters,poses,amplitude:g.palletAmplitude,impulse:g.contactAdvance}));
