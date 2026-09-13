import * as THREE from 'three';
import {makeElasticRatchetStudy} from './spring-pressed-ratchet-elastic.mjs';
import {springRatchetSource} from './spring-pressed-ratchet-source.mjs';
import {plate, poly, circle, capsule, disk, polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {PALETTE, matte, markShadows} from '../../src/simulation/primitives.js';
import {convexPlatePieces} from '../../src/simulation/mujoco-treadle/collision.js';
import {createMujocoSimulation, createPhysicsPlayback} from '../../src/simulation/mujoco/simulation.js';
import {disposeObject3D} from '../../src/simulation/dispose-model.js';

export {THREE};
const vec = a => a.map(x => Number(x.toPrecision(12))).join(' ');

// Isolated dynamic experiment. Two bending hinges per beam element permit
// spatial leaf deflection; torsion and extension are constrained. Axial spring
// placement and end tabs remain hypotheses, not an accepted reconstruction.
export function makeMujocoSpringRatchet(mujoco, {segments = 24, timestep = .0005,
  period = 6, catchStiffness = 1, strongStiffness = 6.75, dampingTime = .04,
  wheelMass = .15, wheelDamping = .2, load = .002, friction = .15,
  leafDensity = .5, leafDepth = .18, strongDepth = .36, leafPlane = .26,
  catchRootPlane = -.20, catchRiseStart = .6, contactTime = .002, contactImpedance = .999,
  settlingTime = 1, motorStiffness = 10000, motorDamping = 100} = {}) {
  const source = springRatchetSource, study = makeElasticRatchetStudy({segments,
    strongRootPixels: 30.682, strongTipPixels: 28.054}), {rods, ratchet} = study;
  const root = new THREE.Group(), parts = {}, families = {}, blocks = {}, bodyNames = [], jointNames = [], assets = [], beams = [];
  const attach = (name, geometry, family, color) => {
    if (!blocks[family]) { blocks[family] = new THREE.Group(); root.add(blocks[family]); }
    const mesh = new THREE.Mesh(geometry, matte(color, {metalness: .18, roughness: .55}));
    mesh.name = name; blocks[family].add(mesh); parts[name] = mesh; families[name] = family;
    return mesh;
  };
  attach('ratchet', plate(clip.difference(poly(ratchet.points), poly(circle([0,0], .17, 128))), -.1, .06), 'wheel', PALETTE.driven);
  attach('driver', disk(source.driverRadius / source.scale, -.45, -.33, 256), 'driver', PALETTE.driver);
  const shape = convexPlatePieces(parts.ratchet.geometry, .00005);
  const wheelGeoms = shape.cells.map((cell, i) => {
    const name = 'toothCell' + i;
    assets.push(`<mesh name="${name}" vertex="${vec([-.1,.06].flatMap(z => cell.flatMap(p => [...p,z])))}"/>`);
    return `<geom name="${name}" type="mesh" mesh="${name}" contype="1" conaffinity="6"/>`;
  }).join('');
  const chains = rods.map((rod, side) => {
    const name = side ? 'C' : 'B', color = side ? PALETTE.muted : PALETTE.brass;
    const stiffness = side ? strongStiffness : catchStiffness, mask = side ? 4 : 2, other = side ? 2 : 4;
    const depth = side ? strongDepth : leafDepth;
    const points = rod.points.map((p,i) => {
      const t = Math.max(0,(i / segments - catchRiseStart) / (1 - catchRiseStart));
      const z = side ? leafPlane : catchRootPlane + (leafPlane - catchRootPlane) * t * t * (3 - 2 * t);
      return new THREE.Vector3(...p,z);
    });
    const frames = rod.lengths.map((_,i) => {
      const x = points[i+1].clone().sub(points[i]), length = x.length(); x.normalize();
      const y = new THREE.Vector3(-x.y,x.x,0).normalize(), z = x.clone().cross(y);
      return {length, quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z)), normal:z};
    });
    beams.push(frames);
    let xml = '';
    for (let i = 0; i < segments; i++) {
      const {length,quaternion} = frames[i], width = (rod.widths[i] + rod.widths[i + 1]) / 2, family = name + i;
      const relative = i ? frames[i-1].quaternion.clone().invert().multiply(quaternion) : quaternion;
      const position = i ? [frames[i-1].length,0,0] : points[0].toArray();
      const mass = leafDensity * length * width * depth;
      const inertia = [width * width + depth * depth, length * length + depth * depth, length * length + width * width].map(v => mass * v / 12);
      const jointStiffness = stiffness * (width / rod.width) ** 3 / (i ? (length + frames[i-1].length) / 2 : length);
      let jointXml = '';
      if (i) for (const [suffix,axis,k] of [['bend','0 0 1',jointStiffness],['lift','0 1 0',jointStiffness * (depth / width) ** 2]]) {
        jointNames.push(family + suffix);
        jointXml += `<joint name="${family + suffix}" type="hinge" axis="${axis}" stiffness="${k}" damping="${k * dampingTime}"/>`;
      }
      const geometry = plate(capsule([0,0], [length,0], width / 2, 12), -depth / 2, depth / 2);
      const positions = geometry.attributes.position, vertices = new Map();
      for (let k = 0; k < positions.count; k++) { const v = [positions.getX(k),positions.getY(k),positions.getZ(k)];vertices.set(v.join(','),v); }
      assets.push(`<mesh name="${family}" vertex="${vec([...vertices.values()].flat())}"/>`);
      xml += `<body name="${family}" pos="${vec(position)}" quat="${vec([relative.w,relative.x,relative.y,relative.z])}">
        <inertial pos="${length / 2} 0 0" mass="${mass}" diaginertia="${vec(inertia)}"/>
        ${jointXml}<geom name="${family}" type="mesh" mesh="${family}" contype="${mask}" conaffinity="${other}"/>`;
      attach(family, geometry, family, color);
      bodyNames.push(family);
      if (i === segments - 1) {
        // A finite axial tab reaches A; the rest of the leaf clears its face.
        const low = (-.03 - leafPlane) / frames[i].normal.z, high = depth / 2;
        xml += `<geom name="${name}tip" type="cylinder" pos="${length} 0 ${(low + high) / 2}" size="${width / 2} ${(high - low) / 2}" contype="${mask}" conaffinity="${other | 1}"/>`;
        const tip = disk(width / 2, low, high, 64); tip.translate(length,0,0);
        attach(name + 'tip', tip, family, color);
      }
    }
    return xml + '</body>'.repeat(segments);
  });
  const p = {segments, timestep, period, catchStiffness, strongStiffness, dampingTime, wheelMass, wheelDamping,
    load, friction, leafDensity, leafDepth, strongDepth, leafPlane, catchRootPlane, catchRiseStart, contactTime, contactImpedance, settlingTime, motorStiffness, motorDamping};
  const xml = `<mujoco model="073 elastic leaf study"><compiler angle="radian" inertiafromgeom="false"/>
    <option timestep="${timestep}" gravity="0 -9.81 0" integrator="implicitfast" solver="Newton" iterations="80" tolerance="1e-9" cone="elliptic"/>
    <default><joint limited="false"/><geom friction="${friction} .001 .001" condim="3" margin=".00001" solref="${contactTime} 1" solimp="${contactImpedance} ${1-(1-contactImpedance)/10} .0001"/></default>
    <asset>${assets.join('')}</asset><worldbody>
      <body name="wheel"><joint name="wheel" type="hinge" axis="0 0 1" damping="${wheelDamping}"/>
        <inertial pos="0 0 0" mass="${wheelMass}" diaginertia="${wheelMass * .2} ${wheelMass * .2} ${wheelMass * .4}"/>${wheelGeoms}</body>
      <body name="driver"><joint name="driver" type="hinge" axis="0 0 1"/>
        <inertial pos="0 0 -.39" mass="1" diaginertia=".6 .6 1.2"/>${chains[0]}</body>
      ${chains[1]}</worldbody><actuator><position name="input" joint="driver" kp="${motorStiffness}" kv="${motorDamping}"/></actuator></mujoco>`;
  let physics;
  try {
    physics = createMujocoSimulation(mujoco, {xml,
      initialize: ({model,data,id}) => {
        data.qpos[model.jnt_qposadr[id('mjOBJ_JOINT','wheel')]] = -.0075;
        data.qfrc_applied[model.jnt_dofadr[id('mjOBJ_JOINT','wheel')]] = load;
        for (let i = 0; i < Math.round(settlingTime / timestep); i++) mujoco.mj_step(model,data);
        data.time = 0;
      },
      beforeStep: ({data,time}) => {
        const speed = -2 * Math.PI / period, ramp = .2, decay = Math.exp(-time / ramp);
        data.ctrl[0] = speed * (time - ramp * (1 - decay)) + motorDamping / motorStiffness * speed * (1 - decay);
      },
    });
  } catch (error) { disposeObject3D(root); throw error; }
  const {model,data} = physics, bodies = Object.fromEntries(['wheel','driver',...bodyNames].map(name => [name,physics.id('mjOBJ_BODY',name)]));
  const joints = Object.fromEntries(['wheel','driver',...jointNames].map(name => {
    const id = physics.id('mjOBJ_JOINT',name); return [name,{q:model.jnt_qposadr[id],v:model.jnt_dofadr[id]}];
  }));
  const sync = () => {
    mujoco.mj_forward(model,data);
    for (const [name,id] of Object.entries(bodies)) {
      blocks[name].position.fromArray(data.xpos,3*id);
      blocks[name].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);
    }
    root.updateMatrixWorld(true);
    const points = rods.map((rod,side) => {
      const name = side ? 'C' : 'B';
      return [...rod.lengths.map((_,i)=>blocks[name+i].position.toArray()),
        new THREE.Vector3(beams[side].at(-1).length,0,0).applyMatrix4(blocks[name+(segments-1)].matrixWorld).toArray()];
    });
    return root.userData.state = {time:data.time,wheelAngle:data.qpos[joints.wheel.q],driverAngle:data.qpos[joints.driver.q],
      wheelSpeed:data.qvel[joints.wheel.v],qpos:Array.from(data.qpos),qvel:Array.from(data.qvel),points};
  };
  const playback = createPhysicsPlayback(physics,sync);
  root.userData = {parts,families,blocks,source,rods,ratchet,physics,p,beams,collision:shape,mechanism:'mujoco-spring-ratchet-study',
    fidelity:'candidate',reconstructionStatus:'under-review',hideGround:true,cameraFov:8,
    cameraFitBounds:new THREE.Box3(new THREE.Vector3(-2.2,-2.3,-.6),new THREE.Vector3(1.7,1.7,.7)),
    animationTiming:{authoredCyclePeriod:period,displayCycleDuration:period,playbackTimeScale:1}};
  Object.assign(physics,{joints,bodies,xml});
  let disposed = false;
  const dispose = () => {if(disposed)return;disposed=true;physics.dispose();disposeObject3D(root);};
  sync();markShadows(root);return {root,physics,sync,...playback,dispose,cameraDirection:new THREE.Vector3(0,0,10)};
}
