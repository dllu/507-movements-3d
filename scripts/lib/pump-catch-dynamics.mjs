import {familyMass} from '../../src/simulation/finite-plate-geometry.js';
import {rotate2,cross2} from './pump-catch-contact.mjs';

const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),mul=(M,v)=>M.map(r=>dot(r,v));
export function inverse2(M){const det=M[0][0]*M[1][1]-M[0][1]*M[1][0];if(!(det>1e-12))throw Error('Singular pump mass matrix');return[[M[1][1]/det,-M[0][1]/det],[-M[1][0]/det,M[0][0]/det]];}
export function makePumpCatchDynamics(model,{loadMass=.05,gravity=9.81,drag=0}={}){
  const u=model.root.userData,wheel=familyMass(u.parts,u.families,'wheel'),hook=familyMass(u.parts,u.families,'catch'),pivot=u.geometry.pivot,
    radius=(u.source.center[0]-u.source.visibleRope.x)/u.source.scale,m=hook.volume,A=wheel.polar+m*dot(pivot,pivot)+loadMass*radius**2,B=hook.polar;
  const at=(q,v)=>{
    const P=rotate2(pivot,q[0]),C=rotate2(hook.centroid,q[1]),W=rotate2(wheel.centroid,q[0]),D=m*dot(P,C),E=m*cross2(P,C),M=[[A,D],[D,B]],
      force=[-gravity*(wheel.volume*W[0]+m*P[0])+loadMass*gravity*radius+E*v[1]**2-drag*v[0],-gravity*m*C[0]-E*v[0]**2-drag*v[1]],inverse=inverse2(M);
    return{M,inverse,force,acceleration:mul(inverse,force),energy:.5*dot(v,mul(M,v))+gravity*(wheel.volume*W[1]+m*(P[1]+C[1])-loadMass*radius*q[0])};
  };
  return{at,parameters:{wheel,hook,pivot,radius,loadMass,gravity,drag,A,B}};
}

// Solve the exact two-coordinate mass-metric projection onto linear contact
// half-planes. At most two independent active constraints are needed.
export function projectPumpVelocity(free,inverse,constraints){
  const tolerance=1e-8,valid=v=>constraints.every(c=>dot(c.gradient,v)>=c.target-tolerance),cost=v=>{
    const d=v.map((x,i)=>x-free[i]),M=inverse2(inverse);return dot(d,mul(M,d));};
  if(valid(free))return{velocity:free,active:[]};let best=null;
  const accept=(velocity,active)=>{if(!valid(velocity))return;const score=cost(velocity);if(!best||score<best.score)best={velocity,active,score};};
  const columns=constraints.map(c=>mul(inverse,c.gradient));
  for(let i=0;i<constraints.length;i++){
    const a=constraints[i],d=columns[i],den=dot(a.gradient,d);if(den<1e-14)continue;
    const lambda=(a.target-dot(a.gradient,free))/den;if(lambda<0)continue;
    accept(free.map((v,k)=>v+lambda*d[k]),[{...a,impulse:lambda}]);
  }
  for(let i=0;i<constraints.length;i++)for(let j=i+1;j<constraints.length;j++){
    const a=constraints[i],b=constraints[j],aa=dot(a.gradient,columns[i]),ab=dot(a.gradient,columns[j]),bb=dot(b.gradient,columns[j]),det=aa*bb-ab*ab;
    if(det<1e-14)continue;const ra=a.target-dot(a.gradient,free),rb=b.target-dot(b.gradient,free),la=(ra*bb-rb*ab)/det,lb=(rb*aa-ra*ab)/det;
    if(la<0||lb<0)continue;accept(free.map((v,k)=>v+la*columns[i][k]+lb*columns[j][k]),[{...a,impulse:la},{...b,impulse:lb}]);
  }
  return best;
}

export function pumpCatchStep(dynamics,contact,state,time,step,angularSpeed){
  const mass=dynamics.at(state.q,state.v),free=state.v.map((v,i)=>v+step*mass.acceleration[i]);let q=state.q.map((v,i)=>v+step*free[i]),solution=null;
  for(let iteration=0;iteration<20;iteration++){
    const contacts=contact.query(q,angularSpeed*time),constraints=contacts.map(c=>({...c,target:(dot(c.gradient,q.map((v,i)=>v-state.q[i]))-c.gap)/step}));
    solution=projectPumpVelocity(free,mass.inverse,constraints);if(!solution)return{failed:'Infeasible linear contacts',time,q};
    const next=state.q.map((v,i)=>v+step*solution.velocity[i]),difference=Math.max(...next.map((v,i)=>Math.abs(v-q[i])));q=next;
    if(difference<1e-11){const final=contact.query(q,angularSpeed*time);if(final.some(c=>c.gap< -2e-8))return{failed:'Unresolved finite penetration',time,q,minimumGap:Math.min(...final.map(c=>c.gap))};
      return{time,q,v:solution.velocity,active:solution.active,iterations:iteration+1,free,minimumGap:Math.min(...final.map(c=>c.gap))};}
  }
  return{failed:'Nonlinear contact iteration did not converge',time,q};
}
