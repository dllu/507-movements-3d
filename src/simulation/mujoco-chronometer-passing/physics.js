import {createMujocoSimulation} from '../mujoco/simulation.js';
export function makeChronometerPassingStudy(mujoco,{timestep=.00025,contact=true,period=4}={}){
  const center=[1.0875,2.56625],jewel=[.4875,-.5525],anchor=[1.3475,.1125],free=[1.55875,1.9],normal=[Math.cos(Math.PI/10),Math.sin(Math.PI/10)];
  const points=Array.from({length:17},(_,i)=>{const u=i/16;return[(free[0]-anchor[0])*u-.045*Math.sin(Math.PI*u),(free[1]-anchor[1])*u,0];});
  const geoms=points.slice(1).map((p,i)=>`<geom name="leaf-${i}" type="capsule" fromto="${[...points[i],...p].join(' ')}" size=".026" contype="1" conaffinity="2"/>`).join('');
  const xml=`<mujoco model="313 passive passing spring study"><compiler angle="radian" inertiafromgeom="false"/><option timestep="${timestep}" gravity="0 0 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-10"/><default><geom condim="1" friction="0 0 0" margin=".0003" solref=".002 1" solimp=".99 .999 .001"/><joint solreflimit=".002 1" solimplimit=".99 .999 .001"/></default><worldbody>
    <body name="jewel" mocap="true"><geom name="jewel" type="cylinder" size=".105 .12" contype="${contact?2:0}" conaffinity="${contact?1:0}"/></body>
    <body name="detent" pos="${anchor.join(' ')} 0"><joint name="detent" type="slide" axis="${normal.join(' ')} 0" limited="true" range="0 .4" stiffness="5" damping=".45"/><inertial pos="0 .6 0" mass=".01" diaginertia=".001 .001 .001"/>
      <body name="passing-leaf"><joint name="leaf" axis="0 0 1" limited="true" range="0 1" stiffness=".01" damping=".002"/><inertial pos="0 .9 0" mass=".0001" diaginertia=".0001 .0001 .0001"/>${geoms}</body>
    </body></worldbody></mujoco>`;
  const p=createMujocoSimulation(mujoco,{xml,beforeStep:({data,time})=>{const a=-215*Math.PI/180*Math.cos(2*Math.PI*time/period),c=Math.cos(a),s=Math.sin(a);data.mocap_pos[0]=center[0]+c*jewel[0]-s*jewel[1];data.mocap_pos[1]=center[1]+s*jewel[0]+c*jewel[1];data.mocap_pos[2]=0;}});
  return Object.assign(p,{description:{xml,options:{timestep,contact,period},points,anchor,normal},state(){return{time:p.data.time,q:Array.from(p.data.qpos),v:Array.from(p.data.qvel)};}});
}
