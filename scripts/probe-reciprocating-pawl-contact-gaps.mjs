import * as THREE from 'three';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {makeReciprocatingPawlCandidate} from './lib/reciprocating-pawl-candidate.mjs';
import {pawlFrictionIntervals} from './lib/reciprocating-pawl-friction-study.mjs';
const model=makeReciprocatingPawlCandidate(),u=model.root.userData,p=u.geometry,parts=u.parts,
  cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>a.map((v,i)=>v-b[i]);
const distance=(p,a,b)=>{
  const d=sub(b,a),v=sub(p,a),square=d[0]**2+d[1]**2,t=Math.max(0,Math.min(1,(v[0]*d[0]+v[1]*d[1])/square));
  return Math.hypot(v[0]-t*d[0],v[1]-t*d[1]);
};
const segmentDistance=(a,b,c,d)=>{
  const ab=sub(b,a),cd=sub(d,c),ac=sub(c,a),det=cross(ab,cd);
  if(Math.abs(det)>1e-18){const t=cross(ac,cd)/det,v=cross(ac,ab)/det;if(t>=0&&t<=1&&v>=0&&v<=1)return 0;}
  return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b));
};
const polygon=path=>path.getPoints().map(v=>v.toArray()),
  transform=(points,mesh)=>points.map(p=>new THREE.Vector3(...p,0).applyMatrix4(mesh.matrixWorld).toArray().slice(0,2)),
  circleProfile=(mesh,radius)=>{
    const p=mesh.geometry.attributes.position,seen=new Map();
    for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i);if(Math.hypot(x,y)>radius*.5)seen.set(x+','+y,[x,y]);}
    return [...seen.values()].sort((a,b)=>Math.atan2(a[1],a[0])-Math.atan2(b[1],b[0]));
  },
  wheelProfile=polygon(parts.wheelBody.geometry.parameters.shapes[0]),
  slotProfile=polygon(parts.barBody.geometry.parameters.shapes[0].holes.find(h=>h.getPoints().some(v=>v.x>.2))),
  noseB=circleProfile(parts.movingPawlNose,p.noseRadius),noseH=circleProfile(parts.holdingPawlNose,p.noseRadius),
  pin=circleProfile(parts.rodPin,p.pinRadius);
const gap=(target,nose,center,radius)=>{
  let nearest=Infinity,checks=0;
  for(let i=0;i<target.length;i++){
    const a=target[i],b=target[(i+1)%target.length];if(Math.hypot(a[0]-b[0],a[1]-b[1])<1e-12||distance(center,a,b)>radius+.001)continue;
    for(let j=0;j<nose.length;j++){nearest=Math.min(nearest,segmentDistance(a,b,nose[j],nose[(j+1)%nose.length]));checks++;}
  }
  if(!Number.isFinite(nearest))throw new Error('No nearby finite contact surface');return{distance:nearest,checks};
};
const samples=[],failures=[];let maximumGap=0,checks=0,maximumResidual=0,minimumReaction=Infinity,maximumSlipNormal=0,minimumDissipation=Infinity,
  maximumPawlSpeed=0,maximumRodSpeed=0;
for(const cycle of [0,7,16,33])for(let i=0;i<257;i++){
  const phase=(i+.379)/257,time=(cycle+phase-p.sourcePhase)*p.period;model.update(time);model.root.updateMatrixWorld(true);
  const s=u.kinematics,wheel=transform(wheelProfile,parts.wheelBody),slot=transform(slotProfile,parts.barBody),
    contacts={B:gap(wheel,transform(noseB,parts.movingPawlNose),s.B.center,p.noseRadius),
      H:gap(wheel,transform(noseH,parts.holdingPawlNose),s.H.center,p.noseRadius),
      pin:gap(slot,transform(pin,parts.rodPin),[p.rodX,s.rodY],p.pinRadius)},
    range=pawlFrictionIntervals(s,.2),load=2.2,
    basis=range.intervals.find(x=>load>=x.low-1e-9&&load<=x.high+1e-9);
  for(const [kind,result] of Object.entries(contacts)){
    maximumGap=Math.max(maximumGap,result.distance);checks+=result.checks;
    if(result.distance>1e-6)failures.push({cycle,phase,kind,...result});
  }
  if(!basis)throw new Error('No finite-candidate force equilibrium');
  const residual=[s.B.gravityMoment,s.H.gravityMoment,load];
  for(let j=0;j<3;j++){
    const force=basis.base[j]+load*basis.slope[j],column=range.columns[basis.chosen[j]],slip=range.sliding.find(x=>x.kind===column.kind&&x.feature===column.feature);
    minimumReaction=Math.min(minimumReaction,force);
    for(let k=0;k<3;k++)residual[k]+=force*column.column[k];
    if(slip)minimumDissipation=Math.min(minimumDissipation,-force*.2*column.sign*slip.slip);
  }
  maximumResidual=Math.max(maximumResidual,...residual.map(Math.abs));
  for(const slip of range.sliding){maximumSlipNormal=Math.max(maximumSlipNormal,Math.abs(slip.normalVelocity));maximumPawlSpeed=Math.max(maximumPawlSpeed,Math.abs(slip.rotation)/p.period);}
  maximumRodSpeed=Math.max(maximumRodSpeed,Math.abs(p.rodX*s.barVelocity/(p.period*Math.cos(s.barAngle+p.slotAngle)**2)));
  samples.push({cycle,phase,contacts,residual});
}
const file='scripts/lib/reciprocating-pawl-candidate.mjs',report={movement:75,status:'isolated-finite-contact-gap-audit',productionChanged:false,
  poses:samples.length,cycles:[0,7,16,33],maximumGap,checks,maximumResidual,minimumReaction,maximumSlipNormal,minimumDissipation,
  maximumPawlSpeed,maximumRodSpeed,period:p.period,failures,samples,
  source:{file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')},
  qualification:'Finite Float32 wheel/pawl/slot/pin section boundaries; segment-to-segment gaps in XY with overlapping axial spans. Circle outlines come from rendered mesh positions. Contact forces remain planar quasistatic, with Coulomb coefficient 0.2 and resisting load 2.2 at normalized moving-pawl mass 1. Inertia is omitted.'};
await writeFile('artifacts/review/075-clean-candidate-contact-gaps.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({...report,samples:undefined});if(failures.length||minimumReaction< -1e-8||minimumDissipation< -1e-10)process.exitCode=1;
