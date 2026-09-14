import * as THREE from 'three';
import {matte, PALETTE, markShadows} from '../primitives.js';
import {expansionEccentricProfile} from '../expansion-eccentric-profile.js';

/** Traced front outlines; hidden depths, rear mounting and roller spacing inferred. */
export function makeExpansionEccentricGeometry({samples=384,spread=12}={}) {
  const root=new THREE.Group(),cam=new THREE.Group(),fork=new THREE.Group();
  root.add(cam,fork);fork.position.set(3.67,-.04,0);
  const bore=(shape,x,y,r)=>{const p=new THREE.Path();p.absarc(x,y,r,0,2*Math.PI,true);shape.holes.push(p);};
  const extrude=(shape,z,depth,color)=>{
    const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:32});
    g.translate(0,0,z);return new THREE.Mesh(g,matte(color));
  };
  const circle=(x,y,r,hole=0)=>{const s=new THREE.Shape();s.absarc(x,y,r,0,2*Math.PI,false);if(hole)bore(s,x,y,hole);return s;};
  const pin=(parent,x,y,r,z,depth)=>parent.add(extrude(circle(x,y,r),z,depth,PALETTE.ink));
  const outline=new THREE.Shape(expansionEccentricProfile(samples).map(([x,y])=>new THREE.Vector2(x*.01,y*.01)));
  bore(outline,0,0,.293);cam.add(extrude(outline,-.2,.4,PALETTE.driver));
  pin(cam,0,0,.29,-.6,.85);
  const s=new THREE.Shape();
  const command=(op,...values)=>{const p=[];for(let i=0;i<values.length;i+=2)p.push((values[i]-449)*.01,(230-values[i+1])*.01);s[op](...p);};
  const top=120-spread,bottom=332+spread;
  command('moveTo',52,top);
  command('bezierCurveTo',50,top-20,64,top-27,75,top-30);
  command('bezierCurveTo',101,46,124,38,151,42);
  command('bezierCurveTo',220,40,253,89,253,151);
  command('bezierCurveTo',253,200,261,211,281,211);
  command('lineTo',506,211);command('lineTo',506,251);command('lineTo',281,257);
  command('bezierCurveTo',255,259,252,282,252,322);
  command('bezierCurveTo',257,398,218,434,162,433);
  command('bezierCurveTo',111,431,72,406,64,bottom+26);
  command('bezierCurveTo',42,bottom+10,45,bottom-22,67,bottom-30);
  command('bezierCurveTo',90,bottom-39,115,bottom-22,111,bottom+1);
  command('bezierCurveTo',113,377,151,402,181,382);
  command('bezierCurveTo',204,370,202,344,202,308);
  command('lineTo',201,158);
  command('bezierCurveTo',201,99,177,84,151,85);
  command('bezierCurveTo',123,84,113,97,111,top);
  command('bezierCurveTo',115,top+39,48,top+39,52,top);s.closePath();
  bore(s,0,0,.13);
  const locations={upper:[-3.67,1.10+spread*.01,.31],lower:[-3.69,-1.02-spread*.01,.32]};
  for(const [x,y]of Object.values(locations))bore(s,x,y,.068);
  fork.add(extrude(s,-.4,.16,PALETTE.driven));
  const blocks={cam,fork};
  for(const [name,[x,y,r]]of Object.entries(locations)){
    const roller=new THREE.Group();roller.position.set(x,y,0);fork.add(roller);blocks[name]=roller;
    roller.add(extrude(circle(0,0,r,.068),-.2,.4,PALETTE.brass));
    // A recessed face ring keeps the working cylindrical rim un-beveled.
    roller.add(extrude(circle(0,0,r*.72,r*.63),.201,.012,PALETTE.ink));
    const front=name==='lower'?.42:.26;
    pin(fork,x,y,.063,-.43,front+.43);
    fork.add(extrude(circle(x,y,.10,.065),front-.04,.04,PALETTE.ink));
  }
  const rod=new THREE.Group();rod.position.set(...locations.lower.slice(0,2),0);fork.add(rod);blocks.rod=rod;
  const r=new THREE.Shape();r.moveTo(-.17,0);r.absarc(0,0,.17,Math.PI,0,true);
  r.lineTo(.13,-1.05);r.lineTo(.075,-1.85);r.lineTo(-.075,-1.85);r.lineTo(-.13,-1.05);r.closePath();bore(r,0,0,.068);
  rod.add(extrude(r,.235,.12,PALETTE.accent));
  // A rear mounting plate connects both bored bearings without crossing the cam plane.
  const frame=new THREE.Shape();frame.moveTo(.30,-.12);frame.lineTo(3.52,-.16);frame.lineTo(3.52,.08);frame.lineTo(.30,.12);frame.closePath();
  root.add(extrude(frame,-.62,.18,PALETTE.frame));
  root.add(extrude(circle(0,0,.40,.293),-.62,.18,PALETTE.frame));
  root.add(extrude(circle(3.67,-.04,.25,.13),-.62,.18,PALETTE.frame));
  pin(root,3.67,-.04,.125,-.63,.42);
  root.add(extrude(circle(3.67,-.04,.20,.127),-.235,.025,PALETTE.ink));
  markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});root.updateMatrixWorld(true);
  root.userData={blocks};return {root};
}
