export function makeOpposedArmEnergyStudy(physics,geometry){
 const p=physics.parameters;
 const state=(x,v,time)=>{
  const k=physics.input(time),wheel=p.masses.wheel,c=wheel.centroid,
   result={kinetic:.5*p.inertia[0]*v[0]**2,potential:p.gravity*wheel.mass*(c[0]*Math.sin(x[0])+c[1]*Math.cos(x[0])),pawls:{}};
  for(const [index,key]of ['upper','lower'].entries()){
   const beta=x[index+1],bd=v[index+1],{mass,centroid:c,inertia:I}=p.masses[key],r=geometry.arms[key].pivotRadius,
    a=k.arms[key],s=Math.sin(beta),co=Math.cos(beta),uy=c[1]*co-c[2]*s,
    Mpp=I[1][1]*s*s+I[2][2]*co*co+2*I[1][2]*s*co+mass*(r*r+2*r*c[0]),
    Mpb=physics.coefficients(key,beta).Mpb,Mbb=I[0][0],pd=a.psiVelocity,
    kinetic=.5*Mpp*pd*pd+Mpb*pd*bd+.5*Mbb*bd*bd,
    potential=p.gravity*mass*((r+c[0])*Math.sin(a.psi)+uy*Math.cos(a.psi))+.5*p.spring[key]*(beta-p.restBeta[key])**2,
    potentialPsi=p.gravity*mass*((r+c[0])*Math.cos(a.psi)-uy*Math.sin(a.psi));
   result.kinetic+=kinetic;result.potential+=potential;
   result.pawls[key]={Mpp,Mpb,Mbb,kinetic,potential,potentialPsi,psi:a.psi,psiVelocity:pd,psiMomentum:Mpp*pd+Mpb*bd};
  }
  result.energy=result.kinetic+result.potential;return result;
 };
 const interval=(before,after,contacts,frictionImpulse)=>{
  const a=state(before.x,before.v,before.time),b=state(after.x,after.v,after.time),dt=after.time-before.time,input={},wheelImpulse={upper:0,lower:0},clockwiseImpulse={upper:0,lower:0};
  for(const row of contacts){wheelImpulse[row.key]+=row.impulse*row.J[0];clockwiseImpulse[row.key]+=Math.max(0,-row.impulse*row.J[0]);}
  for(const key of ['upper','lower']){
   const previous=a.pawls[key],current=b.pawls[key],dpsi=current.psi-previous.psi,
    actuatorImpulse=current.psiMomentum-previous.psiMomentum+dt*current.potentialPsi+wheelImpulse[key];
   input[key]={actuatorImpulse,work:actuatorImpulse*dpsi/dt,psiSpeed:dpsi/dt};
  }
  const inputWork=input.upper.work+input.lower.work,dampingWork=dt*after.v.reduce((s,v,i)=>s+p.damping[i]*v*v,0),
   frictionWork=-frictionImpulse*after.v[0],change=b.energy-a.energy,residual=change-inputWork+dampingWork+frictionWork,
   velocityChangeLoss=.5*after.v.reduce((s,v,i)=>s+p.inertia[i]*(v-before.v[i])**2,0),
   contactVelocityWork=contacts.reduce((sum,row)=>sum+row.impulse*(row.J.reduce((s,j,i)=>s+j*after.v[i],0)-row.J[0]*b.pawls[row.key].psiVelocity),0),
   correctedResidual=residual+velocityChangeLoss-contactVelocityWork;
  return{energy:b.energy,kinetic:b.kinetic,potential:b.potential,change,input,inputWork,dampingWork,frictionWork,residual,velocityChangeLoss,contactVelocityWork,correctedResidual,wheelImpulse,clockwiseImpulse};
 };
 return{state,interval,qualification:'Energy of the wheel and both moving pawls, including prescribed-arm kinetic terms and spring/gravity potentials. Input work follows the prescribed-angle momentum balance. Damping and dry friction are dissipative. Discrete residuals require time-step refinement.'};
}
