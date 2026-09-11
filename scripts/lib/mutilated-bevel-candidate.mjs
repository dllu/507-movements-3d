import * as THREE from 'three';
import { PALETTE, matte, markShadows, setSpin } from '../../src/simulation/primitives.js';
import { bevelToothGeometry } from '../../src/simulation/bevel-geometry.js';
import { turnedClutchGeometry } from '../../src/simulation/clutch-section-geometry.js';

// Isolated geometry/engagement candidate. Counts and proportions are study
// parameters until the source comparison and working-surface audit pass.
export function makeMutilatedBevelCandidate({outputTeeth=32,driverTeeth=40,innerScale=.66,
  outputInnerScale=innerScale,driverInnerScale=innerScale,initialCyclePhase=.25,
  ratio=driverTeeth/outputTeeth,shiftTeeth=.5,toothThicknessFactor=.999}={}){
  if(driverTeeth%2!==0||ratio!==driverTeeth/outputTeeth)throw new Error('Invalid tooth ratio');
  const root=new THREE.Group(),axes={gearA:new THREE.Vector3(-1,0,0),gearB:new THREE.Vector3(1,0,0),driverC:new THREE.Vector3(0,-1,0)};
  const outputRadius=1,driverRadius=ratio,outputAngle=Math.atan(1/ratio),driverAngle=Math.PI/2-outputAngle;
  const module=2/outputTeeth,toothHeight=2.25*module,parts={},blocks={};
  for(const name of ['gearA','gearB','driverC']){
    const isDriver=name==='driverC',axis=axes[name],teeth=isDriver?driverTeeth:outputTeeth,
      angle=isDriver?driverAngle:outputAngle,outerDistance=isDriver?outputRadius:driverRadius,faceScale=isDriver?driverInnerScale:outputInnerScale;
    const gear=new THREE.Group(),rotor=new THREE.Group();gear.add(rotor);gear.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),axis);
    const toothGeometry=bevelToothGeometry({teeth,innerDistance:outerDistance*faceScale,outerDistance,pitchConeAngle:angle,
      toothHeight,toothThicknessFactor,flankSegments:24,tipSegments:8});
    // Smooth the true conical end surface independently of the ruled flanks.
    // Triangulating a narrow curved cap can otherwise average nearly coplanar
    // corner triangles into visibly uneven heel/toe shading.
    const positions=toothGeometry.attributes.position,normals=toothGeometry.attributes.normal,outlineLength=positions.count/6;
    for(let i=0;i<2*outlineLength;i++){
      const x=positions.getX(i),y=positions.getY(i),radius=Math.hypot(x,y),normal=new THREE.Vector3(Math.tan(angle)*x/radius,Math.tan(angle)*y/radius,1).normalize();
      if(i<outlineLength)normal.negate();normals.setXYZ(i,normal.x,normal.y,normal.z);
    }
    const end=toothGeometry.userData.root,color=isDriver?PALETTE.driver:PALETTE.driven,z=end.z,r=end.radius;
    // Each body and its shaft form one closed turned solid. There are no
    // overlapping independent shaft ends at the common pitch-cone apex.
    const back=[[z+.035,r],[z+.10,r*.84],[z+.14,r*.58],[z+.14,.16]];
    const shaft=isDriver?[[z+.19,.22],[z+.23,.22],[z+.23,.11],[z+.52,.11],[z+.52,.22],
      [z+.56,.22],[z+.61,.16],[z+.98,.15],[z+1.02,.11],[z+1.02,0]]
      :[[z+.18,.10],[z+.18,.075],[z+.52,.075],[z+.55,.05],[z+.55,0]];
    const profile=[[z*faceScale,0],[z*faceScale,r*faceScale],[z,r],...back,...shaft];
    const bodyGeometry=turnedClutchGeometry(profile,{angularSegments:192,color});
    const position=bodyGeometry.attributes.position,colors=bodyGeometry.attributes.color,shaftColor=new THREE.Color(PALETTE.ink);
    for(let i=0;i<position.count;i++)if(position.getZ(i)>z+.145)colors.setXYZ(i,shaftColor.r,shaftColor.g,shaftColor.b);
    const body=new THREE.Mesh(bodyGeometry,new THREE.MeshStandardMaterial({vertexColors:true,metalness:.17,roughness:.61}));
    const toothMeshes=[],installedToothIndices=Array.from({length:isDriver?driverTeeth/2:teeth},(_,i)=>i);
    rotor.add(body);parts[name+'Body']=body;
    for(const index of installedToothIndices){
      const tooth=new THREE.Mesh(toothGeometry,matte(color,{metalness:.17,roughness:.6}));
      tooth.rotation.z=index*2*Math.PI/teeth;tooth.userData={index,bevelTooth:true};rotor.add(tooth);toothMeshes.push(tooth);
    }
    Object.assign(gear.userData,{rotor,body,toothMeshes,installedToothIndices,teeth,pitchConeAngle:angle,axis,profile,
      innerDistance:outerDistance*faceScale,outerDistance});
    blocks[name]=gear;root.add(gear);
  }
  const period=8,shift=shiftTeeth/driverTeeth,outputPitch=2*Math.PI/outputTeeth;
  const progress=(u,start)=>{const v=u-start,cycle=Math.floor(v),phase=v-cycle;return ratio*(Math.PI*cycle+2*Math.PI*Math.min(.5,phase));};
  const stateAtTime=time=>{
    const u=initialCyclePhase+time/period,phaseA=((u-(.5-shift))%1+1)%1,phaseB=((u+shift)%1+1)%1;
    return{coordinate:u,driverAngle:-2*Math.PI*u,
      angleA:-Math.PI/2-outputPitch/2-ratio*2*Math.PI*shift+progress(u,.5-shift),
      angleB:-Math.PI/2-outputPitch/2-ratio*2*Math.PI*shift+progress(u,-shift),
      indexingA:phaseA<.5,indexingB:phaseB<.5,
      qualification:'Prescribed ideal indexing law under investigation; no positive dwell lock or verified tooth-contact law is claimed.'};
  };
  const update=time=>{const state=stateAtTime(time);setSpin(blocks.driverC,state.driverAngle);setSpin(blocks.gearA,state.angleA);setSpin(blocks.gearB,state.angleB);root.userData.kinematics=state;};
  root.userData={mechanism:'isolated-mutilated-bevel-candidate',fidelity:'candidate',hideGround:true,cameraFov:8,
    shadowCameraHalfExtent:2.8,shadowBias:-.00003,parts,blocks,stateAtTime,
    geometry:{outputTeeth,driverTeeth,ratio,innerScale,outputInnerScale,driverInnerScale,outputAngle,driverAngle,outputRadius,driverRadius,module,toothHeight,
      toothThicknessFactor,shiftTeeth,period,initialCyclePhase},
    qualification:'Isolated reconstruction study. Source tooth counts, complete source fit, tooth engagement, dwell behavior and hardware clearance are not accepted.'};
  update(0);markShadows(root);return{root,update,cameraDirection:new THREE.Vector3(0,0,10)};
}
