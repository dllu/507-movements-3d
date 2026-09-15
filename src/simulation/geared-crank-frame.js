import * as THREE from 'three';
import {plate,poly,circle,capsule,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {gearedCrankSource as g,gearedCrankState,sourcePoint,gearedCrankLengths} from './geared-crank-source.js';
import {matte,PALETTE} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
const outer=[[247,217],[300,225],[345,235],[377,251],[397,285],[400,333],[379,362],[347,376],[302,373],[273,365],[215,366],[180,352],[159,328],[151,296],[158,263],[180,236],[216,220]];
const inner=[[247,239],[296,247],[331,251],[359,264],[375,288],[378,326],[357,349],[329,355],[274,344],[218,345],[192,333],[179,313],[178,287],[190,260],[213,244]];
const trace=points=>{
 const curve=new THREE.CatmullRomCurve3(points.map(([x,y])=>new THREE.Vector3(x,y,0)),true,'centripetal');
 return curve.getPoints(256).slice(0,-1).map(p=>sourcePoint([p.x,p.y]).toArray());
};
export function makeGearedCrankFrame(){
 const root=new THREE.Group(),frame=new THREE.Group(),coupler=new THREE.Group(),drive=new THREE.Group(),fixed=new THREE.Group(),parts={},families={};root.add(frame,coupler,drive,fixed);
 frame.name='frame';coupler.name='coupler';drive.name='drive';fixed.name='fixed';
 const material=matte(PALETTE.driver,{roughness:.65,metalness:.14});material.fog=false;
 const add=(name,geometry,body)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;body.add(mesh);parts[name]=mesh;families[name]=body.name;return mesh;};
 const b=sourcePoint(g.joint).toArray(),p=sourcePoint(g.pivot).toArray();
 const outline=clip.union(clip.difference(poly(trace(outer)),poly(trace(inner))),capsule(b,p,.13,48),poly(circle(b,.25,64)),poly(circle(p,.32,64)));
 const shape=clip.difference(outline,poly(circle(b,.123,64)),poly(circle(p,.163,64)));
 add('oblong-rocking-frame',plate(shape,.40,.55).translate(-p[0],-p[1],0),frame);frame.position.set(...p,0);
 const end=[gearedCrankLengths.coupler,0];
 const crankOutline=clip.union(capsule([0,0],end,.105,48),poly(circle([0,0],.23,64)),poly(circle(end,.23,64)));
 add('bored-short-crank',plate(clip.difference(crankOutline,poly(circle([0,0],.123,64)),poly(circle(end,.123,64))),.20,.34),coupler);
 const source=gearedCrankState(0);
 add('rear-supported-gear-shaft',disk(.18,-.8,.18,64),fixed);
 add('eccentric-arm',plate(clip.difference(capsule([0,0],source.wrist.toArray(),.22,64),poly(circle([0,0],.183,64))),-.04,.16),drive);
 add('eccentric-pin',disk(.12,.12,.38,64).translate(source.wrist.x,source.wrist.y,0),drive);
 add('eccentric-pin-retainer',disk(.16,.35,.38,64).translate(source.wrist.x,source.wrist.y,0),drive);
 add('frame-joint-pin',disk(.12,.18,.60,64).translate(b[0]-p[0],b[1]-p[1],0),frame);
 add('frame-joint-retainer',disk(.16,.56,.60,64).translate(b[0]-p[0],b[1]-p[1],0),frame);
 add('rocker-pivot',disk(.16,.18,.60,64).translate(...p,0),fixed);
 add('rocker-pivot-retainer',disk(.21,.56,.60,64).translate(...p,0),fixed);
 const update=time=>{const s=gearedCrankState(time);drive.rotation.z=s.theta-source.theta;frame.rotation.z=s.rockerAngle-source.rockerAngle;coupler.position.set(s.wrist.x,s.wrist.y,0);coupler.rotation.z=s.couplerAngle;root.updateMatrixWorld(true);return s;};
 root.userData={parts,families,blocks:{frame,coupler,drive,fixed},reconstructionStatus:'candidate',hideGround:true};update(0);
 return {root,update,dispose:()=>disposeObject3D(root)};
}
