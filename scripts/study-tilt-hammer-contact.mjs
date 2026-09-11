import{writeFile}from'node:fs/promises';
import{makeTiltHammerContactStudy}from'./lib/tilt-hammer-contact-study.mjs';
const study=makeTiltHammerContactStudy(),rows=[];
for(let i=0;i<=1440;i++){
  const angle=.7-study.parameters.pitch*i/1440,contact=study.boundary(angle);
  rows.push({angle,...contact,restGap:study.gap(angle,study.parameters.restQ),contactGap:contact?study.gap(angle,contact.q):null});
}
const active=rows.filter(row=>row.q!==undefined&&row.q<study.parameters.restQ);
const report={movement:72,status:'isolated-circular-cam-contact-study',productionChanged:false,parameters:study.parameters,
 method:'Finite rounded follower against four source-fitted circular flanks and their radial steps. Circle intersections and line intersections determine the unilateral downward travel limit. The workpiece stop comes from the independently traced hammer/striker polygons against the traced workpiece. This is a geometric contact limit, not a prescribed motion or gravity solution.',
 poses:rows.length,activeLimits:active.length,features:[...new Set(active.map(row=>row.feature))],
 maximumContactGap:Math.max(...rows.filter(r=>r.contactGap!==null).map(r=>Math.abs(r.contactGap))),
 minimumQ:Math.min(...active.map(row=>row.q)),rows};
await writeFile('artifacts/review/072-circular-cam-contact.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,rows:undefined});
