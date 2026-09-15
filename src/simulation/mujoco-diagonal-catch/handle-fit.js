// Joint rigid-body fit to both engraved stages. Coordinates are measured in
// each plate's raster; pivot registration removes their small drawing offset.
// A finite tip must clear the right edge of the piston shoe in the held pose.
const scale = .0125;
const rotate = ([x,y],a) => [x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const relative = (p,o) => [(p[0]-o[0])*scale,(o[1]-p[1])*scale];
const distance2 = (a,b) => (a[0]-b[0])**2+(a[1]-b[1])**2;
const source = {
 upper:{pivots:[[275,122],[273,120]],tips:[[207,295],[66,154]],weights:[[402,54],[408,170]]},
 lower:{pivots:[[273,351],[269,351]],tips:[[82,315],[199,188]],weights:[[137,422],[127,305]]},
};
const fitted = new Map();

export function fitDiagonalHandle(side) {
 if(fitted.has(side))return structuredClone(fitted.get(side));
 const measured=source[side];
 if(!measured)throw new RangeError('Unknown handle side');
 const tips=measured.tips.map((p,i)=>relative(p,measured.pivots[i]));
 const weights=measured.weights.map((p,i)=>relative(p,measured.pivots[i]));
 const pivot=relative(measured.pivots[0],[271,234]);
 const tipRadius=.10,shoeRight=(193-271)*scale,clearance=.025;
 const minimumClosedX=shoeRight+tipRadius+clearance-pivot[0];
 let best=null;
 for(let i=0;i<=8000;i++){
  const angle=-.6-i*.0001;
  const mean=pair=>{const b=rotate(pair[1],-angle);return pair[0].map((v,j)=>(v+b[j])/2);};
  const tip=mean(tips),weight=mean(weights);
  const closedAngle=side==='upper'?0:angle;
  const closedTip=rotate(tip,closedAngle);
  if(closedTip[0]<minimumClosedX){
   const correction=rotate([minimumClosedX-closedTip[0],0],-closedAngle);
   tip[0]+=correction[0];tip[1]+=correction[1];
  }
  const errors=[distance2(tip,tips[0]),distance2(rotate(tip,angle),tips[1]),distance2(weight,weights[0]),distance2(rotate(weight,angle),weights[1])];
  const score=errors.reduce((a,b)=>a+b,0);
  if(!best||score<best.score)best={angle,tip,weight,score,errorsPixels:errors.map(e=>Math.sqrt(e)/scale)};
 }
 const result={...best,side,pivot,tipRadius,shoeRight,clearance,measured};
 fitted.set(side,result);
 return structuredClone(result);
}

// Keep the traced curvature, applying one similarity transform about its pivot
// to fit the new free tip. This never changes the arm's shape during animation.
export function fitWorkingPoint(point,oldTip,fit) {
 const factor=Math.hypot(...fit.tip)/Math.hypot(...oldTip);
 const angle=Math.atan2(fit.tip[1],fit.tip[0])-Math.atan2(oldTip[1],oldTip[0]);
 return rotate(point,angle).map(v=>v*factor);
}
