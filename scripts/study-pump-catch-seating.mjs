import fs from 'node:fs';
import assert from 'node:assert/strict';
import {makePumpCatchCandidate} from './lib/pump-catch-candidate.mjs';
import {renderedPrism,boundaryCone} from './lib/crossed-rack-mesh-prisms.mjs';
import {poly,rotate,polygonClipping as clip} from '../src/simulation/finite-plate-geometry.js';
import {freezeStudySources,hashStudyFile,readStudyReport} from './lib/study-report-io.mjs';

const prefix=process.env.PROBE_PREFIX??'artifacts/review/086-first-cam-seating',model=makePumpCatchCandidate(),u=model.root.userData,pivot=u.geometry.pivot;
const frozen=readStudyReport('artifacts/review/085-integrated-source-hashes.json');
const verify=()=>{for(const[file,sha]of Object.entries(frozen))assert.equal(hashStudyFile(file),sha,file);};verify();
const cam=renderedPrism(u.parts.pointedCamC.geometry),hook=renderedPrism(u.parts.hookedCatchB.geometry);
assert(cam.low<hook.high&&hook.low<cam.high);
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const footprint=prism=>clip.union(...prism.triangles.map(t=>poly(t.points)));
const C=footprint(cam),H=footprint(hook).map(p=>p.map(r=>r.map(v=>add(v,pivot))));
const transformed=angle=>C.map(p=>p.map(r=>r.map(v=>rotate(v,angle))));
const area=polygons=>Math.abs(polygons.reduce((s,p)=>s+p.reduce((s,r)=>s+r.reduce((s,v,i)=>s+cross(v,r[(i+1)%r.length])/2,0),0),0));
const overlap=angle=>area(clip.intersection(transformed(angle),H));
assert.equal(overlap(0),0);let clear=0,penetrating=null;
for(let i=1;i<=300;i++){const angle=-.002*i;if(overlap(angle)>1e-14){penetrating=angle;break;}clear=angle;}
assert(penetrating!==null,'Clockwise cam must reach the hook');const bracket=[clear,penetrating];
for(let i=0;i<50;i++){const mid=(clear+penetrating)/2;if(overlap(mid)>1e-18)penetrating=mid;else clear=mid;}
const angle=clear,camEdges=cam.boundary.map(e=>({a:rotate(e.a,angle),b:rotate(e.b,angle)})),hookEdges=hook.boundary.map(e=>({a:add(e.a,pivot),b:add(e.b,pivot)}));
const nearest=(p,e)=>{const d=sub(e.b,e.a),t=Math.max(0,Math.min(1,sub(p,e.a).reduce((s,v,i)=>s+v*d[i],0)/d.reduce((s,v)=>s+v*v,0)));return add(e.a,d.map(v=>v*t));};
let best={gap:Infinity};
for(const[side,points,edges]of [['cam',cam.points.map(p=>rotate(p,angle)),hookEdges],['hook',hook.points.map(p=>add(p,pivot)),camEdges]])
  for(const p of points)for(const e of edges){const q=nearest(p,e),gap=Math.hypot(...sub(p,q));if(gap<best.gap)best={gap,side,camPoint:side==='cam'?p:q,hookPoint:side==='cam'?q:p,edge:e};}
assert(best.gap<1e-7);const d=sub(best.edge.b,best.edge.a),length=Math.hypot(...d);
const normal=best.side==='cam'?[-d[1]/length,d[0]/length]:[d[1]/length,-d[0]/length];
const camLocal=rotate(best.camPoint,-angle),hookLocal=sub(best.hookPoint,pivot),camCone=boundaryCone(cam,camLocal,rotate(normal,-angle)),hookCone=boundaryCone(hook,hookLocal,normal.map(v=>-v));
assert(camCone.distance<1e-7&&hookCone.distance<1e-7);assert(camCone.residual<1e-6&&hookCone.residual<1e-6);
const shaftMomentArm=cross(best.camPoint,normal),catchMomentArm=cross(sub(best.hookPoint,pivot),normal);
assert(shaftMomentArm<-.05,'Finite cam contact must supply clockwise wheel torque');
assert(overlap(angle-.001)>1e-9,'Penetrating negative control');assert.equal(overlap(angle+.001),0,'Clear negative control');
verify();const sources=freezeStudySources(['scripts/study-pump-catch-seating.mjs','scripts/lib/pump-catch-candidate.mjs','scripts/lib/pump-catch-source.mjs',
  'scripts/lib/crossed-rack-mesh-prisms.mjs','src/simulation/finite-plate-geometry.js','src/simulation/conforming-plate-mesh.js',
  'src/simulation/clutch-section-geometry.js','src/simulation/primitives.js','scripts/lib/study-report-io.mjs'],prefix);
const report={movement:86,status:'finite-cam-first-hook-contact-diagnostic',passed:true,mechanicsPassed:false,candidateIntegrated:false,productionChanged:false,
  angle,initialBracket:bracket,finalBracket:[clear,penetrating],contact:best,normal,shaftMomentArm,catchMomentArm,camCone,hookCone,
  negativeControls:{penetratingArea:overlap(angle-.001),clearArea:overlap(angle+.001)},cam:cam.validation,hook:hook.validation,sources,
  qualification:'The clockwise finite cam reaches the fixed source-pose hook without a round proxy. Actual cap unions locate first overlap, complete prism boundaries locate contact, and both adjacent-face normal cones admit the compressive normal. It supplies clockwise shaft-axis torque. This only seats the source pose; moving catch equilibrium, wheel/pump loading, release and return dynamics remain unresolved.'};
fs.writeFileSync(prefix+'.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({...report,sources:undefined});
