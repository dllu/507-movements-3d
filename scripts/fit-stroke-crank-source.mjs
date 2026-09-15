import fs from 'node:fs';
// Fixed shaft and guide follow the engraving. The finite shoe must clear the
// source slot's upper semicircle; L = g + r is enforced, never fitted away.
const center=[199,235],guideX=354,crank=[246,296],slider=[354,419],slot={top:48,bottom:442,radius:10},shoe={halfWidth:6.25,halfHeight:5};
const maximumStroke=Math.min(center[1]-slot.top,slot.bottom-center[1])+Math.sqrt(slot.radius**2-shoe.halfWidth**2)-shoe.halfHeight-1;
const g=guideX-center[0],maximumRadius=(-g+Math.sqrt(g*g+maximumStroke**2))/2;
const residual=(r,a)=>{const p=[center[0]+r*Math.cos(a),center[1]+r*Math.sin(a)],y=p[1]+Math.sqrt((g+r)**2-(guideX-p[0])**2);return{p,slider:[guideX,y],error:(p[0]-crank[0])**2+(p[1]-crank[1])**2+(y-slider[1])**2};};
let best={error:Infinity};for(let i=0;i<=1000;i++){const r=maximumRadius*i/1000;for(let j=1;j<900;j++){const angle=Math.PI*j/1800,s=residual(r,angle);if(s.error<best.error)best={...s,radius:r,angle};}}
const report={movement:175,status:'constrained-engraving-fit',center,guideX,slot,shoe,maximumStroke,maximumRadius,solution:best,errors:{crank:Math.hypot(best.p[0]-crank[0],best.p[1]-crank[1]),slider:Math.abs(best.slider[1]-slider[1])},method:'Grid minimum of squared initial pin errors with shaft and guide fixed, rigid tangent-transfer closure, and full-stroke finite shoe clearance in the engraved slot. One-pixel end margin. This cannot preserve the inconsistent engraved crank radius.'};
fs.writeFileSync('docs/validation/175-constrained-fit.json',JSON.stringify(report,null,2)+'\n');console.log(report);
