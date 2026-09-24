import {Vector2} from 'three';
// Landmarks in the original 525px engraving: gear centre, the pin on the
// oblong's top, the long lever's fixed right-hand pivot and the short arm's
// eye. The oblong is a groove (Brown draws it as a band with a centre line)
// carried on the large gear's face; the pin at the long lever's end runs in
// it. As the gear turns, the pin slides all the way round the groove while
// the lever rocks about its pivot: "alternate circular motion".
export const gearedCrankSource={scale:.028,center:[263,288],pin:[247,228],eye:[212,264],pivot:[469,258],period:8,
 // Groove centre line: radial Fourier fit (pixels, about the gear centre,
 // y up) to the mid-line of the traced oblong band; 0.88 px RMS.
 groove:[86.64226,9.06101,-10.46124,25.19027,-6.15517,4.35106,-6.8773,0.32228,-1.77662]};
const g=gearedCrankSource;
export const sourcePoint=p=>new Vector2((p[0]-g.center[0])*g.scale,(g.center[1]-p[1])*g.scale);
/** Groove centre-line radius (world units) at gear-frame polar angle a. */
export function grooveRadius(a){
 const c=g.groove;let r=c[0];
 for(let k=1;2*k<c.length;k++)r+=c[2*k-1]*Math.cos(k*a)+c[2*k]*Math.sin(k*a);
 return r*g.scale;
}
export function groovePoint(a){const r=grooveRadius(a);return new Vector2(r*Math.cos(a),r*Math.sin(a));}
const pin0=sourcePoint(g.pin),pivot=sourcePoint(g.pivot),eye0=sourcePoint(g.eye);
const leverRadius=pin0.distanceTo(pivot),leverBase=Math.atan2(pin0.y-pivot.y,pin0.x-pivot.x);
export const gearedCrankLengths={lever:leverRadius,arm:pin0.distanceTo(eye0),ground:pivot.length()};
const pinAt=phi=>new Vector2(pivot.x+leverRadius*Math.cos(leverBase+phi),pivot.y+leverRadius*Math.sin(leverBase+phi));
// Signed radial distance of the lever pin from the groove centre line, with
// the pin expressed in the rotating gear's frame.
const grooveGap=(phi,rotation)=>{const p=pinAt(phi).rotateAround(new Vector2(),-rotation);return p.length()-grooveRadius(Math.atan2(p.y,p.x));};
// The lever arc runs nearly radially up from the hub, so it crosses the
// star-shaped groove once on the upper side. Bracket that crossing between
// the hub and the gear rim, then bisect.
// lowPhi: pin level with the hub, inside the loop; highPhi: pin beyond the
// groove's largest radius, just inside the rim.
const lowPhi=Math.PI-leverBase,highPhi=Math.PI-Math.asin(.51)-leverBase;
export function gearedCrankLever(rotation){
 let a=lowPhi,b=highPhi;const fa=grooveGap(a,rotation),fb=grooveGap(b,rotation);
 if(!(fa<0&&fb>0))throw new Error('Movement 148 lever pin leaves its groove');
 for(let i=0;i<60;i++){const m=(a+b)/2;if(grooveGap(m,rotation)<0)a=m;else b=m;}
 return (a+b)/2;
}
export function gearedCrankState(time){
 const rotation=-2*Math.PI*time/g.period,leverAngle=gearedCrankLever(rotation),pin=pinAt(leverAngle);
 const local=pin.clone().rotateAround(new Vector2(),-rotation);
 return {time,theta:rotation,rotation,leverAngle,pin,pivot:pivot.clone(),grooveAngle:Math.atan2(local.y,local.x),
  eye:eye0.clone().sub(pivot).rotateAround(new Vector2(),leverAngle).add(pivot)};
}
