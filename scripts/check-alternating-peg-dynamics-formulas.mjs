import fs from 'node:fs';import crypto from 'node:crypto';
import{makeAlternatingPegCandidate}from './lib/alternating-peg-candidate.mjs';
import{makeAlternatingPegDynamics}from './lib/alternating-peg-dynamics-study.mjs';
import{solveContactProjection}from './lib/jointed-tappet-dynamics-study.mjs';
import{add,sub,mul,rotate,cross}from './lib/alternating-peg-contact-study.mjs';
const trajectoryFile=process.env.PROBE_TRAJECTORY||'artifacts/review/077-initial-finite-dynamics.json',previous=JSON.parse(fs.readFileSync(trajectoryFile)),
 candidate=makeAlternatingPegCandidate(previous.geometry),u=candidate.root.userData,p=u.geometry,physics=makeAlternatingPegDynamics(candidate,previous.parameters),
 dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
 errors={volume:0,centroid:0,polar:0,lagrangeForce:0,inputVelocity:0,inputAcceleration:0,jacobian:0,timeDerivative:0,projectionMomentum:0,projectionSlack:0,projectionComplementarity:0},
 counts={massParts:0,states:0,jacobians:0,timeDerivatives:0,projections:0},massRows=[],failures=[];
// Independently integrate each part's XY section with Green's theorem, then extrude.
// Turned parts in this candidate are straight regular-polygon prisms/annuli.
function ringIntegrals(points){
  let area=0,mx=0,my=0,polar=0;
  for(let i=0;i<points.length;i++){
    const[a,b]=[points[i],points[(i+1)%points.length]],cross=a[0]*b[1]-b[0]*a[1];
    area+=cross/2;mx+=(a[0]+b[0])*cross/6;my+=(a[1]+b[1])*cross/6;
    polar+=cross*(a[0]**2+a[0]*b[0]+b[0]**2+a[1]**2+a[1]*b[1]+b[1]**2)/12;
  }
  const sign=Math.sign(area);return{area:area*sign,mx:mx*sign,my:my*sign,polar:polar*sign};
}
const independent={};
for(const[name,mesh]of Object.entries(u.parts)){
  const g=mesh.geometry,position=g.attributes.position,levels=[];
  for(let i=0;i<position.count;i++)levels.push(position.getZ(i));
  const low=Math.min(...levels),high=Math.max(...levels),height=high-low;
  let section={area:0,mx:0,my:0,polar:0};
  if(g.parameters?.shapes){
    for(const shape of g.parameters.shapes)for(const[loop,sign]of[[shape,1],...shape.holes.map(h=>[h,-1])]){
      const integral=ringIntegrals(loop.getPoints(1).map(v=>[Math.fround(v.x),Math.fround(v.y)]));
      for(const key of Object.keys(section))section[key]+=sign*integral[key];
    }
  }else{
    const radii=[...new Set(g.userData.profile.map(v=>v[1]))].sort((a,b)=>a-b),n=g.userData.angularSegments;
    if(radii.length!==2)throw new Error('Expected straight cylinder or annulus');
    for(const[r,sign]of[[radii[1],1],[radii[0],-1]]){
      const integral=ringIntegrals(Array.from({length:n},(_,i)=>[Math.fround(r*Math.cos(i*2*Math.PI/n)),Math.fround(r*Math.sin(i*2*Math.PI/n))]));
      for(const key of Object.keys(section))section[key]+=sign*integral[key];
    }
  }
  const volume=section.area*height,centroid=[section.mx/section.area+mesh.position.x,section.my/section.area+mesh.position.y,(low+high)/2+mesh.position.z],
    polar=height*(section.polar+2*mesh.position.x*section.mx+2*mesh.position.y*section.my+section.area*(mesh.position.x**2+mesh.position.y**2)),family=u.families[name];
  independent[family]??={volume:0,moment:[0,0,0],polar:0};const target=independent[family];
  target.volume+=volume;target.polar+=polar;centroid.forEach((v,i)=>target.moment[i]+=volume*v);counts.massParts++;
}
for(const[family,actual]of Object.entries(u.masses)){
  const expected=independent[family],centroid=expected.moment.map(v=>v/expected.volume),row={family,volumeError:Math.abs(expected.volume/actual.volume-1),centroidError:Math.max(...centroid.map((v,i)=>Math.abs(v-actual.centroid[i]))),polarError:Math.abs(expected.polar/actual.polar-1)};
  massRows.push(row);errors.volume=Math.max(errors.volume,row.volumeError);errors.centroid=Math.max(errors.centroid,row.centroidError);errors.polar=Math.max(errors.polar,row.polarError);
}
const h=Number(process.env.PROBE_DIFFERENCE_STEP||1e-6);
for(let i=0;i<previous.rows.length;i+=180){
 const {x,v,time}=previous.rows[i],input=physics.input(time),F=physics.forces(x,time);
 for(const [j,key]of ['upper','lower'].entries()){
  const m=physics.parameters.mass[key],alpha=x[j+1],speed=v[j+1],r=rotate(m.c,alpha),
   T=(angle,t)=>{const k=physics.input(t).pawls[key],c=rotate(m.c,angle),velocity=add(k.velocity,mul([-c[1],c[0]],speed));
    return .5*m.m*dot(velocity,velocity)+.5*(m.I-m.m*dot(m.c,m.c))*speed*speed;},
   momentum=(angle,t)=>{const c=rotate(m.c,angle);return m.I*speed+m.m*dot(physics.input(t).pawls[key].velocity,[-c[1],c[0]]);},
   potential=angle=>9.81*m.m*rotate(m.c,angle)[1],
   force=(T(alpha+h,time)-T(alpha-h,time))/(2*h)-(momentum(alpha+speed*h,time+h)-momentum(alpha-speed*h,time-h))/(2*h)
    -(potential(alpha+h)-potential(alpha-h))/(2*h);
  errors.lagrangeForce=Math.max(errors.lagrangeForce,Math.abs(force-F[j+1]));
  const k=input.pawls[key],kp=physics.input(time+h).pawls[key],km=physics.input(time-h).pawls[key];
  for(let a=0;a<2;a++){
   errors.inputVelocity=Math.max(errors.inputVelocity,Math.abs((kp.pivot[a]-km.pivot[a])/(2*h)-k.velocity[a]));
   errors.inputAcceleration=Math.max(errors.inputAcceleration,Math.abs((kp.velocity[a]-km.velocity[a])/(2*h)-k.acceleration[a]));
  }
 }
 const rows=physics.constraints(x,time,.004).rows;
 for(const row of rows){
  for(let k=0;k<3;k++){
   const xp=[...x],xm=[...x];xp[k]+=h;xm[k]-=h;
   const rp=physics.constraints(xp,time,.0041).rows.find(r=>r.id===row.id),rm=physics.constraints(xm,time,.0041).rows.find(r=>r.id===row.id);
   if(!rp||!rm)continue;
   errors.jacobian=Math.max(errors.jacobian,Math.abs((rp.gap-rm.gap)/(2*h)-row.J[k]));counts.jacobians++;
  }
  const rp=physics.constraints(x,time+h,.0041).rows.find(r=>r.id===row.id),rm=physics.constraints(x,time-h,.0041).rows.find(r=>r.id===row.id);
  if(rp&&rm){errors.timeDerivative=Math.max(errors.timeDerivative,Math.abs((rp.gap-rm.gap)/(2*h)-row.inputNormalVelocity));counts.timeDerivatives++;}
 }
 counts.states++;
}
let seed=77203;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<200;i++){
 const effective=physics.parameters.inertia.map((I,k)=>I+.001*physics.parameters.damping[k]),inverse=effective.map((I,k)=>effective.map((_,j)=>j===k?1/I:0)),
  free=Array.from({length:3},()=>random()*4-2),feasible=Array.from({length:3},()=>random()*2-1),
  rows=Array.from({length:1+i%9},(_,j)=>({id:String(j),J:Array.from({length:3},()=>random()*2-1)})),b=rows.map(r=>dot(r.J,feasible)-random()*.4),s=solveContactProjection(inverse,free,rows,b);
 if(!s){failures.push({reason:'projection-failed',case:i});continue;}
 for(let k=0;k<3;k++)errors.projectionMomentum=Math.max(errors.projectionMomentum,Math.abs(effective[k]*(s.v[k]-free[k])-rows.reduce((sum,r,j)=>sum+r.J[k]*s.impulses[j],0)));
 rows.forEach((r,j)=>{const slack=dot(r.J,s.v)-b[j];errors.projectionSlack=Math.max(errors.projectionSlack,-slack,-s.impulses[j]);errors.projectionComplementarity=Math.max(errors.projectionComplementarity,Math.abs(slack*s.impulses[j]));});counts.projections++;
}
const tolerances={volume:1e-6,centroid:1e-6,polar:1e-6,lagrangeForce:1e-7,inputVelocity:1e-7,inputAcceleration:1e-7,jacobian:1e-5,timeDerivative:1e-7,projectionMomentum:1e-7,projectionSlack:1e-7,projectionComplementarity:1e-7};
for(const[key,error]of Object.entries(errors))if(error>tolerances[key])failures.push({check:key,error,tolerance:tolerances[key]});
const files=[trajectoryFile,'scripts/check-alternating-peg-dynamics-formulas.mjs','scripts/lib/alternating-peg-candidate.mjs','scripts/lib/alternating-peg-dynamics-study.mjs','scripts/lib/alternating-peg-contact-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'],
 report={movement:77,status:'independent-formula-check',passed:failures.length===0,mechanicsPassed:false,productionChanged:false,differenceStep:h,counts,errors,tolerances,massRows,failures,
 qualification:'Checks mesh masses by independent section integration, imposed-pivot kinematics, generalized forces via numerical Euler-Lagrange derivatives, contact Jacobians and explicit time derivatives, and manufactured three-variable contact projections. Does not certify a working counting cycle or time-step convergence.',
 sources:files.map(file=>({file,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
const output=process.env.PROBE_OUTPUT||'artifacts/review/077-dynamics-formula-check.json';fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log({output,passed:report.passed,counts,errors,failures});if(failures.length)process.exitCode=1;
