import fs from 'node:fs';
import crypto from 'node:crypto';
import {makePullPawlCandidate} from './lib/pull-pawl-candidate.mjs';
import {makePullPawlContact} from './lib/pull-pawl-contact-study.mjs';
const geometry=JSON.parse(process.env.GEOMETRY_OPTIONS??'{}'),model=makePullPawlCandidate(geometry),u=model.root.userData,contact=makePullPawlContact(model),rows=[];
for(let i=-20;i<=20;i++){
 const theta=i*.0025,seats=Object.fromEntries(['left','right'].map(key=>[key,contact.seat(key,{theta})])),
  okay=Object.values(seats).every(s=>s.okay),cost=okay?Math.hypot(theta*u.geometry.scale,...Object.values(seats).map(s=>s.sourceError)):null;
 rows.push({theta,seats,okay,cost});
}
const best=rows.filter(r=>r.okay).sort((a,b)=>a.cost-b.cost)[0],files=['scripts/study-pull-pawl-source-seats.mjs','scripts/lib/pull-pawl-contact-study.mjs','scripts/lib/pull-pawl-candidate.mjs'],
 report={movement:78,status:'static-gravity-closing-seat-study',productionChanged:false,mechanicsPassed:false,geometry,rows,best,
  qualification:'First contact while each pawl turns under gravity about its measured pivot with the wheel held. Finite profile vertices are queried against opposite profile edges in both directions. This is a source-pose study, not driven dynamics or a continuous collision certificate.',
  sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
fs.writeFileSync(process.env.PROBE_OUTPUT??'artifacts/review/078-source-seat-study.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({rows:rows.length,best:best&&{theta:best.theta,cost:best.cost,seats:Object.fromEntries(Object.entries(best.seats).map(([key,s])=>[key,{alpha:s.alpha,error:s.sourceError,gap:s.minimumGap,contacts:s.rows.length}]))},failures:rows.filter(r=>!r.okay).length});
