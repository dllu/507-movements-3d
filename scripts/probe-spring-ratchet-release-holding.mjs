import { readFile, writeFile } from 'node:fs/promises';
import { makeElasticRatchetStudy } from './lib/spring-pressed-ratchet-elastic.mjs';
import { minimizeElasticEnergy } from './lib/elastic-ratchet-minimizer.mjs';
import { refineElasticEquilibrium } from './lib/refine-elastic-equilibrium.mjs';

const rows=[];
for(const file of ['073-fitted-taper-study.json','073-stiff-fitted-taper-study.json']){
  const source=JSON.parse(await readFile('artifacts/review/'+file,'utf8'));
  const previous=source.snapshots.find(p=>p.step===source.failure.step-1),input=source.failure.input;
  const study=makeElasticRatchetStudy({...source.parameters,penalty:Number(process.env.CONTACT_PENALTY??source.parameters.penalty)}),fixedQ=previous.q;
  for(const [key,value]of previous.multipliers)study.multipliers.set(key,value);
  let x=previous.x.slice(0,study.qIndex),history=[],rounds=[];
  const evaluate=x=>{
    try{const state=study.evaluate([...x,fixedQ],input);return{...state,gradient:state.gradient.slice(0,study.qIndex)};}
    catch(error){if(['Spring centerlines crossed','Spring tip center entered wheel'].includes(error.message))return{energy:Infinity,gradient:Array(x.length).fill(NaN)};throw error;}
  };
  for(let round=0;round<64;round++){
    let result=minimizeElasticEnergy(evaluate,x,{iterations:800,tolerance:2e-7,initialHistory:history});
    history=result.history;
    if(result.maximumGradient>5e-8)result={...result,...refineElasticEquilibrium(evaluate,result.x)};
    x=result.x;study.updateMultipliers(result);
    const refreshed=evaluate(x),gradient=Math.max(...refreshed.gradient.map(Math.abs));
    rounds.push({round,iterations:result.iterations,reason:result.reason,refinement:result.refinement,maximumGradient:gradient,maximumPenetration:refreshed.maximumPenetration});
    if(gradient<2e-7&&refreshed.maximumPenetration<2e-7)break;
  }
  const state=study.evaluate([...x,fixedQ],input,{details:true});
  rows.push({source:file,input,fixedQ,parameters:study.parameters,rounds,
    maximumBeamGradient:Math.max(...state.gradient.slice(0,study.qIndex).map(Math.abs)),
    maximumPenetration:state.maximumPenetration,wheelGradient:state.gradient[study.qIndex],
    wheelContacts:state.contacts.filter(c=>c.kind!=='B-C').length,
    tipClearanceBeyondWheelCircumcircle:state.geometries.map((geometry,i)=>Math.hypot(...geometry.points.at(-1))-study.rods[i].widths.at(-1)/2-1),
    x:[...x,fixedQ],state:{...state,gradient:undefined,gaps:undefined}});
}
const report={movement:73,status:'selected-planar-layout-loses-holding',rows,
  qualification:'Diagnostic only: wheel angle is externally fixed at the preceding accepted continuation pose while both beams equilibrate at the next input angle. Positive tip clearance outside the unit wheel circumcircle proves neither rounded tip can touch the wheel at any wheel orientation in that spring pose. The missing wheel reaction equals the imposed opposing load. This diagnoses this selected planar leaf layout and continuation branch, not every possible 3D reconstruction.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/073-release-holding-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(rows.map(({state,x,rounds,...r})=>({...r,rounds:rounds.length})));
if(rows.some(r=>r.maximumBeamGradient>2e-7||r.maximumPenetration>2e-7||r.wheelContacts!==0||r.tipClearanceBeyondWheelCircumcircle.some(g=>g<=0)||Math.abs(r.wheelGradient+r.parameters.load)>1e-12))process.exitCode=1;
