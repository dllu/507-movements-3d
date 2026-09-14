import * as THREE from 'three';
import clip from 'polygon-clipping';
import {matte,PALETTE,markShadows} from '../primitives.js';

export function makeThreeWiperGeometry(){
 const root=new THREE.Group(),frame=new THREE.Group(),rotor=new THREE.Group();root.add(frame,rotor);
 const world=([x,y])=>[(x-257)/100,(264-y)/100];
 const path=(commands)=>{const s=new THREE.Shape();for(const [op,...coords] of commands){const p=[];for(let i=0;i<coords.length;i+=2)p.push(...world(coords.slice(i,i+2)));s[op](...p);}s.closePath();return s.getPoints(12).map(p=>[p.x,p.y]);};
 const outer=path([['moveTo',104,88],['lineTo',426,87],['bezierCurveTo',455,87,466,127,480,173],['bezierCurveTo',503,235,503,305,480,366],['bezierCurveTo',463,416,458,440,428,441],['lineTo',104,440],['bezierCurveTo',74,438,62,401,49,355],['bezierCurveTo',27,283,32,229,53,165],['bezierCurveTo',69,117,75,91,104,88]]);
 const inner=path([['moveTo',127,122],['lineTo',410,121],['bezierCurveTo',434,125,448,174,458,222],['bezierCurveTo',469,277,459,343,440,384],['bezierCurveTo',434,400,427,407,409,407],['lineTo',126,406],['bezierCurveTo',108,406,101,393,91,366],['bezierCurveTo',69,306,65,252,79,201],['bezierCurveTo',95,139,103,123,127,122]]);
 const upper=path([['moveTo',334,121],['bezierCurveTo',363,133,365,150,365,174],['lineTo',365,202],['bezierCurveTo',365,218,374,227,394,230],['lineTo',394,158],['bezierCurveTo',394,137,402,126,413,121]]);
 const lower=path([['moveTo',160,305],['bezierCurveTo',180,306,190,317,190,340],['lineTo',190,373],['bezierCurveTo',190,393,201,404,217,408],['lineTo',134,408],['bezierCurveTo',153,395,159,380,160,355]]);
 const leftTab=path([['moveTo',42,230],['bezierCurveTo',29,239,21,245,7,248],['lineTo',5,285],['bezierCurveTo',22,289,32,297,41,311]]);
 const rightTab=path([['moveTo',494,227],['bezierCurveTo',503,238,510,241,518,247],['lineTo',518,285],['bezierCurveTo',507,288,499,296,495,302]]);
 const polygon=clip.union([outer,inner],[upper],[lower],[leftTab],[rightTab]);
 const parts=[],cells=[];
 for(const rings of polygon){
  const s=new THREE.Shape(rings[0].map(p=>new THREE.Vector2(...p)));s.holes=rings.slice(1).map(r=>new THREE.Path(r.map(p=>new THREE.Vector2(...p))));
  const geometry=new THREE.ExtrudeGeometry(s,{depth:.18,bevelEnabled:false,curveSegments:1});geometry.translate(0,0,-.09);
  const mesh=new THREE.Mesh(geometry,matte(PALETTE.driven));frame.add(mesh);parts.push(mesh);
  const contour=rings[0].slice(0,-1).map(p=>new THREE.Vector2(...p)),holes=rings.slice(1).map(r=>r.slice(0,-1).map(p=>new THREE.Vector2(...p)));
  const vertices=[...contour,...holes.flat()];
  for(const face of THREE.ShapeUtils.triangulateShape(contour,holes)){
   const [a,b,c]=face.map(i=>vertices[i]);
   // Boolean unions can leave collinear cap slivers. They have no meaningful
   // volume and cannot define a stable three-dimensional convex collision cell.
   if(Math.abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))<1e-12)continue;
   cells.push([-.09,.09].flatMap(z=>face.map(i=>[vertices[i].x,vertices[i].y,z])));
  }
 }
 const disk=(radius,depth)=>{const g=new THREE.CylinderGeometry(radius,radius,depth,64);g.rotateX(Math.PI/2);return g;};
 const radius=1.075,headRadius=.185;
 const hub=new THREE.Mesh(disk(.41,.24),matte(PALETTE.driver));rotor.add(hub);
 const shaft=new THREE.Mesh(disk(.20,.32),matte(PALETTE.ink));rotor.add(shaft);
 for(let i=0;i<3;i++){
  const a=i*2*Math.PI/3,arm=new THREE.Mesh(new THREE.BoxGeometry(radius-.25,.12,.14),matte(PALETTE.driver));
  arm.position.set((radius+.25)/2*Math.cos(a),(radius+.25)/2*Math.sin(a),0);arm.rotation.z=a;rotor.add(arm);
  const head=new THREE.Mesh(disk(headRadius,.20),matte(PALETTE.driver));head.position.set(radius*Math.cos(a),radius*Math.sin(a),0);rotor.add(head);
 }
 rotor.rotation.z=Math.PI/6;markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 root.userData={blocks:{frame,rotor},cells,polygon,gates:[upper,lower],profile:{radius,headRadius,sourceAngle:Math.PI/6},parts};
 return {root,focus:new THREE.Vector3(),cameraDirection:new THREE.Vector3(.2,.15,10)};
}
