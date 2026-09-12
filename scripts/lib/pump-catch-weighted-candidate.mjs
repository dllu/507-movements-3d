import * as THREE from 'three';
import {makePumpCatchCandidate} from './pump-catch-candidate.mjs';
import {poly,plate,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import {conformingPlateMesh} from '../../src/simulation/conforming-plate-mesh.js';
import {matte,PALETTE,markShadows} from '../../src/simulation/primitives.js';

export function makePumpCatchWeightedCandidate({headBackDepth=0}={}){
  if(headBackDepth<0||headBackDepth>.11)throw Error('Head thickness must retain clearance in front of the loose wheel');
  const model=makePumpCatchCandidate(),u=model.root.userData;u.candidateOptions={headBackDepth};
  if(headBackDepth){
    const pivot=u.geometry.pivot,cut=pivot[1]+u.geometry.pinRadius+.015,
      profile=clip.intersection(u.profiles.catch,poly([[-3,cut],[3,cut],[3,3],[-3,3]])),geometry=conformingPlateMesh(plate(profile,-headBackDepth,0));
    geometry.translate(-pivot[0],-pivot[1],0);const mesh=new THREE.Mesh(geometry,matte(PALETTE.brass,{metalness:.20,roughness:.58}));mesh.name='catchHeadBack';
    u.blocks.catch.add(mesh);u.parts[mesh.name]=mesh;u.families[mesh.name]='catch';
    u.geometry.headBackDepth=headBackDepth;u.geometry.headWeightQualification='Extra thickness behind the existing head contour is an explicit hidden-depth assumption. It changes gravity bias and inertia while preserving the complete front silhouette and contact face.';
  }
  model.setState();markShadows(model.root);return model;
}
