import fs from 'node:fs';
import {createAuthoredAnchorEscapementMovement as recoil} from '../src/simulation/authored-anchor-escapements.js';
const data=[];
for(const[id,make]of[[288,recoil]]){
 const m=make({id}),d=m.root.userData,b=d.blocks,g=d.geometry;
 const outline=o=>o.geometry.parameters.shapes.getPoints().map(p=>p.toArray());
 const profiles=d.escapementWorkingParts?.originalProfiles??{wheel:outline(b.toothedRim),anchor:outline(b.anchorBody),left:outline(b.leftPallet.userData.body),right:outline(b.rightPallet.userData.body)};

 const states=Array.from({length:2049},(_,i)=>{const s=d.stateAtTime(g.pendulumPeriod*i/2048);return {anchor:s.anchorAngle,wheel:s.wheelAngle,active:s.activeSide,contact:s.contactActive,point:s.activeToothPoint?.toArray()};});
 const paths={left:d.palletFacePoints(1,257).map(p=>p.toArray()),right:d.palletFacePoints(-1,257).map(p=>p.toArray())};
 data.push({id,profiles,paths,wheelCenter:g.wheelCenter.toArray(),anchorPivot:g.anchorPivot.toArray(),states});
}
fs.writeFileSync(process.argv[2]??'/dev/shm/anchor-envelope-input.json',JSON.stringify(data));
