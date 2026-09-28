import * as THREE from 'three';

// A 23-tooth-equivalent sector and its conjugate 20-degree rack. Keep the
// tooth surfaces unbevelled: an outward bevel changes their running clearance.
// Addendum and dedendum are in modules; 131 uses a 14.5-degree stub form
// (0.8/1.0) so both members show Brown's square, flat-topped teeth.
export function slottedSectorToothProfiles({radius=2.5,teeth=23,webRadius=2.08,pressureAngle=Math.PI/9,addendum=1,dedendum=1.25}={}) {
 const module=2*radius/teeth,pitch=Math.PI*module,alpha=pressureAngle;
 const root=radius-dedendum*module,tip=radius+addendum*module,base=radius*Math.cos(alpha);
 const backlash=.008*module,inv=a=>Math.tan(a)-a;
 const half=r=>Math.PI/(2*teeth)-backlash/(2*radius)+inv(alpha)-inv(Math.acos(Math.min(1,base/r)));
 const polar=(r,a)=>new THREE.Vector2(r*Math.cos(a),r*Math.sin(a));
 const tooth=[polar(webRadius-.01,-Math.PI/teeth),polar(root,-Math.PI/teeth),polar(root,-half(base))];
 for(let i=0;i<=48;i++){const r=base+(tip-base)*i/48;tooth.push(polar(r,-half(r)));}
 for(let i=1;i<=12;i++)tooth.push(polar(tip,-half(tip)+2*half(tip)*i/12));
 for(let i=47;i>=0;i--){const r=base+(tip-base)*i/48;tooth.push(polar(r,half(r)));}
 tooth.push(polar(root,half(base)),polar(root,Math.PI/teeth),polar(webRadius-.01,Math.PI/teeth));
 const rackRoot=-dedendum*module,rackTip=addendum*module;
 const width=y=>pitch/4-y*Math.tan(alpha)-backlash/2;
 const rack=[new THREE.Vector2(-width(rackRoot),rackRoot),new THREE.Vector2(-width(rackTip),rackTip),new THREE.Vector2(width(rackTip),rackTip),new THREE.Vector2(width(rackRoot),rackRoot)];
 return {tooth,rack,module,pitch,root,tip,base,pressureAngle:alpha,backlash,addendum,dedendum,rackRoot,rackTip};
}
