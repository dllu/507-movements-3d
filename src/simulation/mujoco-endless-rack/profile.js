import {roundedRackGear} from '../coaxial-gear-geometry.js';
import {poly,polygonClipping as clip} from '../finite-plate-geometry.js';
import source from './source.js';
// A common rack cutter defines the straight teeth and both circular ends.
// The generated circular teeth join straight rack teeth at the end tangencies.
// Their finite running clearance is checked in native contact studies.
export function endlessRackProfile({module:m=source.module,samples=96,cutterSteps=2048,straightTeeth=8,endTeeth=6,addendum=.8,dedendum=1,offset=.5}={}){
 if(![m,addendum,dedendum].every(v=>Number.isFinite(v)&&v>0)||!Number.isInteger(samples)||samples<32||!Number.isInteger(cutterSteps)||cutterSteps<256||!Number.isInteger(straightTeeth)||straightTeeth<2||!Number.isInteger(endTeeth)||endTeeth<4||![0,.5].includes(offset))throw new RangeError('Invalid 119 profile options');
 const pitch=Math.PI*m,R=4*m,B=endTeeth*m,L=straightTeeth*pitch/2,H=R+B,alpha=Math.PI/9,corner=.12*m;
 const gear=roundedRackGear({teeth:8,module:m,depth:.24,boreRadius:.09,addendum,dedendum,tipRadius:corner,samples,cutterSteps});
 const cap=roundedRackGear({teeth:endTeeth*2,module:m,depth:.24,boreRadius:.01,addendum,dedendum,tipRadius:corner,samples,cutterSteps});
 const phase=Math.PI/2+(offset-Math.floor(offset))*Math.PI/endTeeth;
 const turn=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
 const right=poly(cap.userData.outline.map(p=>turn(p.toArray(),phase)).map(([x,y])=>[x+L,y]));
 const left=poly(cap.userData.outline.map(p=>turn(p.toArray(),phase)).map(([x,y])=>[x-L,y]));
 const rightHalf=poly([[L,-2*H],[L+2*H,-2*H],[L+2*H,2*H],[L,2*H]]),leftHalf=poly([[-L-2*H,-2*H],[-L,-2*H],[-L,2*H],[-L-2*H,2*H]]);
 let body=poly([[-L,-B+dedendum*m],[L,-B+dedendum*m],[L,B-dedendum*m],[-L,B-dedendum*m]]);
 const tooth=[[-(pitch/4+dedendum*m*Math.tan(alpha)),B-dedendum*m],[-(pitch/4-addendum*m*Math.tan(alpha)),B+addendum*m],[pitch/4-addendum*m*Math.tan(alpha),B+addendum*m],[pitch/4+dedendum*m*Math.tan(alpha),B-dedendum*m]];
 const pieces=[body,clip.intersection(right,rightHalf),clip.intersection(left,leftHalf)];
 for(const sign of [-1,1])for(let i=-1;i<=straightTeeth;i++){
  const x=-L+(i+offset)*pitch;const p=clip.intersection(poly(tooth.map(([a,b])=>[x+a,sign*b])),poly([[-L,-2*H],[L,-2*H],[L,2*H],[-L,2*H]]));if(p.length)pieces.push(p);
 }
 body=clip.union(...pieces);cap.dispose();
 // Clockwise travel around the pinion-center capsule, starting above its center.
 const length=4*L+2*Math.PI*H;
 const atDistance=distance=>{
  let d=((distance+L)%length+length)%length,point,tangent,region;
  if(d<2*L){point=[-L+d,H];tangent=[1,0];region='top';}
  else if((d-=2*L)<Math.PI*H){const a=Math.PI/2-d/H;point=[L+H*Math.cos(a),H*Math.sin(a)];tangent=[Math.sin(a),-Math.cos(a)];region='right';}
  else if((d-=Math.PI*H)<2*L){point=[L-d,-H];tangent=[-1,0];region='bottom';}
  else{d-=2*L;const a=-Math.PI/2-d/H;point=[-L+H*Math.cos(a),H*Math.sin(a)];tangent=[Math.sin(a),-Math.cos(a)];region='left';}
  return{point,tangent,region};
 };
 const gap=(x,y)=>Math.hypot(Math.max(0,Math.abs(x)-L),y)-H;
 return{module:m,pitch,R,B,L,H,straightTeeth,endTeeth,addendum,dedendum,offset,samples,cutterSteps,gear,body,length,atDistance,gap};
}
