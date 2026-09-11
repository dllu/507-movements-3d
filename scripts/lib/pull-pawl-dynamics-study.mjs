import {add,sub,rotate} from '../../src/simulation/finite-plate-geometry.js';
import {makePullPawlContact,dot,cross,mul} from './pull-pawl-contact-study.mjs';
import {advanceAlternatingPegStep} from './alternating-peg-dynamics-study.mjs';

export function makePullPawlDynamics(candidate,{period=8,amplitude=.22,qmid=0,coulomb=6,damping=[.15,.008,.008],theta=-.0175}={}){
 const u=candidate.root.userData,p=u.geometry,contact=makePullPawlContact(candidate),density=1/u.masses.right.volume,
  mass=Object.fromEntries(['wheel','left','right'].map(key=>{const m=u.masses[key];return[key,{m:m.volume*density,I:m.polar*density,c:m.centroid.slice(0,2)}];})),
  inertia=['wheel','left','right'].map(key=>mass[key].I),omega=2*Math.PI/period,phase=Math.asin(-qmid/amplitude);
 if(!Number.isFinite(phase))throw Error('Input must pass the source pose');
 const input=time=>{
  const a=omega*time+phase,q=qmid+amplitude*Math.sin(a),v=amplitude*omega*Math.cos(a),acceleration=-amplitude*omega*omega*Math.sin(a),
   pawls=Object.fromEntries(['left','right'].map(key=>{const arm=rotate(p.arms[key],q),tangent=[-arm[1],arm[0]];
    return[key,{pivot:add(p.A,arm),velocity:mul(tangent,v),acceleration:add(mul(tangent,acceleration),mul(arm,-v*v))}];}));
  return{q,v,acceleration,pawls};
 };
 const forces=(x,time)=>{
  const k=input(time);return[-mass.wheel.m*9.81*rotate(mass.wheel.c,x[0])[0],...['left','right'].map((key,i)=>{
   const m=mass[key],r=rotate(m.c,x[i+1]);return-m.m*(9.81*r[0]+cross(r,k.pawls[key].acceleration));
  })];
 };
 const constraints=(x,time,padding=.003)=>{
  const k=input(time),rows=[],gaps={};
  for(const [i,key]of ['left','right'].entries()){
   const result=contact.pair(key,k.q,x[0],x[i+1],padding);gaps[key]=result.minimumGap;
   for(const f of result.rows){const J=[f.J[0],0,0];J[i+1]=f.J[1];
    rows.push({...f,J,point:f.pawlPoint,inputNormalVelocity:dot(f.normal,k.pawls[key].velocity)});
   }
  }
  return{rows,gaps};
 };
 const seats=Object.fromEntries(['left','right'].map(key=>[key,contact.seat(key,{theta})]));
 if(Object.values(seats).some(s=>!s.okay))throw Error('Initial static seat missing');
 return{parameters:{period,amplitude,qmid,coulomb,damping,theta,phase,density,mass,inertia,omega},input,forces,constraints,contact,
  initial:{time:0,x:[theta,seats.left.alpha,seats.right.alpha],v:[0,0,0],active:[]}};
}

// The existing implicit inertia/friction projection accepts an arbitrary
// three-angle constraint function; only the contact construction above is new.
export const advancePullPawlStep=advanceAlternatingPegStep;
