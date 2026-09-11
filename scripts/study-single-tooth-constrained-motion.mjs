import { writeFile } from 'node:fs/promises';
import { makeSingleToothSourceDriver } from './lib/single-tooth-source-driver.mjs';
import { makeSingleToothStarSolid } from './lib/single-tooth-star-solid.mjs';

// Independent diagnostic: constrain the traced finite tooth against a simple
// engraving-proportioned U notch and circular locking hollows. No animation
// law is imposed on the output. A positive resisting load chooses the smallest
// forward rotation that clears the driver at each step. This projection is
// quasistatic; jumps or missing advance reject a trial, not an inertial solver.
const upperReliefExtension=Number(process.env.UPPER_RELIEF_EXTENSION??0);
const clipReliefToRim=process.env.CLIP_RELIEF==='1';
const upperReliefMode=process.env.UPPER_RELIEF_MODE??'endpoint';
const driver=makeSingleToothSourceDriver({curveSteps:128,circleSteps:4096,upperReliefExtension,clipReliefToRim,upperReliefMode})[0];
const turn=2*Math.PI,n=10,pitch=turn/n,half=pitch/2;
const D=Number(process.env.CENTER_DISTANCE??2.72),R=1.36,Rout=1.417;
const slotRadius=Number(process.env.SLOT_RADIUS??.1),slotCenter=Number(process.env.SLOT_CENTER??1.337);
const suffix=process.env.STUDY_SUFFIX??'constrained-motion';
const slotAngles=Array.from({length:n},(_,i)=>Math.PI+i*pitch);
const slots=slotAngles.map(a=>[Math.cos(a),Math.sin(a)]);
const locks=slotAngles.map(a=>[D*Math.cos(a+half),D*Math.sin(a+half)]);
const checkOutputCorners=process.env.CHECK_OUTPUT_CORNERS==='1';
const inputSolid=checkOutputCorners?makeSingleToothStarSolid(driver):null;
const corners=[];
if(checkOutputCorners)for(const a of slotAngles) {
  const alpha=Math.acos((D*D+Rout*Rout-(R+.00015)**2)/(2*D*Rout));
  for(const sign of [-1,1]) {
    const t=a+half+sign*alpha;corners.push([Rout*Math.cos(t),Rout*Math.sin(t)]);
    const x=Math.sqrt(Rout*Rout-slotRadius*slotRadius),y=sign*slotRadius;
    corners.push([x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)]);
  }
}
const penetrate=(point,q)=>{
  const x=point[0]*Math.cos(q)+point[1]*Math.sin(q),y=-point[0]*Math.sin(q)+point[1]*Math.cos(q);
  let depth=Rout-Math.hypot(x,y);
  if(depth<=0)return depth;
  for(let i=0;i<n;i++) {
    const [cx,cy]=locks[i];depth=Math.min(depth,Math.hypot(x-cx,y-cy)-R-.00015);
    if(depth<=0)return depth;
    const [ux,uy]=slots[i],along=x*ux+y*uy,across=-x*uy+y*ux;
    depth=Math.min(depth,Math.hypot(Math.max(0,slotCenter-along),across)-slotRadius);
    if(depth<=0)return depth;
  }
  return depth;
};
const lockSeat=Math.acos((D*D+Rout*Rout-(R+.00015)**2)/(2*D*Rout))
  -Math.acos((D*D+Rout*Rout-R*R)/(2*D*Rout));
const initialQ=-half-(process.env.SEATED_START==='1'?lockSeat:0);
const phaseSteps=Number(process.env.PHASE_STEPS??1600),timeStep=1.6/phaseSteps;
let q=initialQ;
const rows=[],failed=[];
for(let i=0;i<=phaseSteps;i++){
  const angle=.8-1.6*i/phaseSteps,c=Math.cos(angle),s=Math.sin(angle);
  const active=driver.map(([x,y])=>[x*c-y*s-D,x*s+y*c]).filter(v=>Math.hypot(...v)<Rout+1e-5);
  const intrusion=out=>{
    let worst=active.reduce((maximum,v)=>Math.max(maximum,penetrate(v,out)),0);
    if(checkOutputCorners)for(const [x,y] of corners) {
      const wx=D+x*Math.cos(out)-y*Math.sin(out),wy=x*Math.sin(out)+y*Math.cos(out);
      worst=Math.max(worst,inputSolid.penetration([wx*c+wy*s,-wx*s+wy*c]));
    }
    return worst;
  };
  const previous=q,initial=intrusion(q);
  if(initial>1e-7){
    // The field is Rout-Lipschitz in q. Prune an interval only when this
    // bound proves penetration throughout it, then search left before right.
    // Unlike a fixed angle grid this retains arbitrarily narrow free windows.
    let evaluations=0,pruned=0,unresolved=0,minimum=Infinity,bestAngle=q;
    const firstAllowed=(low,high)=>{
      const mid=(low+high)/2,depth=intrusion(mid);evaluations++;
      if(depth<minimum){minimum=depth;bestAngle=mid;}
      if(depth-Rout*(high-low)/2>1e-7){pruned++;return null;}
      if(high-low<1e-10){
        for(const at of [low,mid,high])if(intrusion(at)<=1e-7)return at;
        unresolved++;return null;
      }
      return firstAllowed(low,mid)??firstAllowed(mid,high);
    };
    const free=firstAllowed(q,half+.02);
    if(free===null){failed.push({i,angle,q,initial,minimumSampledPenetration:minimum,bestAngle,
      evaluations,pruned,unresolved,angularTolerance:1e-10,lipschitzBound:Rout,
      reason:unresolved?'No permitted pose found; some threshold intervals remain unresolved':
        'Every forward angle interval before the next lock has a positive penetration lower bound'});break;}
    q=free;
  }
  rows.push({angle,q,advance:q-previous,speed:i?(q-previous)/timeStep:0,initialPenetration:initial,remainingPenetration:intrusion(q)});
}
const report={movement:68,status:'quasistatic-geometry-diagnosis',productionChanged:false,
  parameters:{notches:n,pitch,centerDistance:D,driverRadius:R,outputRadius:Rout,slotRadius,slotCenter,upperReliefExtension,clipReliefToRim,upperReliefMode,initialQ,lockSeat,phaseSteps,checkOutputCorners,outputCorners:corners.length},
  method:checkOutputCorners?
    'Forward-only quasistatic projection using dense traced driver polygon points against independent implicit circle/U-notch solids, plus forty exact output mouth/locking corners against the driver polygon signed distance. Angular interval pruning uses a conservative Euclidean Lipschitz bound. Full bidirectional triangle collision, finite forces, inertia and continuous-time convergence remain separate requirements.':
    'Forward-only quasistatic projection using dense actual traced driver boundary points and independent implicit circle/U-notch solids. Full bidirectional triangle collision, finite force, inertial events and continuous-time convergence remain unverified.',
  samples:driver.length,poses:rows.length,expectedAdvance:pitch,actualAdvance:q-initialQ,
  maximumStep:Math.max(...rows.map(r=>r.advance)),maximumSpeed:Math.max(...rows.map(r=>r.speed)),failed,rows};
await writeFile(`artifacts/review/068-${suffix}.json`,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log({poses:rows.length,actualAdvance:report.actualAdvance,expectedAdvance:pitch,maximumStep:report.maximumStep,maximumSpeed:report.maximumSpeed,failed});
