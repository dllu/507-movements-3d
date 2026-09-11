import {makeSpringRackContact} from './spring-rack-contact-study.mjs';

export function makeSpringRackDynamics(candidate,{period=2,stiffness=12,preload=.25,damping=.3,gravity=9.81}={}){
 const u=candidate.root.userData,p=u.geometry,contact=makeSpringRackContact(candidate),mass=1,density=mass/u.masses.rack.volume,
  omega=2*Math.PI/period,stop=p.stop.minimumY,upper=p.stop.maximumY;
 const input=time=>({q:-omega*time,v:-omega,acceleration:0}),
  compression=y=>y-stop+preload,
  forces=x=>[-mass*gravity-stiffness*Math.max(0,compression(x[0]))],
  constraints=(x,time,padding=.006)=>{
   const k=input(time),c=contact.pair(k.q,x[0],padding),rows=c.rows.map(r=>({...r,key:'gear-rack',J:[r.J],inputNormalVelocity:r.inputJ*k.v})),
    gaps={gearRack:c.minimumGap,lowerStop:x[0]-stop,upperStop:upper-x[0]};
   if(gaps.lowerStop<padding)rows.push({id:'lower-travel-stop',key:'lower-stop',gap:gaps.lowerStop,J:[1],inputNormalVelocity:0});
   if(gaps.upperStop<padding)rows.push({id:'upper-travel-stop',key:'upper-stop',gap:gaps.upperStop,J:[-1],inputNormalVelocity:0});
   return {rows,gaps};
  },energy=(x,v)=>({kinetic:.5*mass*v[0]*v[0],gravity:mass*gravity*x[0],spring:.5*stiffness*Math.max(0,compression(x[0]))**2});
 // Brown's pose is within an engaged lift. Start with the velocity of its
 // actual supporting face, consistent with the already rotating input.
 const support=constraints([0],0,1e-6).rows.filter(r=>r.J[0]>0).sort((a,b)=>a.gap-b.gap)[0];
 if(!support)throw Error('Source pose has no supporting gear contact');
 const initialVelocity=-support.inputNormalVelocity/support.J[0];
 return {parameters:{period,stiffness,preload,damping:[damping],gravity,mass,density,omega,stop,upper,inertia:[mass],coulomb:0,initialVelocity,initialSupport:support.id},
  input,forces,constraints,energy,compression,contact,initial:{time:0,x:[0],v:[initialVelocity],active:[]},advance:advanceSpringRackStep};
}

export function advanceSpringRackStep(physics,state,dt){
 const time=state.time+dt,{mass,stiffness:k,damping:[d],gravity:g,stop,upper,preload}=physics.parameters,
  y0=state.x[0],v0=state.v[0],effective=mass+dt*d+dt*dt*k,
  free=((mass+dt*d)*y0+dt*mass*v0-dt*dt*(mass*g+k*(preload-stop)))/effective,
  intervals=physics.contact.forbiddenIntervals(physics.input(time).q),feasible=[];
 let low=stop;
 for(const interval of intervals){
  if(interval.high<stop)continue;if(interval.low>upper)break;
  if(interval.low>=low)feasible.push([low,Math.min(upper,interval.low)]);
  low=Math.max(low,interval.high);
 }
 if(low<=upper)feasible.push([low,upper]);
 if(!feasible.length)return{okay:false,reason:'no-finite-clearance-interval',time,intervals};
 const choices=feasible.map(([a,b])=>({y:Math.max(a,Math.min(b,free)),interval:[a,b]})).sort((a,b)=>Math.abs(a.y-free)-Math.abs(b.y-free)),
  y=choices[0].y,v=(y-y0)/dt,impulse=mass*(v-v0)+dt*(mass*g+k*physics.compression(y)+d*v),
  final=physics.constraints([y],time,1e-7),minimumGap=Math.min(...Object.values(final.gaps)),
  touching=final.rows.filter(r=>Math.abs(r.gap)<1e-8&&r.J[0]*impulse>1e-12),
  support=touching.sort((a,b)=>Math.abs(b.J[0])-Math.abs(a.J[0]))[0];
 if(minimumGap< -2e-9)return{okay:false,reason:'finite-interval-penetration',time,x:[y],minimumGap,contact:final};
 if(Math.abs(impulse)>1e-8&&!support)return{okay:false,reason:'no-surface-reaction-for-projection',time,x:[y],impulse,contact:final};
 const contacts=support?[{id:support.id,key:support.key,impulse:impulse/support.J[0],gap:support.gap,J:support.J,
  normal:support.normal,gearPoint:support.gearPoint,rackPoint:support.rackPoint,inputNormalVelocity:support.inputNormalVelocity}]:[],
  inputWork=contacts.reduce((sum,c)=>sum-c.impulse*c.inputNormalVelocity,0),
  dampingWork=-dt*d*v*v,oldEnergy=physics.energy([y0],[v0]),newEnergy=physics.energy([y],[v]),
  total=e=>e.kinetic+e.gravity+e.spring,energyDefect=total(newEnergy)-total(oldEnergy)-inputWork-dampingWork;
 return{okay:true,state:{time,x:[y],v:[v],active:contacts.map(c=>c.id)},diagnostic:{iterations:1,minimumGap,
  freePosition:free,feasibleInterval:choices[0].interval,impulse,contacts,inputWork,dampingWork,energyDefect,
  residual:Math.abs(mass*(v-v0)-dt*(physics.forces([y])[0]-d*v)-contacts.reduce((s,c)=>s+c.J[0]*c.impulse,0))}};
}
