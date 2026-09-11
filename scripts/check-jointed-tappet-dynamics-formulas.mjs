import{readFile,writeFile}from'node:fs/promises';
import{createHash}from'node:crypto';
import{makeJointedTappetCandidate}from'./lib/jointed-tappet-candidate.mjs';
import{makeJointedTappetDynamics,solveContactProjection}from'./lib/jointed-tappet-dynamics-study.mjs';
import{rotate,add,sub}from'./lib/finite-plate-study.mjs';
const candidate=makeJointedTappetCandidate(),u=candidate.root.userData,p=u.geometry,physics=makeJointedTappetDynamics(candidate),
  previous=JSON.parse(await readFile('artifacts/review/076-initial-dynamics-study.json','utf8')),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),
  errors={volume:0,centroid:0,polar:0,kinetic:0,gravity:0,coriolis:0,jacobian:0,timeDerivative:0,projectionMomentum:0,projectionSlack:0,projectionComplementarity:0},counts={massParts:0,states:0,jacobians:0,timeDerivatives:0,projections:0},massRows=[],failures=[];
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
const m=physics.parameters.mass,h=1e-6;
const positions=x=>({tappet:rotate(m.tappet.c,x[0]),dog:add(rotate(p.B,x[0]),rotate(m.dog.c,x[0]+x[1])),holding:rotate(m.holding.c,x[3])});
for(let i=0;i<previous.rows.length;i+=3){
  const state=previous.rows[i],{x,v,time}=state,{M,G,C}=physics.matrices(x,v),pose=positions(x),plus=positions(x.map((a,k)=>a+h*v[k])),minus=positions(x.map((a,k)=>a-h*v[k]));
  let kinetic=.5*m.wheel.I*v[2]**2;
  for(const family of ['tappet','dog','holding']){
    const velocity=plus[family].map((a,k)=>(a-minus[family][k])/(2*h)),speed=family==='tappet'?v[0]:family==='dog'?v[0]+v[1]:v[3],central=m[family].I-m[family].mass*dot(m[family].c,m[family].c);
    kinetic+=.5*m[family].mass*dot(velocity,velocity)+.5*central*speed**2;
  }
  errors.kinetic=Math.max(errors.kinetic,Math.abs(kinetic-physics.energy(x,v).kinetic)/(1+Math.abs(kinetic)));
  const derivatives=[];
  for(let k=0;k<4;k++){
    const xp=[...x],xm=[...x];xp[k]+=h;xm[k]-=h;
    const Mp=physics.matrices(xp,v).M,Mm=physics.matrices(xm,v).M;
    derivatives.push(Mp.map((row,a)=>row.map((b,c)=>(b-Mm[a][c])/(2*h))));
    const gradient=-(physics.energy(xp,v).potential-physics.energy(xm,v).potential)/(2*h),expected=G[k]+(k===2?physics.parameters.load:0);
    errors.gravity=Math.max(errors.gravity,Math.abs(gradient-expected));
  }
  for(let k=0;k<4;k++){
    let expected=0;for(let a=0;a<4;a++)for(let b=0;b<4;b++)expected+=(derivatives[b][k][a]-.5*derivatives[k][a][b])*v[a]*v[b];
    errors.coriolis=Math.max(errors.coriolis,Math.abs(expected-C[k])/(1+Math.abs(expected)));
  }
  const rows=physics.constraints(x,time,.02).rows;
  for(const row of rows){
    for(let k=0;k<4;k++){
      const xp=[...x],xm=[...x];xp[k]+=h;xm[k]-=h;
      const rp=physics.constraints(xp,time,.0201).rows.find(r=>r.id===row.id),rm=physics.constraints(xm,time,.0201).rows.find(r=>r.id===row.id);
      if(!rp||!rm)continue;
      errors.jacobian=Math.max(errors.jacobian,Math.abs((rp.gap-rm.gap)/(2*h)-row.J[k]));counts.jacobians++;
    }
    if(row.kind==='stud'){
      const rp=physics.constraints(x,time+h,.0201).rows.find(r=>r.id==='stud'),rm=physics.constraints(x,time-h,.0201).rows.find(r=>r.id==='stud');
      if(rp&&rm){errors.timeDerivative=Math.max(errors.timeDerivative,Math.abs((rp.gap-rm.gap)/(2*h)-row.inputNormalVelocity));counts.timeDerivatives++;}
    }
  }
  counts.states++;
}
// Projection manufactured-feasible random constraints: verify KKT stationarity,
// nonnegative impulses, primal feasibility and complementary slackness.
let seed=94731;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/2**32;};
for(let i=0;i<200;i++){
  const x=[random()*3-2,-random()*2,random()*8,-random()*2],{inverse,effective}=physics.matrices(x,[0,0,0,0],.001),free=Array.from({length:4},()=>random()*4-2),feasible=Array.from({length:4},()=>random()*2-1),rows=Array.from({length:1+i%9},(_,j)=>({id:String(j),J:Array.from({length:4},()=>random()*2-1)})),b=rows.map(r=>dot(r.J,feasible)-random()*.4),s=solveContactProjection(inverse,free,rows,b);
  if(!s){failures.push({reason:'projection-failed',case:i});continue;}
  for(let k=0;k<4;k++)errors.projectionMomentum=Math.max(errors.projectionMomentum,Math.abs(dot(effective[k],s.v.map((a,j)=>a-free[j]))-rows.reduce((sum,r,j)=>sum+r.J[k]*s.impulses[j],0)));
  rows.forEach((r,j)=>{const slack=dot(r.J,s.v)-b[j];errors.projectionSlack=Math.max(errors.projectionSlack,-slack,-s.impulses[j]);errors.projectionComplementarity=Math.max(errors.projectionComplementarity,Math.abs(slack*s.impulses[j]));});counts.projections++;
}
const tolerances={volume:1e-6,centroid:1e-6,polar:1e-6,kinetic:1e-6,gravity:1e-7,coriolis:1e-6,jacobian:1e-5,timeDerivative:1e-7,projectionMomentum:1e-7,projectionSlack:1e-7,projectionComplementarity:1e-7};
for(const[key,error]of Object.entries(errors))if(error>tolerances[key])failures.push({check:key,error,tolerance:tolerances[key]});
const files=['scripts/check-jointed-tappet-dynamics-formulas.mjs','scripts/lib/jointed-tappet-candidate.mjs','scripts/lib/finite-plate-study.mjs','scripts/lib/jointed-tappet-dynamics-study.mjs'],sources=[];
for(const file of files)sources.push({file,sha256:createHash('sha256').update(await readFile(file)).digest('hex')});
const report={movement:76,status:'independent-dynamics-formula-check',passed:failures.length===0,mechanicsPassed:false,productionChanged:false,counts,errors,tolerances,massRows,failures,sources,qualification:'Checks rigid-body formulas and contact derivatives at sampled states of the failed first candidate, plus manufactured contact projections. Does not establish valid counting, absence of whole-body interference, or converged transient dynamics.'};
await writeFile(process.env.PROBE_OUTPUT??'artifacts/review/076-dynamics-formula-check.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});console.log({passed:report.passed,counts,errors,failures});process.exitCode=report.passed?0:1;
