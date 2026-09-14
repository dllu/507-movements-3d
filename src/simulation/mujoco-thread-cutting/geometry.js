import * as THREE from 'three';
import {makeThreadCuttingProfile} from './profile.js';
import {makeUncutStock,threadTool} from './stock.js';
import {threadAngles,helicalThread,polygonCylinder} from '../mujoco-screw/thread-geometry.js';
import {plate,poly,circle,disk,polygonClipping as clip} from '../finite-plate-geometry.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
const rectangle=(l,b,r,t)=>poly([[l,b],[r,b],[r,t],[l,t]]),alongY=g=>g.rotateX(-Math.PI/2);
export function makeThreadCuttingGeometry(options={}) {
 const f=makeThreadCuttingProfile(options),e=f.source.edges,root=new THREE.Group(),parts={},families={},blocks={};
 for(const name of ['frame','lead','work','carriage']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 blocks.lead.position.set(f.leadX,0,f.leadZ);blocks.work.position.set(f.workX,0,f.workZ);blocks.carriage.position.copy(blocks.lead.position);
 const add=(name,g,family,color)=>{const m=new THREE.Mesh(g,matte(color,{metalness:.15,roughness:.6}));m.name=name;parts[name]=m;families[name]=family;blocks[family].add(m);return m;};
 const leadAngles=threadAngles(f.external,f.segments),nutAngles=threadAngles(f.internal,f.segments);
 const workAngles=threadAngles(f.workThread,f.segments,threadAngles(f.stock,f.segments).slice(0,-1));
 add('leadCore',alongY(polygonCylinder(f.coreRadius,f.external.low,f.external.high,leadAngles)),'lead',PALETTE.driver);
 add('leadThread',alongY(helicalThread(f.external,leadAngles)),'lead',PALETTE.driver);
 add('workCore',alongY(polygonCylinder(f.workCoreRadius,f.workThread.low,f.workThread.high,workAngles)),'work',PALETTE.driven);
 add('workThread',alongY(helicalThread(f.workThread,workAngles)),'work',PALETTE.driven);
 const toolHalfAngle=.055,stock=makeUncutStock(f.stock,workAngles);
 let lastCut=f.contactAngle-toolHalfAngle;
 add('uncutStock',alongY(stock.geometry(lastCut)),'work',PALETTE.driven);
 const setCutAngle=angle=>{if(angle===lastCut)return;lastCut=angle;const g=alongY(stock.geometry(angle)),m=parts.uncutStock;m.geometry.dispose();m.geometry=g;m.visible=g.attributes.position.count>0;};
 for(const [i,name]of ['lead','work'].entries()) {
  const r=f.shaftRadii[i],thread=name==='lead'?f.external:f.workThread,color=name==='lead'?PALETTE.driver:PALETTE.driven;
  add(name+'LowerShaft',alongY(disk(r,f.y(f.source.shaftEnds[1]),thread.low,128)),name,color);
  add(name+'UpperShaft',alongY(disk(r,thread.high,f.y(f.source.shaftEnds[0]),128)),name,color);
  const teeth=i?f.workTeeth:f.leadTeeth,phase=f.gearAngle+(i?Math.PI+Math.PI/teeth:0);
  const g=roundedRackGear({teeth,module:f.module,depth:f.gearDepth,boreRadius:r,samples:64,cutterSteps:1024});
  add(name+'Gear',alongY(g).rotateY(phase).translate(0,f.gearY,0),name,color);
 }
 for(const [name,left,right,bottom,top]of [['topRail',e.topLeft,e.topRight,e.topBottom,e.topTop],['bottomRail',e.bottomLeft,e.bottomRight,e.bottomBottom,e.bottomTop]]) {
  const l=f.x(left),r=f.x(right),beam=poly([[l,-f.beamZ(l)-.26],[r,-f.beamZ(r)-.26],[r,-f.beamZ(r)+.26],[l,-f.beamZ(l)+.26]]);
  const support=rectangle(f.leadX-.16,-f.leadZ+.15,f.leadX+.16,-f.leadZ+.77);
  const bores=clip.union(...[[f.leadX,f.leadZ],[f.workX,f.workZ]].map(([x,z],i)=>poly(circle([x,-z],f.shaftRadii[i]+f.clearance,128))));
  add(name,alongY(plate(clip.difference(clip.union(beam,support),bores),f.y(bottom),f.y(top))),'frame',PALETTE.frame);
 }
 // Put the hidden guide behind the complete input gear, not through its rim.
 // The longer key ties the carriage to this retained rail at every height.
 const guideSlot=poly([[-.035,.55],[.035,.55],[.035,.60],[.065,.60],[.065,.70],[-.065,.70],[-.065,.60],[-.035,.60]]);
 const guideSection=clip.difference(rectangle(-.13,.56,.13,.76),guideSlot);
 add('guide',alongY(plate(guideSection,f.y(e.bottomTop),f.y(e.topBottom))).translate(f.leadX,0,f.leadZ),'frame',PALETTE.frame);
 const keySection=poly([[-.032,.28],[.032,.28],[.032,.603],[.062,.603],[.062,.697],[-.062,.697],[-.062,.603],[-.032,.603]]);
 add('guideKey',alongY(plate(keySection,f.internal.low+.035,f.internal.high-.035)),'carriage',PALETTE.accent);
 const bore=poly(nutAngles.slice(0,-1).map(a=>[f.internal.outer*Math.cos(a),f.internal.outer*Math.sin(a)]));
 const body=clip.difference(rectangle(f.x(e.carriageLeft)-f.leadX,-.28,f.x(e.carriageRight)-f.leadX,.28),bore);
 add('carriage',alongY(plate(body,f.internal.low,f.internal.high)),'carriage',PALETTE.accent);
 add('nutThread',alongY(helicalThread(f.internal,nutAngles)),'carriage',PALETTE.accent);
 const u=[f.dx/f.distance,-f.dz/f.distance],normal=[-u[1],u[0]],start=(f.x(e.carriageRight)-f.leadX-.015)/u[0],outer=f.workRadius+.055;
 const arc=Array.from({length:9},(_,i)=>{const a=f.contactAngle+toolHalfAngle-2*toolHalfAngle*i/8;return[f.dx+outer*Math.cos(a),f.dz+outer*Math.sin(a)];});
 const armSection=poly([[u[0]*start+normal[0]*.045,-u[1]*start-normal[1]*.045],...arc,[u[0]*start-normal[0]*.045,-u[1]*start+normal[1]*.045]]);
 add('arm',alongY(plate(armSection,f.armY-f.armHeight/2,f.armY+f.armHeight/2)),'carriage',PALETTE.accent);
 const blade=threadTool({...f.stock,inner:f.workCoreRadius+f.clearance,outer,width:f.grooveWidth-2*f.clearance},f.contactAngle,toolHalfAngle);
 add('cutter',alongY(blade).translate(f.dx,0,-f.dz),'carriage',PALETTE.accent);
 Object.assign(root.userData,{source:f.source,profile:f,parts,families,blocks,leadAngles,nutAngles,workAngles,stock,setCutAngle,toolHalfAngle,guideSection,keySection,
  hideGround:true,shadowCameraHalfExtent:3,shadowBias:-.00002,shadowNormalBias:.001});
 markShadows(root);root.updateMatrixWorld(true);
 return {root,focus:new THREE.Vector3(0,0,0),cameraDirection:new THREE.Vector3(1,1,10)};
}
