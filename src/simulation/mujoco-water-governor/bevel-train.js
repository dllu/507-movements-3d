import * as THREE from 'three';
import {bevelToothGeometry} from '../bevel-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
import {disposeObject3D} from '../dispose-model.js';

// Source-sized candidate. Tooth counts are inferred; the engraved lower train
// is an equal-ratio reversing set, with different visible face widths.
export function makeWaterGovernorBevels(){
 const root=new THREE.Group(),parts={},blocks={},families={};
 const teeth=30,outerRadius=37*.018,module=outerRadius/(teeth/2+1.0125/Math.sqrt(2)),pitchRadius=module*teeth/2;
 const rootDistance=pitchRadius+2.25*module*.55/Math.sqrt(2);
 const parameters={teeth,module,pitchRadius,outerRadius,bore:.155,topApex:[0,4.3+(55-316)*.018,0],lowerApex:[0,4.3+(55-414)*.018,0],toothThicknessFactor:.94};
 const specs=[
  ['upperInput',parameters.topApex,[-1,0,0],.80,.12,PALETTE.driver],
  ['spindleDrive',parameters.topApex,[0,1,0],.80,.10,PALETTE.brass],
  ['upperLoose',parameters.lowerApex,[0,1,0],.468/rootDistance,.21,PALETTE.driven],
  ['lowerLoose',parameters.lowerApex,[0,-1,0],.378/rootDistance,.15,PALETTE.driven],
  ['gateOutput',parameters.lowerApex,[-1,0,0],.70,.19,PALETTE.accent],
 ];
 for(const [name,apex,axis,innerScale,backRise,color]of specs){
  const gear=new THREE.Group(),rotor=new THREE.Group();gear.position.set(...apex);
  gear.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...axis));
  rotor.name='body:'+name;gear.add(rotor);root.add(gear);blocks[name]=rotor;
  const geometry=bevelToothGeometry({teeth,innerDistance:pitchRadius*innerScale,outerDistance:pitchRadius,pitchConeAngle:Math.PI/4,toothHeight:2.25*module,toothThicknessFactor:parameters.toothThicknessFactor,flankSegments:24,tipSegments:8});
  const material=matte(color,{roughness:.62,metalness:.12});material.fog=false;
  // A shallow conical backplate rises toward the bore, as drawn behind the teeth.
  const r=geometry.userData.root;
  const profile=[[parameters.bore,r.z*innerScale],[r.radius*innerScale,r.z*innerScale],[r.radius,r.z],[parameters.bore,r.z+backRise],[parameters.bore,r.z*innerScale]].map(p=>new THREE.Vector2(...p));
  const bodyGeometry=new THREE.LatheGeometry(profile,96);bodyGeometry.rotateX(Math.PI/2);
  const body=new THREE.Mesh(bodyGeometry,material);body.name=name+'Body';rotor.add(body);parts[body.name]=body;families[body.name]=name;
  for(let i=0;i<teeth;i++){const tooth=new THREE.Mesh(geometry,material);tooth.name=name+'Tooth'+i;tooth.rotation.z=2*Math.PI*i/teeth;rotor.add(tooth);parts[tooth.name]=tooth;families[tooth.name]=name;}
 }
 const update=({spindle=0,upper=0,lower=0,output=0}={})=>{
  blocks.upperInput.rotation.z=Math.PI/2-spindle;
  blocks.spindleDrive.rotation.z=Math.PI-Math.PI/teeth+spindle;
  blocks.gateOutput.rotation.z=Math.PI/2-output;
  blocks.upperLoose.rotation.z=Math.PI-Math.PI/teeth+upper;
  blocks.lowerLoose.rotation.z=Math.PI-Math.PI/teeth-lower;
  root.updateMatrixWorld(true);
 };
 Object.assign(root.userData,{parts,blocks,families,parameters,hideGround:true});update();markShadows(root);
 return{root,update,dispose:()=>disposeObject3D(root)};
}
