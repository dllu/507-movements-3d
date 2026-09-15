import fs from 'node:fs';import {createHash} from 'node:crypto';import * as THREE from 'three';
import {createAuthoredEngineCouplingMovement} from '../src/simulation/authored-engine-couplings.js';import {disposeObject3D} from '../src/simulation/dispose-model.js';
const m=createAuthoredEngineCouplingMovement({id:176});try{
 m.root.updateMatrixWorld(true);const b=m.root.userData.blocks;
 const targets=[['top left','output-top-boss',[208,90]],['top right','output-top-boss',[358,90]],['top crest','output-top-boss',[282,16]],['top bottom','output-top-boss',[282,165]],['bottom left','output-bottom-boss',[199,433]],['bottom right','output-bottom-boss',[357,433]],['bottom crest','output-bottom-boss',[278,354]],['bottom foot','output-bottom-boss',[278,511]],['left neck','outputCrankPlate',[214,300]],['right neck','outputCrankPlate',[338,300]]];
 const project=v=>new THREE.Vector2(278+v.x/.01,430-v.y/.01);
 const features=targets.map(([name,part,source])=>{const mesh=b[part],edges=new THREE.EdgesGeometry(mesh.geometry,1),p=edges.attributes.position,target=new THREE.Vector2(...source);let errorPixels=Infinity,projected;
  for(let i=0;i<p.count;i+=2){
   const outer=part==='output-top-boss'?.76:part==='output-bottom-boss'?.79:0;
   if(outer&&[i,i+1].some(j=>Math.hypot(p.getX(j),p.getY(j))<outer-.0001))continue;
   const a=project(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i))),c=project(mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(p,i+1))),delta=c.clone().sub(a),t=delta.lengthSq()?THREE.MathUtils.clamp(target.clone().sub(a).dot(delta)/delta.lengthSq(),0,1):0,q=a.clone().addScaledVector(delta,t),error=q.distanceTo(target);if(error<errorPixels){errorPixels=error;projected=q.toArray();}}
  edges.dispose();return{name,part,source,projected,errorPixels};
 });
 const point=object=>project(object.getWorldPosition(new THREE.Vector3())).toArray();
 const report={movement:176,status:'sparse-source-edge-fit',features,centers:{shaft:point(b.outputShaft),ring:point(b.selectorCenterAnchor),wrist:point(b.wristCenterAnchor)},method:'Nearest projected actual crease/boundary edge to ten manually measured engraving features, with each feature assigned to its corresponding boss outer circumference or cheek. Inner boss edges are excluded. Long straight neck edges are measured as segments, not sparse endpoints. This is not a full silhouette registration.',sources:['scripts/review-engine-coupling-source.mjs','src/simulation/authored-engine-couplings.js','public/engravings/mm_176.png'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};fs.writeFileSync('docs/validation/176-source-fit.json',JSON.stringify(report,null,2)+'\n');console.log(features);
}finally{disposeObject3D(m.root);}
