export function makeOpposedArmForceStudy(model,{period=8,stroke=model.root.userData.geometry.stroke,gravity=9.81,
 spring={upper:1,lower:.7},restBeta={upper:.65,lower:.65},damping=[.15,.02,.015],coulomb=2}={}){
 const u=model.root.userData,p=u.geometry,omega=2*Math.PI/period,density=2/(u.masses.upper.volume+u.masses.lower.volume),
  masses=Object.fromEntries(Object.entries(u.masses).map(([key,m])=>[key,{mass:density*m.volume,centroid:m.centroid,
   inertia:m.inertia.map(row=>row.map(v=>density*v))}]));
 const input=time=>{
  const sliderX=p.sourceSlider[0]+stroke*Math.sin(omega*time),sliderVelocity=stroke*omega*Math.cos(omega*time),
   sliderAcceleration=-stroke*omega**2*Math.sin(omega*time),k=u.input(sliderX),Y=p.sourceSlider[1];
  for(const key of ['upper','lower']){
   const a=p.arms[key],r=a.jointRadius,f=k.arms[key],q=f.jointAngle,
    Fq=2*r*(sliderX*Math.sin(q)-Y*Math.cos(q)),Fx=2*(sliderX-r*Math.cos(q)),
    Fqx=2*r*Math.sin(q),Fqq=2*r*(sliderX*Math.cos(q)+Y*Math.sin(q)),qx=-Fx/Fq,
    qxx=-(2+2*Fqx*qx+Fqq*qx*qx)/Fq;
   f.psiVelocity=qx*sliderVelocity;f.psiAcceleration=qx*sliderAcceleration+qxx*sliderVelocity**2;
  }
  return{...k,sliderX,sliderVelocity,sliderAcceleration};
 };
 const inertia=[masses.wheel.inertia[2][2],masses.upper.inertia[0][0],masses.lower.inertia[0][0]];
 const coefficients=(key,beta)=>{
  const {mass,centroid:c,inertia:I}=masses[key],s=Math.sin(beta),co=Math.cos(beta),r=p.arms[key].pivotRadius,
   uz=c[1]*s+c[2]*co,Mpb=I[1][0]*s+I[2][0]*co-mass*r*uz,
   dMpp=2*s*co*(I[1][1]-I[2][2])+2*(co*co-s*s)*I[1][2];
  return{Mpb,dMpp,uz};
 };
 const forces=(x,time)=>{
  const k=input(time),wheel=masses.wheel,c=wheel.centroid,result=[-gravity*wheel.mass*(c[0]*Math.cos(x[0])-c[1]*Math.sin(x[0]))];
  for(const [index,key]of ['upper','lower'].entries()){
   const beta=x[index+1],a=k.arms[key],{Mpb,dMpp,uz}=coefficients(key,beta);
   result.push(-Mpb*a.psiAcceleration+.5*dMpp*a.psiVelocity**2+gravity*masses[key].mass*Math.cos(a.psi)*uz+spring[key]*(restBeta[key]-beta));
  }
  return result;
 };
 return{parameters:{period,stroke,gravity,spring,restBeta,damping,coulomb,density,masses,inertia},input,coefficients,forces,
  qualification:'Exact rigid-body force and prescribed-slider study. A finite unilateral contact model has not yet been connected, so this module is not a completed dynamics solver.'};
}
