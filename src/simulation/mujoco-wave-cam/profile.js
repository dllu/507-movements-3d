// Measured lower silhouette of the 525 px engraving. Repeat the visible front
// half on the rear: six unequal angular lobes, rather than imposing a sine wave.
export const waveCamTrace=[[188,268],[200,263],[209,242],[214,228],[222,223],[231,229],[245,254],[257,263],[269,266],[281,262],[299,239],[314,226],[333,222],[347,224],[363,239],[378,263],[395,268],[411,264],[429,248],[442,225],[451,223],[461,229],[472,251],[482,264],[494,268]];
export const waveCamGeometry=()=>({scale:.018,axisPixelX:341,outerRadius:2.754,innerRadius:.55,topY:4,rollerX:-.09,rollerY:2.326,rollerRadius:.882,rollerZ:2.754,rollerDepth:.12,pivot:[-3.114,1.39,2.90],outputPin:[-5.382,.67,2.90]});
const slopes=waveCamTrace.map((p,i,a)=>{if(i===0)return(a[1][1]-p[1])/(a[1][0]-p[0]);if(i===a.length-1)return(p[1]-a[i-1][1])/(p[0]-a[i-1][0]);const left=(p[1]-a[i-1][1])/(p[0]-a[i-1][0]),right=(a[i+1][1]-p[1])/(a[i+1][0]-p[0]);return left*right<=0?0:2*left*right/(left+right);});
export function waveCamTraceY(x){
 let i=0;while(i<waveCamTrace.length-2&&waveCamTrace[i+1][0]<x)i++;const a=waveCamTrace[i],b=waveCamTrace[i+1],width=b[0]-a[0],u=Math.max(0,Math.min(1,(x-a[0])/width));
 return(2*u**3-3*u*u+1)*a[1]+(u**3-2*u*u+u)*width*slopes[i]+(-2*u**3+3*u*u)*b[1]+(u**3-u*u)*width*slopes[i+1];
}
export function waveCamFrontAngle(angle){return((angle+Math.PI/2)%Math.PI+Math.PI)%Math.PI-Math.PI/2;}
export function waveCamRawHeight(angle,g=waveCamGeometry()){
 const phi=waveCamFrontAngle(angle),pixelX=g.axisPixelX+g.outerRadius*Math.sin(phi)/g.scale;
 return g.topY+(177-waveCamTraceY(pixelX))*g.scale;
}
export function waveCamRollerEnvelope(angle,g=waveCamGeometry()){
 const phi=waveCamFrontAngle(angle),c=Math.cos(phi);if(c<=0)return-Infinity;
 const lo=g.rollerZ-g.rollerDepth/2,hi=g.rollerZ+g.rollerDepth/2;
 const tangent=Math.tan(phi),z=Math.abs(tangent)<1e-14?lo:Math.max(lo,Math.min(hi,g.rollerX/tangent)),dx=z*tangent-g.rollerX;
 return Math.abs(dx)>g.rollerRadius?-Infinity:g.rollerY+Math.sqrt(Math.max(0,g.rollerRadius**2-dx**2));
}
// Extend the relief along angular rays beyond the roller footprint to avoid a
// discontinuous step where the footprint ends at the outer radius.
// This is an inverse geometric envelope at the engraved pose, not a prescribed
// follower trajectory. Subsequent motion must still be solved by contact.
export function waveCamHeight(angle,g=waveCamGeometry()){return Math.max(waveCamRawHeight(angle,g),waveCamRollerEnvelope(angle,g));}
