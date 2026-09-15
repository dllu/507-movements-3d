import {waveCamGeometry,waveCamTraceY} from './profile.js';

// The engraving constrains the projection of the whole solid, not just its
// outer front rim. A profile cut across X preserves that outline at every depth.
// The unpictured rear therefore mirrors the front at the same projected X.
export function waveCamProjectedHeight(x,g=waveCamGeometry()){
 const raw=g.topY+(177-waveCamTraceY(g.axisPixelX+x/g.scale))*g.scale;
 const dx=x-g.rollerX;
 const roller=Math.abs(dx)<g.rollerRadius?g.rollerY+Math.sqrt(g.rollerRadius**2-dx**2):-Infinity;
 // Any removed material is behind the source roller in the front projection.
 return Math.max(raw,roller);
}
