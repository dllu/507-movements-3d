import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';

const vec = values => values.map(v => Number(v.toPrecision(12))).join(' ');

export function makeEccentricYokePhysics(mujoco, visual, {timestep=.001, period=4,
  friction=.05, contactTime=.004, motorStiffness=10000, motorDamping=200} = {}) {
  const u = visual.root.userData, g = u.geometry;
  const mass = Object.fromEntries(['input','yoke'].map(name => [name,rigidFamilyInertia(u.parts,u.families,name)]));
  const density = 1/mass.input.volume;
  const inertial = name => `<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume*density}" fullinertia="${vec(mass[name].inertia.map(v=>v*density))}"/>`;
  // These boxes lie inside the yoke wall; their inner faces coincide with its
  // machined bearing surfaces. The shaft center cannot leave their Y span.
  // The remaining opening contains the entire swept circle with clearance.
  const wallHalfThickness = .01;
  const faces = [-1,1].map(sign=>`<geom name="face${sign<0?'Left':'Right'}" type="box"
    pos="${sign*(g.radius+g.clearance+wallHalfThickness)} 0 0" size="${wallHalfThickness} ${g.workingHalfHeight} ${g.depth/2}"
    contype="2" conaffinity="1"/>`).join('');
  const xml = `<mujoco model="090 eccentric and elongated yoke"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="60" tolerance="1e-9" cone="elliptic"/>
    <default><geom friction="${friction} .001 .001" condim="3" solref="${contactTime} 1" solimp=".999 .9999 .0001"/></default>
    <worldbody>
      <body name="input"><joint name="input" type="hinge" axis="0 0 1" damping=".02"/>${inertial('input')}
        <geom name="eccentric" type="cylinder" pos="${vec([...g.offset,0])}" size="${g.radius} ${g.depth/2}" contype="1" conaffinity="2"/>
      </body>
      <body name="yoke"><joint name="yoke" type="slide" axis="1 0 0" damping=".02"/>${inertial('yoke')}${faces}</body>
    </worldbody>
    <actuator><position name="motor" joint="input" kp="${motorStiffness}" kv="${motorDamping}"/></actuator>
  </mujoco>`;
  const omega = -2*Math.PI/period;
  const physics = createMujocoSimulation(mujoco,{xml,
    initialize:({model,data,id}) => {
      const input = id('mjOBJ_JOINT','input'), yoke = id('mjOBJ_JOINT','yoke');
      data.qvel[model.jnt_dofadr[input]] = omega;
      data.qpos[model.jnt_qposadr[yoke]] = g.offset[0];
      data.qvel[model.jnt_dofadr[yoke]] = -omega*g.offset[1];
      data.ctrl[0] = motorDamping/motorStiffness*omega;
    },
    beforeStep:({data,time}) => {data.ctrl[0] = omega*time+motorDamping/motorStiffness*omega;},
  });
  const joints = Object.fromEntries(['input','yoke'].map(name => {
    const id = physics.id('mjOBJ_JOINT',name); return [name,{q:physics.model.jnt_qposadr[id],v:physics.model.jnt_dofadr[id]}];
  }));
  const bodies = Object.fromEntries(Object.keys(joints).map(name => [name,physics.id('mjOBJ_BODY',name)]));
  return Object.assign(physics,{joints,bodies,description:{xml,mass,density,wallHalfThickness,
    options:{timestep,period,friction,contactTime,motorStiffness,motorDamping,omega}}});
}
