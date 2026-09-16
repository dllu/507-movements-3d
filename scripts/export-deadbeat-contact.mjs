import fs from 'node:fs';
import {createAuthoredDeadbeatEscapementMovement} from '../src/simulation/authored-deadbeat-escapements.js';
const m=createAuthoredDeadbeatEscapementMovement({id:289}),d=m.root.userData,g=d.geometry;
const wheel=d.escapementWorkingParts.originalWheelProfile??d.blocks.toothedRim.geometry.parameters.shapes.getPoints().map(p=>p.toArray());
const paths={};
for(const[name,side]of[['left',1],['right',-1]])paths[name]=[...d.lockFacePoints(side,257).reverse(),...d.impulseFacePoints(side,129).slice(1)].map(p=>p.toArray());
const states=Array.from({length:4097},(_,i)=>{const s=d.stateAtTime(g.pendulumPeriod*i/4096);return{anchor:s.anchorAngle,wheel:s.wheelAngle,active:s.activeSide,contact:s.contactActive,point:s.activeToothPoint.toArray()};});
fs.writeFileSync(process.argv[2]??'/dev/shm/deadbeat-contact-input.json',JSON.stringify({wheel,paths,states,wheelCenter:g.wheelCenter.toArray(),anchorPivot:g.anchorPivot.toArray()}));
