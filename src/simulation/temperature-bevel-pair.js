import * as THREE from 'three';
import {bevelToothGeometry,bevelBodyGeometry} from './bevel-geometry.js';
import {ring} from './finite-plate-geometry.js';
import {matte,PALETTE} from './primitives.js';

export const TEMPERATURE_BEVEL={teeth:24,pitchRadius:.32,innerDistance:.20,outerDistance:.32,pitchConeAngle:Math.PI/4,boreRadius:.067,toothHeight:.06,toothThicknessFactor:.96};

// Shared Tredgold straight-bevel surfaces, with the apex at the group origin.
// The host shaft supplies rotation; phase only establishes tooth/space alignment.
export function makeTemperatureBevel({axis,phase,color,role}){
  const root=new THREE.Group(),rotor=new THREE.Group();root.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);root.add(rotor);rotor.rotation.z=phase;
  const toothGeometry=bevelToothGeometry({...TEMPERATURE_BEVEL,flankSegments:24,tipSegments:8}),material=matte(color,{metalness:.24,roughness:.48});
  const body=new THREE.Mesh(bevelBodyGeometry(toothGeometry,TEMPERATURE_BEVEL.boreRadius),material);body.userData.role='bored-conical-bevel-body';rotor.add(body);
  const hub=new THREE.Mesh(ring(TEMPERATURE_BEVEL.boreRadius,.11,.18,.39,128),material);hub.userData.role='bored-bevel-shaft-hub';rotor.add(hub);
  const teeth=Array.from({length:TEMPERATURE_BEVEL.teeth},(_,i)=>{const tooth=new THREE.Mesh(toothGeometry,i===0?matte(PALETTE.white):material);tooth.rotation.z=i*2*Math.PI/TEMPERATURE_BEVEL.teeth;tooth.userData.bevelTooth=true;tooth.userData.toothIndex=i;rotor.add(tooth);return tooth;});
  root.userData={role,rotor,body,hub,toothMeshes:teeth,phase,...TEMPERATURE_BEVEL,toothProfile:'back-cone-involute-approximation'};
  return root;
}

export function temperatureBevelPhases(screwAxis,screwMountQuaternion){
  const inputAxis=new THREE.Vector3(0,-1,0),outputAxis=new THREE.Vector3(0,0,-1),z=new THREE.Vector3(0,0,1);
  const contactDirection=screwAxis.clone().negate().add(outputAxis).normalize();
  const inputBasis=screwMountQuaternion.clone().multiply(new THREE.Quaternion().setFromUnitVectors(z,inputAxis));
  const outputBasis=new THREE.Quaternion().setFromUnitVectors(z,outputAxis);
  const a=contactDirection.clone().applyQuaternion(inputBasis.clone().invert()),b=contactDirection.clone().applyQuaternion(outputBasis.clone().invert());
  return{inputAxis,outputAxis,contactDirection,inputPhase:Math.atan2(a.y,a.x),outputPhase:Math.atan2(b.y,b.x)+Math.PI/TEMPERATURE_BEVEL.teeth};
}
