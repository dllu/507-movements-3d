import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {perspectiveObjectFitDistance} from '../src/simulation/engine.js';
import {makeSelectableCamValve} from '../src/simulation/selectable-cam-valve.js';
const v=makeSelectableCamValve();
try{
 const u=v.root.userData,b=u.blocks,g=u.geometry,bounds=new THREE.Box3().setFromObject(v.root,true),sphere=bounds.getBoundingSphere(new THREE.Sphere());
 const landmarks=[['shaft section',[159,272],new THREE.Vector3(0,0,b.rotatingShaft.geometry.parameters.height/2)],['lever pivot',[404,244],b.lever.getWorldPosition(new THREE.Vector3())],['roller',[195,193],b.followerRoller.root.getWorldPosition(new THREE.Vector3())],['upper rod pin',[281,215],u.valveBodies.rod.getWorldPosition(new THREE.Vector3())],['rod end',[280,354],u.valveBodies.rod.localToWorld(new THREE.Vector3(0,-u.valveGeometry.rodLength,0))]];
 const views=[];
 for(const [label,direction,fov] of [['current',[8,.2,15],36],['flatter',[4.3,.2,15],18],['frontal',[.05,.03,15],18]]){
  const axis=new THREE.Vector3(...direction).normalize(),distance=Math.max(Math.max(sphere.radius,1.7)*2.45,5.2,perspectiveObjectFitDistance(v.root,bounds,axis,fov,.85));
  const camera=new THREE.PerspectiveCamera(fov,.85,.1,100);camera.position.copy(sphere.center).addScaledVector(axis,distance);camera.lookAt(sphere.center);camera.updateMatrixWorld(true);
  const projected=landmarks.map(([,target,world])=>{const p=world.clone().project(camera);return {target,p:[p.x*425,-p.y*500]};});
  const mean=key=>[0,1].map(k=>projected.reduce((s,p)=>s+p[key][k],0)/projected.length),a=mean('p'),b=mean('target');
  let numerator=0,denominator=0;for(const p of projected)for(let k=0;k<2;k++){numerator+=(p.p[k]-a[k])*(p.target[k]-b[k]);denominator+=(p.p[k]-a[k])**2;}
  const scale=numerator/denominator,errors=projected.map((p,i)=>({name:landmarks[i][0],pixels:Math.hypot(...[0,1].map(k=>(p.p[k]-a[k])*scale+b[k]-p.target[k]))}));
  views.push({label,direction,fov,rmsPixels:Math.sqrt(errors.reduce((s,e)=>s+e.pixels**2,0)/errors.length),errors});
 }
 const report={movement:150,method:'Five approximate engraving landmarks, best uniform scale and XY translation after perspective projection. No rotation or independent axis scaling. Measures landmark fit only, not cam outlines or visibility. Shaft end inferred as the visible front section.',views,sources:['scripts/measure-selectable-cam-projection.mjs','src/simulation/selectable-cam-valve.js','src/simulation/authored-selectable-cams.js','src/simulation/engine.js'].map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')}))};
 fs.writeFileSync('docs/validation/150-projection-landmarks.json',JSON.stringify(report,null,2)+'\n');console.log(views);
}finally{v.dispose();}
