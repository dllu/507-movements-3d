import {familyMass,rotate} from '../../src/simulation/finite-plate-geometry.js';

const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),scale=(a,s)=>a.map(v=>v*s),
 dot=(a,b)=>a[0]*b[0]+a[1]*b[1],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],J=a=>[-a[1],a[0]];

// Illustrative component masses: native solid volumes share a density, with
// the weight normalized to one unit of mass. Attached solids are summed as
// components, including overlapping attachment material; this is not a union
// volume or a claim about historical materials, dimensions or absolute speed.
export function makeWeightedClutchInertia(candidate,{gravity=9.81,weightMultiplier=1}={}){
 if(!(gravity>0&&Number.isFinite(gravity)&&weightMultiplier>0&&Number.isFinite(weightMultiplier)))throw Error('Invalid inertial parameters');
 const u=candidate.root.userData,L=u.linkage.parameters,
  weight=familyMass({weightF:u.parts.weightF},u.families,'lever'),density=1/weight.volume,
  raw=Object.fromEntries(['lever','bell','rod','shifter','D','shaft','pinion','E'].map(f=>[f,familyMass(u.parts,u.families,f)]));
 const extra=weightMultiplier-1,lever=raw.lever,volume=lever.volume+extra*weight.volume;
 raw.lever={volume,centroid:lever.centroid.map((c,i)=>(c*lever.volume+extra*weight.volume*weight.centroid[i])/volume),
  polar:lever.polar+extra*weight.polar};
 raw.lever.centralPolar=raw.lever.polar-volume*(raw.lever.centroid[0]**2+raw.lever.centroid[1]**2);
 const bodies=Object.fromEntries(Object.entries(raw).map(([f,m])=>[f,{mass:m.volume*density,center:m.centroid.slice(0,2),
  inertia:m.polar*density,centralInertia:m.centralPolar*density}]));
 const kinematics=q=>{
  const pose=u.linkage.atAngle(q),a=sub(pose.A,L.F),b=sub(pose.B,L.G),rod=sub(pose.B,pose.A),
   a1=J(a),a2=scale(a,-1),denominator=dot(rod,J(b));
  if(Math.abs(denominator)<1e-8)throw Error('Four-bar derivative is near a toggle');
  const beta1=dot(rod,a1)/denominator,rod1=sub(scale(J(b),beta1),a1),
   beta2=(-dot(rod1,rod1)+dot(rod,sub(scale(b,beta1**2),a)))/denominator,
   rod2=add(sub(scale(J(b),beta2),scale(b,beta1**2)),a),
   gamma1=cross(rod,rod1)/L.rodLength**2,gamma2=cross(rod,rod2)/L.rodLength**2,
   r=rotate(bodies.rod.center,pose.rodAngle),center=add(pose.A,r),
   center1=add(a1,scale(J(r),gamma1)),center2=add(a2,sub(scale(J(r),gamma2),scale(r,gamma1**2)));
  return{...pose,beta1,beta2,gamma1,gamma2,rodCenter:center,rodCenter1:center1,rodCenter2:center2};
 };
 const linkage=q=>{
  const k=kinematics(q),f=bodies.lever,g=bodies.bell,r=bodies.rod,
   cf=rotate(f.center,q),cg=rotate(g.center,k.bellAngle),
   inertia=f.inertia+g.inertia*k.beta1**2+r.mass*dot(k.rodCenter1,k.rodCenter1)+r.centralInertia*k.gamma1**2,
   inertiaDerivative=2*g.inertia*k.beta1*k.beta2+2*r.mass*dot(k.rodCenter1,k.rodCenter2)+2*r.centralInertia*k.gamma1*k.gamma2,
   potential=gravity*(f.mass*(L.F[1]+cf[1])+g.mass*(L.G[1]+cg[1])+r.mass*k.rodCenter[1]),
   potentialDerivative=gravity*(f.mass*cf[0]+g.mass*cg[0]*k.beta1+r.mass*k.rodCenter1[1]),
   potentialSecond=gravity*(-f.mass*cf[1]+g.mass*(-cg[1]*k.beta1**2+cg[0]*k.beta2)+r.mass*k.rodCenter2[1]);
  if(!(inertia>0&&Number.isFinite(inertia)))throw Error('Nonpositive effective linkage inertia');
  return{...k,inertia,inertiaDerivative,potential,potentialDerivative,potentialSecond};
 };
 const shifter=s=>{
  const b=bodies.shifter,c=rotate(b.center,s);
  return{inertia:b.inertia,potential:gravity*b.mass*(L.F[1]+c[1]),potentialDerivative:gravity*b.mass*c[0],potentialSecond:-gravity*b.mass*c[1]};
 };
 return{parameters:{gravity,weightMultiplier,density,weight,raw,bodies,
  qualification:'Additive native-solid component mass hypothesis, normalized to unit weight mass; attached overlaps are not subtracted. F/G/rod and the independent shifter have analytic kinetic and gravitational energy. No contact or timed motion is imposed.'},
  kinematics,linkage,shifter,freeAcceleration:(q,v)=>{const r=linkage(q);return(-.5*r.inertiaDerivative*v*v-r.potentialDerivative)/r.inertia;}};
}

// Hessian of the active native vertex/edge gap on a smooth feature interval.
// The edge may belong to G or the rotating stud. Corner transitions require
// their own contact/impact treatment; this function does not smooth them away.
export function weightedClutchContactCurvature(contact,inertia,nativeParameters){
 const k=inertia.kinematics(contact.leverAngle),n=contact.normal,
  g=sub(contact.pointA,nativeParameters.G),e=sub(contact.pointB,nativeParameters.E),
  edgeG=contact.supportA.length===2,edgeE=contact.supportB.length===2;
 if(edgeG===edgeE)throw Error('Native contact is not a unique vertex/edge feature');
 const beta=contact.torqueG,ee=edgeG?-dot(n,e):dot(n,e),
  bb=edgeG?-dot(n,g):dot(n,g),be=edgeG?dot(n,e):-dot(n,g),
  q=beta*k.beta1,qq=bb*k.beta1**2+beta*k.beta2,qe=be*k.beta1;
 return{edge:edgeG?'G':'stud',q,e:contact.derivativeE,qq,qe,ee,
  kinematicsAtWheelSpeed:omega=>{
   const velocity=-contact.derivativeE*omega/q,
    acceleration=-(qq*velocity**2+2*qe*velocity*omega+ee*omega**2)/q;
   return{velocity,acceleration};
  }};
}
