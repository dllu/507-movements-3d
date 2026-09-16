import * as THREE from 'three';
import {circle,poly,plate,polygonClipping} from './finite-plate-geometry.js';
import {curvedPipeWall,mergePassageParts} from './finite-fluid-passages.js';

export function caryFollowerLaw(angle) {
  const signed=THREE.MathUtils.euclideanModulo(angle+Math.PI/2+Math.PI,2*Math.PI)-Math.PI;
  const dwell=24*Math.PI/180, width=40*Math.PI/180;
  const t=THREE.MathUtils.clamp((Math.abs(signed)-dwell)/width,0,1);
  return {
    radius:.53+.72*t**3*(10+t*(-15+6*t)),
    first:.72*30*t*t*(1-t)**2/width*Math.sign(signed),
    second:.72*60*t*(1-t)*(1-2*t)/(width*width),
  };
}

const replace=(mesh,geometry)=>{mesh.geometry.dispose();mesh.geometry=geometry;};

export function correctCaryPump(root) {
  const d=root.userData,b=d.blocks,g=d.geometry;
  const rollerRadius=.11,outline=[];
  for(let i=0;i<2048;i++){
    const a=i*2*Math.PI/2048,{radius:r,first:rp}=caryFollowerLaw(a),c=Math.cos(a),s=Math.sin(a),length=Math.hypot(r,rp);
    outline.push([r*c-rollerRadius*(r*c+rp*s)/length,r*s-rollerRadius*(r*s-rp*c)/length]);
  }
  replace(b.fixedHeartCam,plate(polygonClipping.difference(poly(outline),poly(circle([0,0],.234,256))),-g.casingDepth*.38,g.casingDepth*.38));
  const outlineLine=root.children.find(o=>o.userData.role==='fixed-heart-cam-contact-outline');
  replace(outlineLine,new THREE.BufferGeometry().setFromPoints([...outline,outline[0]].map(([x,y])=>new THREE.Vector3(x,y,g.casingDepth*.39))));
  const slots=poly([[-1.8,-.14],[1.8,-.14],[1.8,.14],[-1.8,.14]]);
  replace(b.drumShell,plate(polygonClipping.difference(poly(circle([0,0],g.drumOuterRadius,512)),poly(circle([0,0],g.drumInnerRadius,512)),slots),-g.casingDepth*.415,g.casingDepth*.415));
  const spider=polygonClipping.union(poly(circle([0,0],.35,128)),poly([[-1.42,-.08],[1.42,-.08],[1.42,.08],[-1.42,.08]]),poly([[-.08,-1.42],[.08,-1.42],[.08,1.42],[-.08,1.42]]));
  const rearSpider=new THREE.Mesh(plate(spider,-.44,-.315),b.drumShell.material);rearSpider.userData.role='rear-spider-joining-drum-to-driving-axle';b.drum.add(rearSpider);b.rearSpider=rearSpider;
  for(const p of b.pistons){
    replace(p.blade,new THREE.BoxGeometry(g.pistonLength-.10,.17,g.casingDepth*.63));p.blade.position.x=-.05;
    replace(p.follower,new THREE.CylinderGeometry(rollerRadius,rollerRadius,g.casingDepth*.60,64));
    const edge=Array.from({length:33},(_,i)=>{const y=-.135+.27*i/32;return[Math.sqrt((g.casingInnerRadius-.0001)**2-y*y)-g.camMaximumRadius-g.pistonLength/2,y]});
    const shape=poly([...edge,...edge.map(([x,y])=>[x-.13,y]).reverse()]);
    replace(p.sealingHead,plate(shape,-g.casingDepth*.34,g.casingDepth*.34));p.sealingHead.position.x=0;
  }
  // H must leave M radially before turning outside the working cylinder.
  const outletAngle=-Math.PI/3;
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(2.32*Math.cos(outletAngle),2.32*Math.sin(outletAngle),0),
    new THREE.Vector3(2.95*Math.cos(outletAngle),2.95*Math.sin(outletAngle),0),
    new THREE.Vector3(2.85,-2.15,0),new THREE.Vector3(3.03,-.45,0),
    new THREE.Vector3(3.05,1.35,0),new THREE.Vector3(3.28,2.27,0),
    new THREE.Vector3(3.76,2.05,0),new THREE.Vector3(3.86,1.30,0),
  ]);
  replace(b.dischargeH.shell,curvedPipeWall(curve,.29,.34,128));
  b.dischargeH.shell.userData.curve=curve;
  replace(b.dischargeH.water,new THREE.TubeGeometry(curve,128,.21,12,false));
  const port=poly([[2.2,-.30],[2.8,-.30],[2.8,.30],[2.2,.30]].map(([x,y])=>[x*Math.cos(outletAngle)-y*Math.sin(outletAngle),x*Math.sin(outletAngle)+y*Math.cos(outletAngle)]));
  const inletPort=poly([[-1.05,-2.8],[-.39,-2.8],[-.39,-2.05],[-1.05,-2.05]]);
  replace(b.casing,plate(polygonClipping.difference(poly(circle([0,0],g.casingOuterRadius,512)),poly(circle([0,0],g.casingInnerRadius,512)),port,inletPort),-g.casingDepth/2,g.casingDepth/2));
  const inletShell=b.inletF.children[0];
  const walls=[new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.1,1.58,.8268),new THREE.BoxGeometry(.66,1.58,.06),new THREE.BoxGeometry(.66,1.58,.06)];
  walls[0].translate(-.38,0,0);walls[1].translate(.38,0,0);walls[2].translate(0,0,-.3834);walls[3].translate(0,0,.3834);
  replace(inletShell,mergePassageParts(walls));inletShell.position.y=-3.0;
  replace(b.frontCover,plate(polygonClipping.difference(poly(circle([0,0],g.casingInnerRadius,512)),poly(circle([0,0],.234,128))),-.006,.006));
  d.solidReview={qualification:'Finite roller-offset cam, radial drum slots, curved sealing heads rear drive spider and open casing ports. The 24-degree retracted dwell and 40-degree transitions are reconstructed; cam contact is kinematic, with no solved pressure, return load or hydraulic torque.'};
  finish(root);
}

