import * as THREE from 'three';
import {matte,PALETTE,markShadows} from '../primitives.js';
export function makePlateShearsGeometry(){
 const root=new THREE.Group(),jaw=new THREE.Group(),cam=new THREE.Group();root.add(jaw,cam);
 const world=(x,y)=>[(x-322)/100,(325-y)/100];
 const shape=commands=>{const s=new THREE.Shape();for(const [op,...v]of commands){const p=[];for(let i=0;i<v.length;i+=2)p.push(...world(v[i],v[i+1]));s[op](...p);}s.closePath();return s;};
 const upper=shape([['moveTo',8,350],['lineTo',270,316],['bezierCurveTo',293,309,290,276,317,262],['bezierCurveTo',345,253,405,245,445,242],['bezierCurveTo',481,238,497,248,502,270],['bezierCurveTo',466,279,396,294,372,307],['bezierCurveTo',350,318,351,360,316,362],['lineTo',14,362],['bezierCurveTo',6,362,3,357,8,350]]);
 // ExtrudeGeometry keeps a clockwise outline as is and then needs its holes
 // anticlockwise; a hole wound like its outline gets inside-out bore walls,
 // which are culled and leave a see-through bore (p98).
 const bored=(s,radius)=>{const h=new THREE.Path();h.absarc(0,0,radius,0,2*Math.PI,THREE.ShapeUtils.isClockWise(s.getPoints())===false);s.holes.push(h);return s;};
 bored(upper,.115);
 const fixed=shape([['moveTo',289,311],['lineTo',372,313],['lineTo',507,318],['bezierCurveTo',505,350,481,355,433,363],['bezierCurveTo',381,368,349,378,356,403],['bezierCurveTo',361,419,369,426,377,430],['lineTo',275,430],['bezierCurveTo',289,419,289,405,289,362]]);
 bored(fixed,.115);
 // Brown's circle (r .50, throw .26) swings the jaw only 11 degrees, but its
 // blade opens 18 degrees from the fixed blade. The cam keeps the drawn shaft
 // and the drawn open pose (its low point still just meets the arm, radius
 // minus throw .29) and grows to throw .35 so the blades close fully: the
 // whole cutting edge passes the fixed edge at the closed phase (p98).
 const camRadius=.64,eccentricity=.35;
 const disk=new THREE.Shape();disk.absarc(0,-eccentricity,camRadius,0,2*Math.PI,false);bored(disk,.105);
 const mesh=(s,z,depth,color)=>{const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:24});g.translate(0,0,z);return new THREE.Mesh(g,matte(color));};
 const upperMesh=mesh(upper,0,.16,PALETTE.driven),camMesh=mesh(disk,0,.16,PALETTE.driver);
 jaw.add(upperMesh);cam.add(camMesh);cam.position.set(-2.47,-.66,0);
 const fixedMesh=mesh(fixed,-.183,.18,PALETTE.frame);fixedMesh.name='fixed-jaw';root.add(fixedMesh);
 const base=shape([['moveTo',134,430],['lineTo',498,430],['lineTo',498,480],['lineTo',134,480]]);
 const baseMesh=mesh(base,-.183,.18,PALETTE.frame);baseMesh.name='base';root.add(baseMesh);
 const pin=(radius,length,x,y,z)=>{const g=new THREE.CylinderGeometry(radius,radius,length,48);g.rotateX(Math.PI/2);const m=new THREE.Mesh(g,matte(PALETTE.ink));m.position.set(x,y,z);root.add(m);};
 // Snug running fits: jaw pivot pin in its .115 bores, cam-shaft pin in the cam's .105 bore.
 // The pivot pin runs right through both jaws and stands proud of the fixed
 // jaw's back face (-.183) as well as the front (p98).
 pin(.112,.41,0,0,0);pin(.102,.30,-2.47,-.66,.06);
 const contour=upper.getPoints(24),holes=upper.holes.map(h=>h.getPoints(24));
 const cells=[];
 // ShapeUtils removes closing duplicates, so use open contours consistently.
 const open=r=>r[0].distanceTo(r.at(-1))<1e-10?r.slice(0,-1):r;
 const c=open(contour),h=holes.map(open),points=[...c,...h.flat()];
 for(const f of THREE.ShapeUtils.triangulateShape(c,h)){
  const [a,b,d]=f.map(i=>points[i]);if(Math.abs((b.x-a.x)*(d.y-a.y)-(b.y-a.y)*(d.x-a.x))<1e-12)continue;
  cells.push([0,.16].flatMap(z=>f.map(i=>[points[i].x,points[i].y,z])));
 }
 markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});root.updateMatrixWorld(true);
 root.userData={blocks:{jaw,cam},parts:{jaw:upperMesh,cam:camMesh},cells,profile:{camRadius,eccentricity,bladeClearance:.003}};
 return {root,focus:new THREE.Vector3(-.6,-.3,0),cameraDirection:new THREE.Vector3(.2,.15,10)};
}
