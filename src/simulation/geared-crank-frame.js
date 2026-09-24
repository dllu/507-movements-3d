import * as THREE from 'three';
import {plate,poly,circle,capsule,disk,polygonClipping as clip} from './finite-plate-geometry.js';
import {gearedCrankSource as g,gearedCrankState,sourcePoint,groovePoint} from './geared-crank-source.js';
import {matte,PALETTE} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';

// Brown's oblong is a grooved band on the large gear's face: two walls with
// the working channel between them, seated on the front of the spokes clear
// of the pinion. The long lever's pin runs in the channel.
export const gearedCrankGroove={pinRadius:4.5*g.scale,channelHalfWidth:4.7*g.scale,bandHalfWidth:9.5*g.scale,low:-.07,high:.09};
const offsetCurve=(distance,count=512)=>Array.from({length:count},(_,i)=>{
 const a=2*Math.PI*i/count,h=1e-5,p=groovePoint(a),t=groovePoint(a+h).sub(groovePoint(a-h)).normalize();
 // The centre line runs counter-clockwise; its outward normal is (t.y,-t.x).
 return [p.x+distance*t.y,p.y-distance*t.x];
});

export function makeGearedCrankFrame(){
 const root=new THREE.Group(),lever=new THREE.Group(),drive=new THREE.Group(),fixed=new THREE.Group(),parts={},families={};root.add(lever,drive,fixed);
 lever.name='lever';drive.name='drive';fixed.name='fixed';
 const material=matte(PALETTE.driver,{roughness:.65,metalness:.14});material.fog=false;
 const add=(name,geometry,body)=>{const mesh=new THREE.Mesh(geometry,material);mesh.name=name;body.add(mesh);parts[name]=mesh;families[name]=body.name;return mesh;};
 const G=gearedCrankGroove,ring=(a,b)=>clip.difference(poly(offsetCurve(a)),poly(offsetCurve(b)));
 add('oblong-groove-outer-wall',plate(ring(G.bandHalfWidth,G.channelHalfWidth),G.low,G.high),drive);
 add('oblong-groove-inner-wall',plate(ring(-G.channelHalfWidth,-G.bandHalfWidth),G.low,G.high),drive);
 const p=sourcePoint(g.pivot).toArray(),pin=sourcePoint(g.pin).toArray(),eye=sourcePoint(g.eye).toArray();
 // One rigid bent lever: long arm to the groove pin, short arm to the eye.
 const outline=clip.union(capsule(p,pin,.13,48),capsule(pin,eye,.10,48),poly(circle(p,.32,64)),poly(circle(pin,.2,64)),poly(circle(eye,.32,64)));
 const shape=clip.difference(outline,poly(circle(p,.163,64)),poly(circle(eye,.14,64)));
 lever.position.set(...p,0);
 add('rocking-lever',plate(shape,.12,.22).translate(-p[0],-p[1],0),lever);
 add('groove-pin',disk(G.pinRadius,-.055,.22,64).translate(pin[0]-p[0],pin[1]-p[1],0),lever);
 add('groove-pin-head',disk(.17,.22,.27,64).translate(pin[0]-p[0],pin[1]-p[1],0),lever);
 add('rear-supported-gear-shaft',disk(.18,-.8,.18,64),fixed);
 add('rocker-pivot',disk(.16,.18,.60,64).translate(...p,0),fixed);
 add('rocker-pivot-retainer',disk(.21,.56,.60,64).translate(...p,0),fixed);
 const source=gearedCrankState(0);
 const update=time=>{const s=gearedCrankState(time);drive.rotation.z=s.rotation;lever.rotation.z=s.leverAngle;root.updateMatrixWorld(true);return s;};
 root.userData={parts,families,blocks:{lever,drive,fixed},reconstructionStatus:'candidate',hideGround:true,groove:G,initialState:source};update(0);
 return {root,update,dispose:()=>disposeObject3D(root)};
}
