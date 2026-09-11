import {add,rotate} from '../../src/simulation/finite-plate-geometry.js';
import {makeCrossedRackContact,dot,cross,mul} from './crossed-rack-contact-study.mjs';
import {advanceAlternatingPegStep} from './alternating-peg-dynamics-study.mjs';

export function makeCrossedRackDynamics(candidate,{period=8,amplitude=.12,damping=[.05,.008,.008],payload=0,stopAt=null}={}){
 const u=candidate.root.userData,p=u.geometry,contact=makeCrossedRackContact(candidate),density=1/u.masses.right.volume,
  mass=Object.fromEntries(['rack','left','right'].map(key=>{const m=u.masses[key];return[key,{m:m.volume*density,I:m.polar*density,c:m.centroid.slice(0,2)}];})),
  inertia=[mass.rack.m+payload,mass.left.I,mass.right.I],omega=2*Math.PI/period;
 if(!(period>0&&amplitude>0&&payload>=0))throw Error('Invalid input or payload');
 if(stopAt!==null&&Math.abs(Math.cos(omega*stopAt))>1e-10)throw Error('Input can stop only at a zero-speed reversal');
 const input=time=>{
  const stopped=stopAt!==null&&time>=stopAt,t=stopped?stopAt:time,a=omega*t,
   q=amplitude*Math.sin(a),v=stopped?0:amplitude*omega*Math.cos(a),acceleration=stopped?0:-amplitude*omega*omega*Math.sin(a),
   pawls=Object.fromEntries(['left','right'].map(key=>{
    const arm=rotate(p.anchors[key],q),tangent=[-arm[1],arm[0]];
    return[key,{pivot:arm,velocity:mul(tangent,v),acceleration:add(mul(tangent,acceleration),mul(arm,-v*v))}];
   }));
  return{q,v,acceleration,pawls,stopped};
 };
 const forces=(x,time)=>{
  const k=input(time);return[-inertia[0]*9.81,...['left','right'].map((key,i)=>{
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
 return{parameters:{period,amplitude,damping,payload,stopAt,density,mass,inertia,omega,coulomb:0},input,forces,constraints,contact,
  initial:{time:0,x:[0,0,0],v:[0,0,0],active:[]}};
}

// The projection works in three generalized coordinates. Here its first
// diagonal is a translational mass and its first coordinate is rack height.
export const advanceCrossedRackStep=advanceAlternatingPegStep;
