import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createMovementModel} from '../../src/simulation/registry.js';
import {disposeObject3D} from '../../src/simulation/dispose-model.js';
import {poly,circle,polygonClipping as clip} from '../../src/simulation/finite-plate-geometry.js';
import fs from 'node:fs';
const catalog=JSON.parse(fs.readFileSync(new URL('../../src/data/movements.json',import.meta.url)));
const area=polygons=>polygons.reduce((sum,polygon)=>sum+polygon.reduce((total,ring,index)=>{
 const a=Math.abs(ring.reduce((v,p,i)=>{const q=ring[(i+1)%ring.length];return v+p[0]*q[1]-q[0]*p[1];},0))/2;
 return total+(index===0?a:-a);
},0),0);
const world=o=>o.getWorldPosition(new THREE.Vector3());

export function reviewDiagonalCatch(id){
 const m=createMovementModel(catalog.movements[id-1]),u=m.root.userData,b=u.blocks,g=u.geometry;
 try{
  assert.equal(u.reconstructionStatus,'under-review','the unfinished catch is not qualified');
  assert.equal(u.hideGround,true);assert.equal(u.materialsIgnoreSceneFog,true);
  assert.equal(g.cyclePeriod,18);assert.equal(u.supportsRestart,true);
  for(const side of ['upper','lower'])assert.equal(b[side+'HandleContactRoller'].parent,null,'no invented contact roller');
  const measurements={upper:{pivots:[[275,122],[273,120]],tips:[[207,295],[66,154]],weights:[[402,54],[408,170]]},lower:{pivots:[[273,351],[269,351]],tips:[[82,315],[199,188]],weights:[[137,422],[127,305]]}};
  // Independent engraving measurements, registered at each handle pivot.
  for(const [pose,phase]of [[0,0],[1,.48]]){
   const publicPhase=(phase-g.initialBasePhase+1)%1;m.update(publicPhase*18);m.root.updateMatrixWorld(true);
   for(const side of ['upper','lower'])for(const [kind,part]of [['tips','WorkingTip'],['weights','WeightAnchor']]){
    const measured=measurements[side],actual=world(b[side+'Handle'+part]),pivot=g[side+'Pivot'];
    const expected=new THREE.Vector2(pivot.x+(measured[kind][pose][0]-measured.pivots[pose][0])*.0125,pivot.y-(measured[kind][pose][1]-measured.pivots[pose][1])*.0125);
    assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)/.0125<16,`${side} ${kind} source ${181+pose} fit`);
   }
  }
  let previous=null,previousAngles=null,drivenContacts=0;const localContacts={upper:[],lower:[]};
  for(let i=0;i<=1200;i++){
   const phase=i/1200,publicPhase=(phase-g.initialBasePhase+1)%1;m.update(publicPhase*18);m.root.updateMatrixWorld(true);
   const s=u.kinematics,y=s.pistonPosition.y;
   assert.ok(Number.isFinite(y));
   if(previous!==null){
    assert.ok(Math.abs(y-previous)<.05,'no positional teleport');
    if(phase<=.52)assert.ok(y>=previous-1e-9,'ascending stroke is monotone');
    else assert.ok(y<=previous+1e-9,'descending stroke is monotone');
   }
   previous=y;
   const angles=[s.upperHandleAngle,s.lowerHandleAngle];
   if(previousAngles)assert.ok(angles.every((a,j)=>Math.abs(a-previousAngles[j])<.05),'no handle teleport');
   previousAngles=angles;
   for(const key of ['upperSteamOpenFraction','lowerSteamOpenFraction','upperEductionOpenFraction','lowerEductionOpenFraction'])assert.ok(s[key]>=-1e-12&&s[key]<=1+1e-12);
   const shoe=poly([[g.tappetShoeLeftX,y-.25],[g.tappetShoeRightX,y-.25],[g.tappetShoeRightX,y+.25],[g.tappetShoeLeftX,y+.25]]);
   for(const side of ['upper','lower']){
    const mesh=b[side+'HandleWorkingArm'].children[0];
    const shape=mesh.geometry.userData.plate.polygons.map(p=>p.map(r=>r.map(([x,y])=>{const v=new THREE.Vector3(x,y,0).applyMatrix4(mesh.matrixWorld);return[v.x,v.y];})));
    const tip=world(b[side+'HandleWorkingTip']);
    const solid=clip.union(shape,poly(circle([tip.x,tip.y],.10,96)));
    assert.ok(area(clip.intersection(shoe,solid))<1e-8,`${side} working arm intersects the shoe at phase ${phase}`);
   }
   if(s.activeContact){
    drivenContacts++;
    const side=s.activeContact.startsWith('lower')?'lower':'upper';
    assert.ok(Math.abs(s[side+'TappetContactError'])<1e-7,'driven contact lies on the surface within 0.000008 source pixels');
    assert.ok(s.activeContactPoint.x>=g.tappetShoeLeftX-1e-10&&s.activeContactPoint.x<=g.tappetShoeRightX+1e-10);
    const p=s.activeContactPoint.clone().sub(g[side+'Pivot']);
    p.rotateAround(new THREE.Vector2(),-s[side+'HandleAngle']);localContacts[side].push(p);
   }
   if(phase>.2&&phase<.34)assert.equal(s.upperHandleAngle,0,'upper handle stays caught during lower drive');
   if(phase>.64&&phase<.78)assert.equal(s.lowerHandleAngle,g.source182LowerAngle,'lower handle stays caught during upper drive');
  }
  assert.ok(drivenContacts>200);
  for(const points of Object.values(localContacts))assert.ok(points.some(p=>p.distanceTo(points[0])>.5),'contact moves along the arm instead of following a fixed material marker');
  m.reset();assert.equal(u.kinematics.cyclePhase,0);
  const expected=id===181?g.source181PistonY:g.source182PistonY;
  assert.ok(Math.abs(u.kinematics.pistonPosition.y-expected)<1e-12);
 }finally{disposeObject3D(m.root);}
}