export function oldPumpVaneOutline(rotorRadius,length){
  const blade=polygonClipping.difference(polygonClipping.union(poly(circle([0,0],.19,96)),poly([[0,-.06],[length-.08,-.06],[length-.08,.06],[0,.06]])),poly(circle([0,0],.134,96)));
  const edge=Array.from({length:33},(_,i)=>{const y=-.09+.18*i/32;return[y<0?Math.sqrt((length-.0001)**2-y*y):Math.sqrt((rotorRadius+length-.0001)**2-y*y)-rotorRadius,y]});
  const lip=poly([...edge,...edge.map(([x,y])=>[x-.12,y]).reverse()]);
  return {blade,lip};
}

function finish(root){const d=root.userData;d.hideGround=true;d.minimumDisplayCycleSeconds=d.geometry.cycleDuration;root.traverse(o=>{for(const m of o.material?[].concat(o.material):[])m.fog=false;});}

export function correctOldPump(root) {
  const d=root.userData,b=d.blocks,g=d.geometry,{blade,lip}=oldPumpVaneOutline(g.rotorRadius,g.valveLength);
  for(const v of b.valves){
    replace(v.blade,plate(blade,-g.casingDepth*.33,g.casingDepth*.33));v.blade.position.x=0;
    replace(v.flexibleLip,plate(lip,-g.casingDepth*.35,g.casingDepth*.35));v.flexibleLip.position.x=0;
  }
  // Full circular relief around each hinge eye clears its complete angular sweep;
  // the rear and front cheeks retain the pin's connection to the rotor.
  const body=poly(circle([0,0],g.rotorRadius,8));
  const holes=[-1,1].map(sign=>poly(circle([sign*g.rotorRadius,0],.194,128)));
  const center=plate(polygonClipping.difference(body,...holes),-.265,.265);
  const cheeks=[[-.327,-.27],[.27,.327]].map(([low,high])=>plate(polygonClipping.union(body,...[-1,1].map(sign=>poly(circle([sign*g.rotorRadius,0],.175,96)))),low,high));
  replace(b.rotorBody,mergePassageParts([center,...cheeks]));b.rotorBody.rotation.x=0;
  for(const cover of root.children.filter(o=>o.geometry?.type==='CircleGeometry'))replace(cover,plate(polygonClipping.difference(poly(circle([0,0],g.casingInnerRadius,512)),poly(circle([0,0],.224,128))),-.006,.006));
  const outletPort=poly([[2.2,-.34],[2.9,-.34],[2.9,.34],[2.2,.34]].map(([x,y])=>[x*Math.cos(g.outletAngle)-y*Math.sin(g.outletAngle),x*Math.sin(g.outletAngle)+y*Math.cos(g.outletAngle)]));
  replace(b.casing,plate(polygonClipping.difference(poly(circle([0,0],g.casingOuterRadius,512)),poly(circle([0,0],g.casingInnerRadius,512)),poly([[-.34,-3],[.34,-3],[.34,-2.2],[-.34,-2.2]]),outletPort),-g.casingDepth/2,g.casingDepth/2));
  for(const [shell,width,height] of [[b.inlet.children[0],.78,1.42],[b.outlet.children[0],1.48,.78]]){
    const panels=[-.38,.38].map(z=>{const geometry=new THREE.BoxGeometry(width,height,.06);geometry.translate(0,0,z);return geometry;});
    replace(shell,mergePassageParts(panels));
  }
  d.solidReview={qualification:'Partial reconstruction: bored hinge eyes, supporting rotor cheeks circular sealing lips and open inlet/outlet casing passages are finite solids. The existing prescribed folding law is not validated against the fixed abutment and can interpenetrate it; fluid pressure, vane return and contact forces remain unsolved.'};
  finish(root);
}
