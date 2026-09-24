import * as THREE from 'three';
import {boredLatheGeometry} from './bored-lathe-geometry.js';
import {plate,poly,circle,polygonClipping as clip} from './finite-plate-geometry.js';
const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};
const tube=(radius,bore,length)=>boredLatheGeometry([{radial:radius,axial:-length/2},{radial:radius,axial:length/2}],bore,64);
function flatOutline(mesh,depth,bore=0){
  const shape=mesh.geometry.parameters.shapes.clone();
  if(bore){const hole=new THREE.Path();hole.absarc(0,0,bore,0,2*Math.PI,false);shape.holes.push(hole);}
  replace(mesh,new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:48}).translate(0,0,-depth/2));
}
function boreStandard(mesh,center,bore){
  mesh.updateMatrix();const p=new THREE.Vector3(center.x,center.y,mesh.position.z).applyMatrix4(mesh.matrix.clone().invert()),{width:w,height:h,depth:z}=mesh.geometry.parameters;
  const outline=clip.union(poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]),poly(circle([p.x,p.y],.29,64)));
  replace(mesh,plate(clip.difference(outline,poly(circle([p.x,p.y],bore,64))),-z/2,z/2));
}
function boreRotatingBar(mesh,bore){
  mesh.updateMatrix();const p=new THREE.Vector3(0,0,mesh.position.z).applyMatrix4(mesh.matrix.clone().invert()),{width:w,height:h,depth:z}=mesh.geometry.parameters;
  replace(mesh,plate(clip.difference(poly([[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]]),poly(circle([p.x,p.y],bore,64))),-z/2,z/2));
}
export function correctFreeEscapement(root,id){
  const d=root.userData,b=d.blocks,g=d.geometry;
  // Separate each rotating hub from its actual journal; the old torus rings
  // had large radial gaps and the shafts did not reach the standards.
  replace(b.wheelHub,tube(.25,id===291?.113:.108,id===291?.72:.70));
  replace(b.wheelShaft,new THREE.CylinderGeometry(id===291?.11:.105,id===291?.11:.105,1.75,48));b.wheelShaft.position.z=-.28;
  replace(b.wheelBearing,tube(.29,id===291?.114:.109,.46).rotateX(Math.PI/2));b.wheelBearing.position.z=-.78;
  boreStandard(b.wheelStandard,g.escapeWheelCenter,id===291?.114:.109);
  if(id===291){
    flatOutline(b.toothedDisk,g.wheelDepth,.113);
    replace(b.balanceHub,tube(.20,.103,.80));
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.10,.10,1.95,48).rotateX(Math.PI/2),b.balanceHub.material);
    shaft.position.set(g.balanceCenter.x,g.balanceCenter.y,-.24);shaft.userData.role='fixed-balance-journal-through-bored-hub';root.add(shaft);b.balanceShaft=shaft;
    replace(b.balanceBearing,tube(.29,.104,.46).rotateX(Math.PI/2));b.balanceBearing.position.z=-.78;
    boreStandard(b.balanceStandard,g.balanceCenter,.104);
    // The detent needs axial overlap with the wheel, not just a coincident
    // front/back plane. Its working face is still the lower y boundary.
    b.detentStopD.geometry.translate(0,.0002,-.10);
    for(const bar of [...b.balanceSpokes,b.studArm])boreRotatingBar(bar,.103);
    const face=b.impulsePallet.userData.facePoints;
    const offset=(p,amount)=>{const r=p.length();return[p.x*(1-amount/r),p.y*(1-amount/r)];};
    // The face turns almost radial at the end of impulse, so the closed
    // face-plus-offset ring crossed itself there (broken caps and false
    // inside tests). Resolve the ring into simple polygons first.
    // Offsets are taken along the face normal on the body side. Near the end
    // of impulse the face runs past radial, where a radial (toward-axis)
    // offset lies on the tooth side and folded the ring through the tooth.
    const mid=face.length>>1,midTangent=face[mid+1].clone().sub(face[mid-1]);
    const side=Math.sign(face[mid].x*midTangent.y-face[mid].y*midTangent.x);
    const along=(amount)=>face.map((p,i)=>{const t=face[Math.min(i+1,face.length-1)].clone().sub(face[Math.max(i-1,0)]).normalize();return[p.x-side*t.y*amount,p.y+side*t.x*amount];});
    // Nothing stands outside the face's own outer radius (the normal offset
    // leans outward there and would meet the next locked tooth).
    const reach=Math.max(...face.map(p=>p.length()))+.0015;
    const bands=clip.intersection(clip.union(poly([...along(.00075),...along(.22075).reverse()])),poly(circle([0,0],reach,256)));
    // Notch g occupies world z -0.25..0.198: it laps the wheel (+-0.19) and
    // its arm behind it, but passes behind hook k (0.20..0.47) and detent A.
    replace(b.impulsePallet.userData.body,plate(bands,-.49,-.042));
  }else{
    for(const tooth of b.escapeTeeth)flatOutline(tooth,g.wheelDepth);
    for(const spoke of b.wheelSpokes){
      const outer=g.wheelRootRadius*.92;
      replace(spoke,new THREE.BoxGeometry(outer-.20,.16,g.wheelDepth*.72).translate((outer+.20)/2,0,0));
      spoke.position.set(0,0,0);
    }
    replace(b.balanceShaft,new THREE.CylinderGeometry(.105,.105,1.75,48));b.balanceShaft.position.z=-.28;
    replace(b.balanceBearing,tube(.28,.109,.46).rotateX(Math.PI/2));b.balanceBearing.position.z=-.78;
    boreStandard(b.balanceStandard,g.balanceCenter,.109);
    replace(b.impulseRollerHub,tube(.30,.108,.22));replace(b.dischargingRoller,tube(g.dischargingRollerRadius,.108,.16));
    const a=g.impulsePalletLocalAngle,along=[Math.cos(a),Math.sin(a)],normal=[-along[1],along[0]];
    const point=(r,n)=>[along[0]*r+normal[0]*n,along[1]*r+normal[1]*n];
    replace(b.impulsePalletBody,plate(poly([point(g.palletInnerRadius,.0002),point(g.palletOuterRadius,.0002),point(g.palletOuterRadius,.1502),point(g.palletInnerRadius,.1502)]),-.11,.11));
    // Local -y is outward from the wheel on the ten-degree drawing face.
    b.lockingStoneT.geometry.translate(0,-.0652,0);
  }
  d.finiteContactReview={qualification:id===313?'Finite impulse pallet clears the locked return envelope and retains the full active face; one-way leaf contact and prescribed detent-release dynamics remain unqualified.':'Partial geometric correction: active working faces and journals improved; free-return pallet and one-way leaf contact residuals remain. Balance, spring flexure and tooth release are prescribed, not a passive contact solve.'};
  d.hideGround=true;d.minimumDisplayCycleSeconds=4;
  b.cameraEnvelope.visible=false;
}
export function fitFreeEscapement(root,update){
  const period=root.userData.geometry.balancePeriod,box=new THREE.Box3();
  for(let i=0;i<=128;i++){update(period*i/128);root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.cameraFitGuide)return;o.geometry.computeBoundingBox();box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));});}
  root.userData.cameraFitBounds=box.expandByScalar(.04);root.userData.cameraDistanceScale=1.12;update(0);
}
