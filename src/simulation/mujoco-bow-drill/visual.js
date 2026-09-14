import * as THREE from 'three';
import {makeBowDrillGeometry,bowDrillTube} from './geometry.js';
import {makeBowDrillPhysics} from './physics.js';
import {createPhysicsPlayback} from '../mujoco/simulation.js';
import {disposeObject3D} from '../dispose-model.js';
export {THREE};

/** Review candidate only; production registration waits for qualification. */
export function makeMujocoBowDrill(mujoco,options={}) {
  const visual=makeBowDrillGeometry(options),u=visual.root.userData,f=u.profile;
  let physics;
  try {physics=makeBowDrillPhysics(mujoco,visual,options);}catch(error){disposeObject3D(visual.root);throw error;}
  const direction=new THREE.Vector3(...physics.description.direction),stock=u.parts.stock.geometry;
  const rest=stock.attributes.position.array.slice(),weights=new Float64Array(rest.length/3);
  const lowerStock=[(u.source.anchors.lower[0]-u.source.axis[0])/100,(u.source.axis[1]-u.source.anchors.lower[1])/100];
  for(let i=0;i<weights.length;i++) {
    const s=((rest[3*i]-lowerStock[0])*u.source.direction[0]+(rest[3*i+1]-lowerStock[1])*u.source.direction[1])/(u.source.chordLength/100);
    const t=Math.max(0,Math.min(1,(s-.05)/.9));weights[i]=1-t*t*(3-2*t);
  }
  const bounds=u.cameraFitBounds.clone().expandByScalar(.2);
  Object.assign(u,{cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
  const sync=()=>{
    const {data,model,bodies,joints}=physics;mujoco.mj_forward(model,data);
    for(const name of ['bow','spindle']) {const id=bodies[name];u.blocks[name].position.fromArray(data.xpos,3*id);u.blocks[name].quaternion.set(data.xquat[4*id+1],data.xquat[4*id+2],data.xquat[4*id+3],data.xquat[4*id]);}
    const tension=data.qpos[joints.tension.q];
    for(const name of ['lowerBinding','lowerBindingLead'])u.parts[name].position.copy(direction).multiplyScalar(-tension);
    for(let i=0;i<weights.length;i++)for(let k=0;k<3;k++)stock.attributes.position.array[3*i+k]=rest[3*i+k]-direction.getComponent(k)*tension*weights[i];
    stock.attributes.position.needsUpdate=true;stock.computeVertexNormals();stock.computeBoundingSphere();
    const points=physics.getCordPoints();
    const geometry=bowDrillTube(points,points.map(()=>f.cordRadius));u.parts.initialCord.geometry.dispose();u.parts.initialCord.geometry=geometry;
    visual.root.updateMatrixWorld(true);
    return u.state={time:data.time,qpos:Object.fromEntries(Object.entries(joints).map(([n,j])=>[n,data.qpos[j.q]])),qvel:Object.fromEntries(Object.entries(joints).map(([n,j])=>[n,data.qvel[j.v]])),contacts:data.ncon};
  };
  const playback=createPhysicsPlayback(physics,sync);let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;physics.dispose();disposeObject3D(visual.root);};
  Object.assign(u,{mechanism:'mujoco-bow-drill',simulationBackend:'mujoco',physics,
    fidelity:'authored',reconstructionStatus:'under-review',supportsRestart:true,
    reconstructionNote:'Experimental reconstruction: a finite cord turns the spindle through friction. Bow compliance, cord material and depths are inferred; moving clearance and transmission accuracy remain under review.',
    animationTiming:{authoredCyclePeriod:physics.description.options.period,displayCycleDuration:physics.description.options.period,playbackTimeScale:1}});
  try {sync();}catch(error){dispose();throw error;}
  return {...visual,physics,sync,...playback,dispose};
}
