import {rotate} from '../../src/simulation/finite-plate-geometry.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0];

export function makeCrossedRackEnergyStudy(physics){
 const p=physics.parameters;
 const state=row=>{
  const k=physics.input(row.time),{x,v}=row,pawls={};
  let kinetic=.5*p.inertia[0]*v[0]**2,potential=9.81*(p.inertia[0]*x[0]+p.mass.rack.m*p.mass.rack.c[1]);
  for(const [i,key]of ['left','right'].entries()){
   const m=p.mass[key],P=k.pawls[key].pivot,r=rotate(m.c,x[i+1]),w=v[i+1],Mqq=m.m*dot(P,P),Mqa=m.m*dot(P,r),
    T=.5*Mqq*k.v*k.v+Mqa*k.v*w+.5*m.I*w*w,U=9.81*m.m*(P[1]+r[1]);
   kinetic+=T;potential+=U;
   pawls[key]={Mqq,Mqa,momentumQ:Mqq*k.v+Mqa*w,Tq:m.m*k.v*w*cross(P,r),Uq:9.81*m.m*P[0]};
  }
  return{kinetic,potential,energy:kinetic+potential,pawls,k};
 };
 const interval=(before,after,contacts)=>{
  const a=state(before),b=state(after),dt=after.time-before.time,dq=b.k.q-a.k.q,dv=after.v.map((v,i)=>v-before.v[i]),dqv=b.k.v-a.k.v,
   contactQ={left:0,right:0};
  for(const r of contacts){const P=b.k.pawls[r.key].pivot;contactQ[r.key]+=r.impulse*cross(P,r.normal);}
  let inputWork=0,velocityChangeLoss=.5*p.inertia[0]*dv[0]*dv[0];
  for(const [i,key]of ['left','right'].entries()){
   const c=b.pawls[key],actuatorImpulse=c.momentumQ-a.pawls[key].momentumQ-dt*c.Tq+dt*c.Uq-contactQ[key];
   inputWork+=actuatorImpulse*dq/dt;
   velocityChangeLoss+=.5*c.Mqq*dqv*dqv+c.Mqa*dqv*dv[i+1]+.5*p.mass[key].I*dv[i+1]*dv[i+1];
  }
  const dampingWork=dt*after.v.reduce((s,v,i)=>s+p.damping[i]*v*v,0),
   contactVelocityWork=contacts.reduce((s,r)=>s+r.impulse*(dot(r.normal,b.k.pawls[r.key].velocity)+r.J.reduce((s,j,i)=>s+j*after.v[i],0)),0),
   change=b.energy-a.energy,residual=change-inputWork+dampingWork,correctedResidual=residual+velocityChangeLoss-contactVelocityWork;
  return{energy:b.energy,change,inputWork,dampingWork,velocityChangeLoss,contactVelocityWork,residual,correctedResidual};
 };
 return{state,interval};
}
