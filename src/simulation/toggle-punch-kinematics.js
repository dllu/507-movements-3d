import {togglePunchDimensions as source} from '../data/toggle-punch-dimensions.js';
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const world=p=>[(p[0]-source.leverPivot[0])/source.pixelsPerUnit,(source.leverPivot[1]-p[1])/source.pixelsPerUnit];
const rotate=([x,y],a)=>[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];
const intersections=(a,r,b,s)=>{
 const d=distance(a,b),u=[(b[0]-a[0])/d,(b[1]-a[1])/d],along=(r*r-s*s+d*d)/(2*d),square=r*r-along*along;
 if(d===0||square< -1e-12)throw new RangeError('Unreachable toggle linkage');
 const h=Math.sqrt(Math.max(0,square)),p=[a[0]+along*u[0],a[1]+along*u[1]];
 return [[p[0]-h*u[1],p[1]+h*u[0]],[p[0]+h*u[1],p[1]-h*u[0]]];
};
const nearest=(points,reference)=>points.reduce((a,b)=>distance(a,reference)<distance(b,reference)?a:b);
export const togglePunchGeometry=(()=>{
 const top=world(source.topPivot),knee=world(source.knee),ram=world(source.ramPin),pin=world(source.leverPin);
 const upperLength=distance(top,knee),lowerLength=distance(knee,ram),connectorLength=distance(pin,knee),crankRadius=Math.hypot(...pin);
 const closedRam=[ram[0],top[1]-Math.sqrt((upperLength+lowerLength)**2-(ram[0]-top[0])**2)];
 const closedKnee=top.map((x,i)=>x+(closedRam[i]-x)*upperLength/(upperLength+lowerLength));
 // Both four-bar assemblies reach this toggle pose. The smaller clockwise
 // lever stroke reaches it first on the engraving's initial assembly branch.
 const angles=intersections([0,0],crankRadius,closedKnee,connectorLength).map(p=>{
  let angle=Math.atan2(p[1],p[0])-Math.atan2(pin[1],pin[0]);while(angle>0)angle-=2*Math.PI;return angle;
 });
 return {top,knee,ram,pin,upperLength,lowerLength,connectorLength,crankRadius,closedRam,closedKnee,closedAngle:Math.max(...angles),handleEnd:world(source.handleEnd),ramLength:(source.ramTip[1]-source.ramPin[1])/source.pixelsPerUnit,period:6};
})();
export function togglePunchAtAngle(angle){
 const g=togglePunchGeometry;
 if(angle<g.closedAngle-1e-10||angle>1e-10)throw new RangeError('Outside reconstructed lever stroke');
 const pin=rotate(g.pin,angle),knee=nearest(intersections(g.top,g.upperLength,pin,g.connectorLength),g.knee);
 const square=g.lowerLength**2-(g.ram[0]-knee[0])**2;
 if(square<0)throw new RangeError('Unreachable ram');
 const ram=[g.ram[0],knee[1]-Math.sqrt(square)];
 return {angle,pin,knee,ram,handleEnd:rotate(g.handleEnd,angle),tip:[ram[0],ram[1]-g.ramLength]};
}
export function togglePunchAtTime(time){
 if(!Number.isFinite(time)||time<0)throw new RangeError('Invalid time');
 const phase=(time/togglePunchGeometry.period)%1;
 const progress=phase<.4?phase/.4:phase<.5?1:phase<.9?1-(phase-.5)/.4:0;
 const smooth=progress**3*(10+progress*(-15+6*progress));
 return togglePunchAtAngle(togglePunchGeometry.closedAngle*smooth);
}
