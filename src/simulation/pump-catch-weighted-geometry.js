import * as THREE from 'three';
import {makePumpCatchCoreGeometry} from './pump-catch-core.js';
import {poly,circle,sector,plate,polygonClipping as clip} from './finite-plate-geometry.js';
import {conformingPlateMesh} from './conforming-plate-mesh.js';
import {matte,PALETTE,markShadows} from './primitives.js';

export function makePumpCatchWeightedGeometry({headBackDepth=0,heelStop=false}={}){
  if(headBackDepth<0||headBackDepth>.11)throw Error('Head thickness must retain clearance in front of the loose wheel');
  const model=makePumpCatchCoreGeometry(),u=model.root.userData;u.candidateOptions={headBackDepth,...(heelStop?{heelStop}: {})};
  if(headBackDepth){
    const pivot=u.geometry.pivot,cut=pivot[1]+u.geometry.pinRadius+.015,
      profile=clip.intersection(u.profiles.catch,poly([[-3,cut],[3,cut],[3,3],[-3,3]])),geometry=conformingPlateMesh(plate(profile,-headBackDepth,0));
    geometry.translate(-pivot[0],-pivot[1],0);const mesh=new THREE.Mesh(geometry,matte(PALETTE.brass,{metalness:.20,roughness:.58}));mesh.name='catchHeadBack';
    u.blocks.catch.add(mesh);u.parts[mesh.name]=mesh;u.families[mesh.name]='catch';
    u.geometry.headBackDepth=headBackDepth;u.geometry.headWeightQualification='Extra thickness behind the existing head contour is an explicit hidden-depth assumption. It changes gravity bias and inertia while preserving the complete front silhouette and contact face.';
  }
  if(heelStop){
    if(headBackDepth!==.1)throw Error('The trial heel lug requires the 0.1-depth head backing');
    const pivot=u.geometry.pivot,radius=.11,lugRadius=.012,beta=.9,minimumAngle=-.12,
      faceAngle=beta+minimumAngle-Math.asin(lugRadius/radius),inner=radius-lugRadius-.01,outer=radius+lugRadius+.01;
    const add=(name,profile,low,high,family,position)=>{
      const mesh=new THREE.Mesh(conformingPlateMesh(plate(profile,low,high)),matte(family==='catch'?PALETTE.brass:PALETTE.driven,{metalness:.20,roughness:.58}));
      mesh.name=name;mesh.position.fromArray(position);u.blocks[family].add(mesh);u.parts[name]=mesh;u.families[name]=family;
    };
    add('catchHeelLug',poly(circle([radius*Math.cos(beta),radius*Math.sin(beta)],lugRadius,48)),-.125,-headBackDepth,'catch',[0,0,0]);
    add('wheelHeelStop',sector(inner,outer,faceAngle-.3,faceAngle,16),-.13,-.105,'wheel',[...pivot,0]);
    u.heelStop={radius,lugRadius,beta,minimumAngle,faceAngle,inner,outer,
      qualification:'A finite head lug and wheel-mounted heel stop behind the source silhouette limit inward catch travel. These hidden details are reconstruction assumptions. Contact comes from both rendered prisms, not an imposed angle clamp.'};
  }
  model.setState();markShadows(model.root);return model;
}
