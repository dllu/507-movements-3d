import * as THREE from 'three';
import source from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,circle,disk,ring,capsule,polygonClipping as clip} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeStrokeDoublerGeometry({samples=96,cutterSteps=2048,amplitude=.5}={}){
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isFinite(amplitude)||amplitude<=0||amplitude>1.2)throw new RangeError('Invalid 118 geometry options');
 const s=source,m=s.module,R=s.teeth*m/2,pitch=Math.PI*m,alpha=Math.PI/9,corner=.08*m,clearance=.001;
 const root=new THREE.Group(),parts={},families={},blocks={},cells={};
 const local=([x,y])=>[(Math.cos(s.tilt)*(x-s.axis[0])+Math.sin(s.tilt)*(s.axis[1]-y))/100,(-Math.sin(s.tilt)*(x-s.axis[0])+Math.cos(s.tilt)*(s.axis[1]-y))/100];
 const atLine=n=>local([s.axis[0],s.lines[n].intercept+s.lines[n].slope*s.axis[0]])[1];
 for(const name of ['carrier','pinion','rack','fixed']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,g,family,color,pos=[0,0,0])=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=name;mesh.position.fromArray(pos);blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const gear=roundedRackGear({teeth:s.teeth,module:m,depth:.24,boreRadius:s.pinRadius+clearance,addendum:.8,dedendum:1,tipRadius:corner,samples,cutterSteps});gear.rotateZ(s.phase);add('pinion',gear,'pinion',PALETTE.driver);
 const rootY=R+m+clearance,tipY=R-.8*m+clearance,circleY=tipY+corner,circleX=pitch/4-.8*m*Math.tan(alpha)-corner*(1/Math.cos(alpha)-Math.tan(alpha));
 const tooth=[[-(pitch/4+m*Math.tan(alpha)),rootY]];
 for(let i=0;i<=16;i++){const a=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}
 tooth.push([circleX,tipY]);for(let i=1;i<=16;i++){const a=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}
 tooth.push([pitch/4+m*Math.tan(alpha),rootY]);
 const upperTop=atLine('upperTop'),left=local([28,195])[0],right=local([503,191])[0];
 const upperBody=poly([[left,rootY],[right,rootY],[right,upperTop],[left+.065,upperTop],[left,upperTop-.065]]);
 const upperTeeth=Array.from({length:19},(_,i)=>poly(tooth.map(([x,y])=>[x+s.origins.upper+i*pitch,y])));
 add('upperRack',plate(clip.union(upperBody,...upperTeeth),-.12,.12),'rack',PALETTE.driven);
 const under=atLine('lowerUnderside'),baseTop=atLine('baseTop'),baseBottom=atLine('baseBottom');
 const lx=local([29,350])[0],rx=local([518,350])[0],shape=new THREE.Shape();
 shape.moveTo(lx,baseTop);shape.lineTo(lx,under-.07);shape.quadraticCurveTo(lx,-rootY,lx+.26,-rootY);shape.lineTo(rx-.28,-rootY);shape.quadraticCurveTo(rx,-rootY,rx,under-.09);shape.lineTo(rx,baseTop);shape.lineTo(rx-.19,baseTop);shape.lineTo(rx-.19,under-.10);shape.quadraticCurveTo(rx-.19,under,rx-.30,under);shape.lineTo(lx+.29,under);shape.quadraticCurveTo(lx+.16,under,lx+.16,under-.09);shape.lineTo(lx+.16,baseTop);shape.closePath();
 const lowerTeeth=Array.from({length:20},(_,i)=>poly(tooth.map(([x,y])=>[x+s.origins.lower+i*pitch,-y])));
 add('lowerRack',plate(clip.union(poly(shape.getPoints(24).map(p=>[p.x,p.y])),...lowerTeeth),-.12,.12),'fixed',PALETTE.frame);
 const bedLeft=local([16,360])[0],bedRight=local([514,360])[0];add('bed',plate(poly([[bedLeft,baseBottom],[bedRight,baseBottom],[bedRight,baseTop],[bedLeft,baseTop]]),-.20,.20),'fixed',PALETTE.frame);
 // The caption assigns no motion to the three rounded forms below the fixed
 // rack. Their reconstruction as static support webs is an explicit inference.
 const radius=(under-baseTop)/2,cy=(under+baseTop)/2;
 for(const [i,[a,b]]of [[77,167],[196,319],[350,443]].entries()){
  const x0=local([a,340])[0],x1=local([b,340])[0];add('support'+i,plate(capsule([x0+radius,cy],[x1-radius,cy],radius,48),-.10,.10),'fixed',PALETTE.frame);
 }
 const rodTop=x=>s.lines.rodTop.intercept+s.lines.rodTop.slope*x,rodBottom=x=>s.lines.rodBottom.intercept+s.lines.rodBottom.slope*x;
 // Brown breaks the pitman off at the plate edge. Model it whole: the rod
 // ends in a rounded crank-end eye on its pin (the crank lies off the plate).
 const endX=28,end=local([endX,(rodTop(endX)+rodBottom(endX))/2]),endEye=.10,endPin=.045;
 const rod=poly([[endX,rodTop(endX)],[s.axis[0],rodTop(s.axis[0])],[s.axis[0],rodBottom(s.axis[0])],[endX,rodBottom(endX)]].map(local));
 const pitman=clip.difference(clip.union(rod,poly(circle([0,0],s.eyeRadius,128)),poly(circle(end,endEye,96))),poly(circle([0,0],s.pinRadius,96)),poly(circle(end,endPin+.004,64)));
 add('pitman',plate(pitman,.20,.32),'carrier',PALETTE.brass);
 add('crankPin',disk(endPin,.15,.37,48),'carrier',PALETTE.ink,[end[0],end[1],0]);
 add('eye',ring(s.pinRadius,s.eyeRadius,.32,.36,128),'carrier',PALETTE.brass);
 add('spindle',disk(s.pinRadius,-.15,.40,96),'carrier',PALETTE.ink);
 for(const name of ['pinion','upperRack','lowerRack']){const c=convexPlateCells(parts[name].geometry);cells[name]=c.cells.map(points=>[c.low,c.high].flatMap(z=>points.map(p=>[...p,z])));}
 root.rotation.z=s.tilt;Object.assign(root.userData,{source:s,parts,families,blocks,cells,profile:{amplitude,pitchRadius:R,pitch,clearance,rootY,tipY,under,baseTop,baseBottom,upperTop,samples,cutterSteps},hideGround:true,shadowCameraHalfExtent:6,shadowNormalBias:.01,shadowBias:-.00002});
 markShadows(root);root.updateMatrixWorld(true);const bounds=new THREE.Box3();for(const x of [-amplitude,amplitude]){blocks.carrier.position.x=blocks.pinion.position.x=x;blocks.rack.position.x=2*x;root.updateMatrixWorld(true);bounds.union(new THREE.Box3().setFromObject(root,true));}for(const b of Object.values(blocks))b.position.set(0,0,0);root.updateMatrixWorld(true);bounds.expandByScalar(.05);
 root.userData.sampledMotionBounds={min:bounds.min.toArray(),max:bounds.max.toArray()};
 // Brown draws both racks whole, so keep the upper rack, which slides twice
 // the pitman stroke, in frame through its full sweep.
 root.userData.cameraFitBounds=bounds.clone();
 // Added after the framing bounds, which keep Brown's view.
 // Brown draws no drive or guide. The pitman's end pin carries a plain tail
 // rod that slides in a fixed guide on a post standing on the floor beyond
 // the bed's end (the pitman translates, so its driver is a guided rod, not
 // a crank), and the upper rack runs in two fixed clips whose back cheeks
 // are posts rising from the bed behind the racks.
 const tailY=end[1],tailZ=.26,tailRadius=.05,gap=.15,guideLength=.3,guideStart=end[0]-endEye-amplitude-gap;
 const tailEnd=guideStart-guideLength-amplitude-.05;
 add('tailRod',disk(tailRadius,tailEnd,end[0]-endEye+.03,48).rotateY(Math.PI/2).translate(0,tailY,tailZ),'carrier',PALETTE.brass);
 add('tailGuide',ring(tailRadius+.004,tailRadius+.09,guideStart-guideLength,guideStart,64).rotateY(Math.PI/2).translate(0,tailY,tailZ),'fixed',PALETTE.frame);
 const guideX=guideStart-guideLength/2,postTop=tailY-tailRadius-.06;
 add('tailGuidePost',new THREE.BoxGeometry(.14,postTop-baseBottom,.12).translate(guideX,(postTop+baseBottom)/2,tailZ),'fixed',PALETTE.frame);
 add('tailGuideFoot',new THREE.BoxGeometry(.5,.08,.5).translate(guideX,baseBottom+.04,tailZ),'fixed',PALETTE.frame);
 const clipTop=Math.max(upperTop,atLine('upperTop'))+.035,cheekBottom=upperTop-.13;
 for(const [i,x] of [-1,1].entries()){
  add('rackClipCap'+i,new THREE.BoxGeometry(.24,.06,.39).translate(x,clipTop+.03,-.005),'fixed',PALETTE.frame);
  add('rackClipCheek'+i,new THREE.BoxGeometry(.24,clipTop+.06-cheekBottom,.05).translate(x,(clipTop+.06+cheekBottom)/2,.155),'fixed',PALETTE.frame);
  add('rackClipPost'+i,new THREE.BoxGeometry(.24,clipTop+.06-baseTop,.07).translate(x,(clipTop+.06+baseTop)/2,-.165),'fixed',PALETTE.frame);
 }
 for(const name of Object.keys(parts))if(/^(tail|rackClip)/.test(name))parts[name].castShadow=parts[name].receiveShadow=true;
 root.updateMatrixWorld(true);
 // Brown draws the racks and pinion as a flat elevation.
 return{root,focus:bounds.getCenter(new THREE.Vector3()),cameraDirection:new THREE.Vector3(.02,.01,1)};
}
