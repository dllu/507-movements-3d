import * as THREE from 'three';
import {rackPinionSource as s} from './source.js';
import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {plate,poly,polygonClipping,turned,disk,ring} from '../finite-plate-geometry.js';
import {convexPlateCells} from '../mujoco/convex-plate.js';
import {PALETTE,matte,markShadows} from '../primitives.js';
export {THREE};
export function makeRackPinionGeometry({samples=96,cutterSteps=2048,amplitude=.7}={}) {
 if(!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isFinite(amplitude)||amplitude<=0||amplitude>1)throw new RangeError('Invalid 113 geometry options');
 const root=new THREE.Group(),parts={},families={},blocks={},cells={},m=s.module,R=s.teeth*m/2,pitch=Math.PI*m,alpha=Math.PI/9,corner=.08*m,clearance=.001;
 const local=([x,y])=>[(Math.cos(s.tilt)*(x-s.axis[0])+Math.sin(s.tilt)*(s.axis[1]-y))/100,(-Math.sin(s.tilt)*(x-s.axis[0])+Math.cos(s.tilt)*(s.axis[1]-y))/100];
 const railBottom=local([s.axis[0],s.lines.railBottom.intercept+s.lines.railBottom.slope*s.axis[0]])[1],railTop=local([s.axis[0],s.lines.railTop.intercept+s.lines.railTop.slope*s.axis[0]])[1];
 const left=local([s.edges.railLeft,s.lines.railTop.intercept+s.lines.railTop.slope*s.edges.railLeft])[0],right=local([s.edges.railRight,s.lines.railTop.intercept+s.lines.railTop.slope*s.edges.railRight])[0];
 const profile={source:s,axis:s.axis,samples,cutterSteps,module:m,pitchRadius:R,pitch,amplitude,phase:s.phase,railBottom,railTop,left,right,clearance,rollers:[]};
 for(const name of ['pinion','rack','leftRoller','rightRoller']){blocks[name]=new THREE.Group();root.add(blocks[name]);}
 const add=(name,g,family,color)=>{const mesh=new THREE.Mesh(g,matte(color,{metalness:.18,roughness:.55}));mesh.name=name;blocks[family].add(mesh);parts[name]=mesh;families[name]=family;return mesh;};
 const gear=roundedRackGear({teeth:s.teeth,module:m,depth:.24,boreRadius:s.circles.shaft.radius/100,addendum:.8,dedendum:.8,tipRadius:corner,samples,cutterSteps});gear.rotateZ(s.phase);
 add('pinion',gear,'pinion',PALETTE.driver);
 const shaftRadius=s.circles.shaft.radius/100;
 add('shaft',disk(shaftRadius,-.23,.20,96),'pinion',PALETTE.ink);
 add('hub',ring(shaftRadius,s.circles.hub.radius/100,.12,.16,96),'pinion',PALETTE.driver);
 const rail=plate(poly([[left,railTop],[right,railTop],[right-.07,railBottom],[left+.06,railBottom]]),-.15,.45);add('rail',rail,'rack',PALETTE.driven);
 const rootY=R+.95*m,bottom=R-.8*m+clearance,circleY=bottom+corner,bottomHalf=pitch/4-.8*m*Math.tan(alpha),circleX=bottomHalf-corner*(1/Math.cos(alpha)-Math.tan(alpha)),tangentY=circleY-corner*Math.sin(alpha);
 const tooth=[[-(pitch/4+(rootY-R-clearance)*Math.tan(alpha)),rootY]];
 for(let i=0;i<=16;i++){const a=Math.PI+alpha+(Math.PI/2-alpha)*i/16;tooth.push([-circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}
 tooth.push([circleX,bottom]);
 for(let i=1;i<=16;i++){const a=-Math.PI/2+(Math.PI/2-alpha)*i/16;tooth.push([circleX+corner*Math.cos(a),circleY+corner*Math.sin(a)]);}
 tooth.push([pitch/4+(rootY-R-clearance)*Math.tan(alpha),rootY]);
 if(Math.abs(tooth[1][1]-tangentY)>1e-10)throw Error('Rack corner does not meet the flank');
 const rackLeft=local([s.edges.rackLeft,365])[0],rackRight=local([s.edges.rackRight,360])[0];
 const body=poly([[rackLeft,rootY],[rackRight,rootY],[rackRight,railBottom],[rackLeft,railBottom]]),teeth=Array.from({length:14},(_,i)=>poly(tooth.map(([x,y])=>[x+s.rackOrigin+i*pitch,y])));
 const rack=plate(polygonClipping.union(body,...teeth),-.12,.12);add('rack',rack,'rack',PALETTE.driven);
 for(const name of ['leftRoller','rightRoller']){
  const c=s.circles[name],radius=c.radius/100,x=local(c.center)[0],y=railBottom-radius,rim=s.circles[name==='leftRoller'?'leftRim':'rightRim'].radius/100;
  profile.rollers.push({name,x,y,radius,z:.275,halfDepth:.125});blocks[name].position.set(x,y,0);
  add(name,turned([[.15,0],[.15,radius],[.4,radius],[.4,rim],[.388,rim],[.388,0]],96),name,PALETTE.frame);
 }
 for(const name of ['pinion','rack','rail']){const c=convexPlateCells(parts[name].geometry);cells[name]=c.cells.map(poly=>[c.low,c.high].flatMap(z=>poly.map(p=>[...p,z])));}
 root.rotation.z=s.tilt;Object.assign(root.userData,{parts,families,blocks,cells,profile,hideGround:true,shadowCameraHalfExtent:4,shadowBias:-.00002,shadowNormalBias:.0005});
 markShadows(root);root.updateMatrixWorld(true);return {root,focus:new THREE.Vector3(0,.3,0),cameraDirection:new THREE.Vector3(1.5,1,10)};
}
