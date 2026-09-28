import {Vector2} from 'three';
// Landmarks in the original 525px engraving: gear centre, the pin on the
// oblong's top, the long lever's fixed right-hand pivot and the short arm's
// eye. The oblong is a groove (Brown draws it as a band with a centre line)
// carried on the large gear's face; the pin at the long lever's end runs in
// it. As the gear turns, the pin slides all the way round the groove while
// the lever rocks about its pivot. Pass 96: the short arm from the pin to
// the eye is a link, and the eye is the pin of a crank pivoted on the large
// gear's own axle (Brown: "alternate circular motion of the crank attached
// to the larger gear"), so the rocking lever swings that crank to and fro.
export const gearedCrankSource={scale:.028,center:[263,288],pin:[247,228],eye:[212,264],pivot:[469,258],period:8,
 // Groove centre line: radial Fourier fit (pixels, about the gear centre,
 // y up) to the mid-line of the traced oblong band; 0.88 px RMS.
 groove:[86.64226,9.06101,-10.46124,25.19027,-6.15517,4.35106,-6.8773,0.32228,-1.77662]};
const g=gearedCrankSource;
export const sourcePoint=p=>new Vector2((p[0]-g.center[0])*g.scale,(g.center[1]-p[1])*g.scale);
const tracedRadius=a=>{
 const c=g.groove;let r=c[0];
 for(let k=1;2*k<c.length;k++)r+=c[2*k-1]*Math.cos(k*a)+c[2*k]*Math.sin(k*a);
 return r;
};
// Brown keeps the grooved band inside the gear's rim. The traced mid-line's
// lower-right lobe reaches 133 px, which would carry the band's outer wall
// over the toothed rim (inner edge 130 px) as the gear turns. Beyond a 90 px
// knee the radius is eased down (C1, monotone) so the lobe tops out at 115 px
// and the 9.5 px band half-width stays well inside the rim; the pin's drawn position
// (62 px) and the inner run of the groove are untouched.
const grooveKnee=90,grooveCrest=115;
const tracedCrest=Math.max(...Array.from({length:4096},(_,i)=>tracedRadius(2*Math.PI*i/4096)));
const grooveEase=(tracedCrest-grooveCrest)/((tracedCrest-grooveKnee)**2);
/** Groove centre-line radius (world units) at gear-frame polar angle a. */
export function grooveRadius(a){
 const r=tracedRadius(a),over=Math.max(0,r-grooveKnee);
 return (r-grooveEase*over*over)*g.scale;
}
export function groovePoint(a){const r=grooveRadius(a);return new Vector2(r*Math.cos(a),r*Math.sin(a));}
const pin0=sourcePoint(g.pin),pivot=sourcePoint(g.pivot),eye0=sourcePoint(g.eye);
const leverRadius=pin0.distanceTo(pivot),leverBase=Math.atan2(pin0.y-pivot.y,pin0.x-pivot.x);
// Brown's link (1.41) and crank (1.58) are too short to follow the pin to
// the outer end of its swing (3.22 from the axle); both are made 1.75, which
// puts the eye 10 px left of and below where he draws it.
export const gearedCrankLengths={lever:leverRadius,arm:1.75,ground:pivot.length(),crank:1.75};
// The crank's eye: on the circle of the crank's radius about the gear axle,
// at the link's length from the lever pin, on the drawn side of the line
// from the axle to the pin.
const eyeSide=Math.sign(pin0.x*eye0.y-pin0.y*eye0.x);
function crankEyeAt(pin){
 const c=gearedCrankLengths.crank,l=gearedCrankLengths.arm,d=pin.length(),a=(c*c-l*l+d*d)/(2*d),h2=c*c-a*a;
 if(!(h2>0))throw new Error('Movement 148 crank link reaches a dead point');
 const u=pin.clone().multiplyScalar(1/d),n=new Vector2(-u.y,u.x).multiplyScalar(eyeSide*Math.sqrt(h2));
 return u.multiplyScalar(a).add(n);
}
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
export const crankEye0=crankEyeAt(pin0);
export function gearedCrankLever(rotation){
 let a=lowPhi,b=highPhi;const fa=grooveGap(a,rotation),fb=grooveGap(b,rotation);
 if(!(fa<0&&fb>0))throw new Error('Movement 148 lever pin leaves its groove');
 for(let i=0;i<60;i++){const m=(a+b)/2;if(grooveGap(m,rotation)<0)a=m;else b=m;}
 return (a+b)/2;
}
export function gearedCrankState(time){
 const rotation=-2*Math.PI*time/g.period,leverAngle=gearedCrankLever(rotation),pin=pinAt(leverAngle);
 const local=pin.clone().rotateAround(new Vector2(),-rotation);
 const eye=crankEyeAt(pin);
 return {time,theta:rotation,rotation,leverAngle,pin,pivot:pivot.clone(),grooveAngle:Math.atan2(local.y,local.x),
  eye,crankAngle:Math.atan2(eye.y,eye.x)-Math.atan2(crankEye0.y,crankEye0.x)};
}
