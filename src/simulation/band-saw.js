import * as THREE from 'three';
import {plate,poly,circle,capsule,polygonClipping as clip} from './finite-plate-geometry.js';
import {matte,PALETTE,markShadows} from './primitives.js';
import {disposeObject3D} from './dispose-model.js';
import {bandSawDimensions as source} from '../data/band-saw-dimensions.js';
import {bandSawPathDimensions as d,bandSawPathLength as length,bandSawPoint as at,bandSawMotion} from './band-saw-path.js';

export function makeBandSaw(){
 const root=new THREE.Group(),parts={},wheels=[],r=d.radius,h=d.spacing;
 const world=([x,y])=>[(x-315)/100,(400-y)/100];
 const rect=(a,b,c,e)=>poly([[a,b],[c,b],[c,e],[a,e]]);
 const add=(parent,name,p,z1,z2,color)=>{const mesh=new THREE.Mesh(plate(p,z1,z2),matte(color));mesh.name=name;parent.add(mesh);parts[name]=mesh;return mesh;};
 const smooth=p=>new THREE.SplineCurve(p.map(p=>new THREE.Vector2(...p))).getPoints(96).map(p=>p.toArray());
 const column=[...smooth(source.columnOuter),...smooth(source.columnInner),[source.columnInner.at(-1)[0],source.base.top]];
 add(root,'curved-column',poly(column.map(world)),-.28,-.16,PALETTE.frame);
 add(root,'base',rect(-2.72,-.96,1.18,-.86),-.40,.20,PALETTE.frame);
 const rimRadius=r-d.thickness/2-.00002;
 for(const [name,y,color]of [['lower',0,PALETTE.driver],['upper',h,PALETTE.driven]]){
  const wheel=new THREE.Group();wheel.position.y=y;root.add(wheel);wheels.push(wheel);
  add(wheel,name+'-rim',clip.difference(poly(circle([0,0],rimRadius,512)),poly(circle([0,0],.45,512))),d.wheelBack,d.wheelFront,color);
  add(wheel,name+'-hub',clip.difference(poly(circle([0,0],.09,64)),poly(circle([0,0],.0355,64))),-.10,.065,color);
  for(let i=0;i<6;i++){
   const angle=i*Math.PI/3,curve=new THREE.CubicBezierCurve(new THREE.Vector2(.07,0),new THREE.Vector2(.23,.005),new THREE.Vector2(.31,.13),new THREE.Vector2(.46,.09));
   const points=curve.getPoints(16).map(p=>[p.x*Math.cos(angle)-p.y*Math.sin(angle),p.x*Math.sin(angle)+p.y*Math.cos(angle)]);
   add(wheel,name+'-spoke-'+i,clip.union(...points.slice(1).map((p,j)=>capsule(points[j],p,.017,12))),-.05,.015,color);
  }
  add(root,name+'-shaft',poly(circle([0,y],.035,64)),-.32,.08,PALETTE.ink);
  add(root,name+'-bearing',clip.difference(poly(circle([0,y],.11,64)),poly(circle([0,y],.0355,64))),-.32,-.105,PALETTE.frame);
 }
 // Rear bearing brackets connect both shafts to the casting.
 add(root,'lower-bearing-arm',rect(-.84,-.11,0,.11),-.28,-.17,PALETTE.frame);
 add(root,'upper-bearing-arm',rect(-.45,h-.11,0,h+.11),-.28,-.17,PALETTE.frame);
 const tablePlan=clip.difference(rect(-.68,-.25,2,.40),rect(.49,-.07,.51,.41),rect(-.51,-.26,-.49,.105));
 const table=new THREE.Mesh(plate(tablePlan,0,.07),matte(PALETTE.frame));table.rotation.x=Math.PI/2;table.position.y=.66;table.name='slotted-table';root.add(table);parts[table.name]=table;
 add(root,'table-pedestal',poly([[.54,-.86],[.94,-.86],[.87,-.55],[.87,.41],[.69,.47],[.53,.40],[.58,-.50]]),.17,.30,PALETTE.frame);
 add(root,'table-trunnion-seat',poly(circle([.70,.55],.105,64)),.17,.30,PALETTE.frame);
 const brace=[];for(let i=0;i<=128;i++){const a=Math.PI+Math.PI*i/128;brace.push([.70+1.10*Math.cos(a),.59+1.10*Math.sin(a)]);}for(let i=128;i>=0;i--){const a=Math.PI+Math.PI*i/128;brace.push([.70+.90*Math.cos(a),.59+.90*Math.sin(a)]);}
 add(root,'table-brace',poly(brace),.18,.29,PALETTE.frame);
 // Four-corner ribbon with exact tangent stations; circular wraps use 256
 // facets per half turn. The tread is inset by more than their chord sag.
 const stations=[0,h];for(let i=1;i<=256;i++)stations.push(h+Math.PI*r*i/256);
 stations.push(2*h+Math.PI*r);for(let i=1;i<256;i++)stations.push(2*h+Math.PI*r+Math.PI*r*i/256);
 const positions=[],indices=[];
 for(const s of stations){const p=at(s);for(const [rad,z]of [[d.thickness/2,-d.width/2],[-d.thickness/2,-d.width/2],[-d.thickness/2,d.width/2],[d.thickness/2,d.width/2]])positions.push(p.point[0]+rad*p.normal[0],p.point[1]+rad*p.normal[1],z);}
 for(let i=0;i<stations.length;i++)for(let j=0;j<4;j++){const a=4*i+j,b=4*((i+1)%stations.length)+j,c=4*((i+1)%stations.length)+(j+1)%4,e=4*i+(j+1)%4;indices.push(a,b,c,a,c,e);}
 const ribbonGeometry=new THREE.BufferGeometry();ribbonGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));ribbonGeometry.setIndex(indices);ribbonGeometry.computeVertexNormals();
 const ribbon=new THREE.Mesh(ribbonGeometry,matte(PALETTE.ink));ribbon.name='continuous-blade';root.add(ribbon);parts[ribbon.name]=ribbon;
 const toothCount=128,pitch=length/toothCount,toothGeometry=new THREE.BufferGeometry(),toothPositions=new Float32Array(toothCount*18),toothIndices=[];
 for(let i=0;i<toothCount;i++)for(const j of [0,1,2,3,5,4,0,3,4,0,4,1,1,4,5,1,5,2,2,5,3,2,3,0])toothIndices.push(6*i+j);
 toothGeometry.setAttribute('position',new THREE.BufferAttribute(toothPositions,3).setUsage(THREE.DynamicDrawUsage));toothGeometry.setIndex(toothIndices);
 const teeth=new THREE.Mesh(toothGeometry,matte(PALETTE.ink));teeth.name='moving-saw-teeth';teeth.frustumCulled=false;root.add(teeth);parts[teeth.name]=teeth;
 const update=time=>{const motion=bandSawMotion(time);wheels.forEach(w=>w.rotation.z=motion.wheelAngle+25*Math.PI/180);
  for(let i=0;i<toothCount;i++)for(let j=0;j<6;j++){
   const k=j%3,s=motion.travel+i*pitch+[-.30,.30,.22][k]*pitch,p=at(s),rad=(j<3?-1:1)*d.thickness/2;
   toothPositions.set([p.point[0]+rad*p.normal[0],p.point[1]+rad*p.normal[1],d.width/2+(k===2?d.toothProjection:0)],18*i+3*j);
  }
  toothGeometry.attributes.position.needsUpdate=true;toothGeometry.computeVertexNormals();root.updateMatrixWorld(true);root.userData.state=motion;
 };
 update(0);markShadows(root);root.traverse(o=>{if(o.material)o.material.fog=false;});
 const bounds=new THREE.Box3(new THREE.Vector3(-2.77,-1.01,-.45),new THREE.Vector3(2.05,h+r+.05,.45));
 Object.assign(root.userData,{parts,wheels,geometry:{rimRadius,stations,toothCount,pitch},mechanism:'measured-endless-band-saw',simulationBackend:'analytic',fidelity:'authored',reconstructionStatus:'verified',hideGround:true,supportsRestart:true,cameraDistanceScale:1.18,cameraFitBounds:bounds,sampledMotionBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},reconstructionNote:'Equal wheels carry a continuous blade downward through the table. Wheel spacing and frame proportions follow the engraving; blade thickness, teeth, table slots and rear supports are reconstructed.',animationTiming:{authoredCyclePeriod:d.period,displayCycleDuration:d.period,playbackTimeScale:1}});
 return {root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.08,.04,15),update,reset:()=>update(0),dispose:()=>disposeObject3D(root)};
}
