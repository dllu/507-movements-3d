import * as THREE from 'three';
import contours from './generated-stepped-sector-relief.js';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
export function correctVariableSectors(root){
 const b=root.userData.blocks;
 for(const sector of[...b.driverSectors,...b.outputSectors])replace(sector.children[1],boredLatheGeometry([{radial:.39,axial:-.11},{radial:.39,axial:.11}],.107,64));
 if(contours)for(const[index,sector]of b.outputSectors.entries()){
  sector.userData.generationWebGeometry=sector.children[0].geometry;
  const shape=new THREE.Shape(contours[index].map(p=>new THREE.Vector2(...p))),hole=new THREE.Path();hole.absarc(0,0,.107,0,Math.PI*2,false);shape.holes.push(hole);
  replace(sector.children[0],new THREE.ExtrudeGeometry(shape,{depth:.22,bevelEnabled:false,curveSegments:64}).translate(0,0,-.11));sector.children[1].visible=false;for(const tooth of sector.userData.toothMeshes)tooth.visible=false;sector.userData.finiteProfile='offline-swept-transition-relief';
 }
 for(const index of[b.driverFaceIndex,b.outputFaceIndex]){replace(index.children[0],new THREE.BoxGeometry(.54,.07,.028));index.children[0].position.x=.50;}
 root.userData.hideGround=true;root.userData.minimumDisplayCycleSeconds=12;
 root.userData.reconstructionNote='Four axially separated sector pairs give four output speed ratios. Relieved ends prevent sampled tooth collisions, but the ratio changes remain instantaneous prescribed handoffs; continuous loaded engagement is not modeled. Brown’s animation also warns about these transitions.';
 root.userData.transmission.transitionMethod='offline-swept-sector-end-relief-with-prescribed-speed-jumps';
 root.traverse(o=>{for(const material of(Array.isArray(o.material)?o.material:[o.material]))if(material)material.fog=false;});
}
