import {rigidFamilyInertia} from '../mujoco/mass.js';
import {createMujocoSimulation} from '../mujoco/simulation.js';
import {convexPlatePieces} from '../mujoco-treadle/collision.js';

const vec = values => values.map(v => Number(v.toPrecision(12))).join(' ');

export function buildSpringSectorMjcf(visual, {timestep = .00025, period = 4, amplitude = .22,
  stiffness = 40, damping = 12, friction = .25, contactTime = .002, settlingTime = 1,
  motorStiffness = 10000, motorDamping = 100} = {}) {
  const u = visual.root.userData, g = u.geometry, assets = [], collision = {};
  const mass = Object.fromEntries(['wheel', 'shaft', 'front', 'rear', 'rod', 'slider'].map(name => [name, rigidFamilyInertia(u.parts, u.families, name)]));
  const density = 1 / mass.front.volume;
  const inertial = name => `<inertial pos="${vec(mass[name].centroid)}" mass="${mass[name].volume * density}" fullinertia="${vec(mass[name].inertia.map(v => v * density))}"/>`;
  const meshCollider = (name, vertices, mask) => {
    assets.push(`<mesh name="${name}" vertex="${vec(vertices.flat())}"/>`);
    return `<geom name="${name}" type="mesh" mesh="${name}" contype="${mask}" conaffinity="${mask === 1 ? 2 : 1}"/>`;
  };
  let wheelGeoms = '';
  for (let tooth = 0; tooth < g.wheelTeeth; tooth++) {
    const positions = u.parts['wheelTooth' + tooth].geometry.attributes.position, unique = new Map();
    for (let i = 0; i < positions.count; i++) {
      const p = [positions.getX(i), positions.getY(i), positions.getZ(i)]; unique.set(p.join(','), p);
    }
    wheelGeoms += meshCollider('wheelTooth' + tooth, [...unique.values()], 1);
  }
  wheelGeoms += `<geom name="wheelBody" type="cylinder" size="${g.wheelOuterRadius} ${(g.wheelTop - g.wheelBottom) / 2}" pos="0 ${(g.wheelTop + g.wheelBottom) / 2} 0" quat=".707106781187 .707106781187 0 0" contype="1" conaffinity="2"/>`;
  const sectors = ['front', 'rear'].map((name, side) => {
    // Only these exterior plate surfaces can meet the crown. The native hole
    // contours stay > .19 above its highest point throughout the guide range
    // and the checked +/- .235 shaft envelope (see the mechanical tests).
    const shape = convexPlatePieces(u.parts[name + 'Sector'].geometry); collision[name] = shape;
    const geoms = shape.cells.map((cell, i) => meshCollider(name + i, [shape.low, shape.high].flatMap(z => cell.map(p => [...p, z])), 2)).join('');
    return `<body name="${name}" pos="0 0 ${(side ? -1 : 1) * g.wheelPitchRadius}"><joint name="${name}" type="slide" axis="0 1 0" limited="true" range="-.06 .18" stiffness="${stiffness}" springref="-.06" damping="${damping}"/>${inertial(name)}${geoms}</body>`;
  }).join('');
  const {pin, end, direction} = u.linkage, rodEnd = end.map((v, i) => v - pin[i]);
  const xml = `<mujoco model="083 spring sectors"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-9" cone="elliptic" impratio="10"/>
    <default><joint limited="false"/><geom friction="${friction} .001 .001" condim="3" margin=".00001" solref="${contactTime} 1" solimp=".999 .9999 .0001"/>
      <equality solref=".002 1" solimp=".999 .9999 .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="wheel"><joint name="wheel" type="hinge" axis="0 1 0" damping=".05" frictionloss=".01"/>${inertial('wheel')}${wheelGeoms}</body>
      <body name="shaft"><joint name="shaft" type="hinge" axis="0 0 1" damping=".05"/>${inertial('shaft')}${sectors}
        <body name="rod" pos="${vec([...pin, 0])}"><joint name="rod" type="hinge" axis="0 0 1" damping=".01"/>${inertial('rod')}<site name="rodEnd" pos="${vec([...rodEnd, g.wheelPitchRadius])}"/></body>
      </body>
      <body name="slider" pos="${vec([...end, 0])}"><joint name="slider" type="slide" axis="${vec([...direction, 0])}" damping=".1"/>
        ${inertial('slider')}<site name="sliderPin" pos="0 0 ${g.wheelPitchRadius}"/></body>
    </worldbody><equality><connect site1="rodEnd" site2="sliderPin"/></equality>
    <actuator><position name="input" joint="slider" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  return {xml, mass, density, collision, options: {timestep, period, amplitude, stiffness, damping, friction, contactTime, settlingTime, motorStiffness, motorDamping}};
}

export function makeSpringSectorPhysics(mujoco, visual, options = {}) {
  const description = buildSpringSectorMjcf(visual, options), p = description.options;
  const physics = createMujocoSimulation(mujoco, {
    xml: description.xml,
    initialize: ({model, data, id}) => {
      const set = (name, value) => { data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT', name)]] = value; };
      set('wheel', .07233930452344918); set('front', .12); set('rear', .12);
      data.ctrl[0] = 0;
      for (let i = 0; i < Math.round(p.settlingTime / p.timestep); i++) mujoco.mj_step(model, data);
      data.time = 0;
    },
    beforeStep: ({data, time}) => {
      const shaftAngle = p.amplitude * Math.sin(2 * Math.PI * time / p.period);
      data.ctrl[0] = visual.root.userData.linkage.atAngle(shaftAngle).slider;
    },
  });
  const joints = Object.fromEntries(['wheel', 'shaft', 'front', 'rear', 'rod', 'slider'].map(name => {
    const id = physics.id('mjOBJ_JOINT', name); return [name, {q: physics.model.jnt_qposadr[id], v: physics.model.jnt_dofadr[id]}];
  }));
  const bodies = Object.fromEntries(Object.keys(joints).map(name => [name, physics.id('mjOBJ_BODY', name)]));
  return Object.assign(physics, {description, joints, bodies});
}
