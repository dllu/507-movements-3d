// Generate a finite wheel by the swept volume of its matching helical cutter.
// The worm has a measured stub axial trapezoid, not a standard full-depth one.
export function generateSaddleWheel(f,{angularSteps=96,axialSteps=16,phaseSteps=640,radialSteps=64}={}) {
  const {teeth,depth,pitch,lead,distance,wheelRadius:outer,wormRoot:root,hobTip:tip,pressureAngle,tipHalfWidth,wormTip,clearance}=f;
  const toothPitch=2*Math.PI/teeth,tangent=Math.tan(pressureAngle),sweep=Math.acos((distance-tip)/outer)+toothPitch/2,step=2*sweep/phaseSteps;
  const radii=[],phases=[],wrap=x=>x-pitch*Math.floor(x/pitch+.5);
  const boundary=(theta,z,phase)=>{
    const sine=Math.sin(theta+phase),cosine=Math.cos(theta+phase);
    if(Math.abs(z)>=tip||cosine<=0)return Infinity;
    const extent=Math.sqrt(tip*tip-z*z),start=(distance-extent)/cosine,end=Math.min(outer,(distance+extent)/cosine);
    if(start>=end)return Infinity;
    const inside=radius=>{
      const x=-radius*sine,y=radius*cosine-distance,r=Math.hypot(y,z);
      if(r<root)return true;
      const angle=Math.atan2(y,-z)+Math.PI/2-teeth*phase;
      return r<=tip+1e-12&&Math.abs(wrap(x-lead*angle))<=tipHalfWidth+(wormTip-r)*tangent;
    };
    let previous=start;
    for(let k=0;k<=radialSteps;k++){
      const sample=start+(end-start)*k/radialSteps;
      if(inside(sample)){let low=previous,high=sample;for(let j=0;j<42;j++){const middle=(low+high)/2;if(inside(middle))high=middle;else low=middle;}return high;}
      previous=sample;
    }return Infinity;
  };
  for(let axial=0;axial<=axialSteps;axial++)for(let angular=0;angular<=angularSteps;angular++) {
    const z=-depth/2+depth*axial/axialSteps,theta=-toothPitch/2+toothPitch*angular/angularSteps;
    let best=outer,bestPhase;
    for(let i=0;i<=phaseSteps;i++){const phase=-sweep+step*i,r=boundary(theta,z,phase);if(r<best){best=r;bestPhase=phase;}}
    if(bestPhase!==undefined){let low=bestPhase-step,high=bestPhase+step;
      const ratio=(Math.sqrt(5)-1)/2;let a=high-ratio*(high-low),b=low+ratio*(high-low),fa=boundary(theta,z,a),fb=boundary(theta,z,b);
      for(let i=0;i<54;i++){if(fa<fb){high=b;b=a;fb=fa;a=high-ratio*(high-low);fa=boundary(theta,z,a);}else{low=a;a=b;fa=fb;b=low+ratio*(high-low);fb=boundary(theta,z,b);}}
      if(fa<best){best=fa;bestPhase=a;}if(fb<best){best=fb;bestPhase=b;}
    }
    radii.push(best-clearance);phases.push(bestPhase??0);
  }
  let seamError=0;
  for(let axial=0;axial<=axialSteps;axial++){
    const first=axial*(angularSteps+1),last=first+angularSteps;seamError=Math.max(seamError,Math.abs(radii[first]-radii[last]));radii[first]=radii[last]=Math.min(radii[first],radii[last]);
  }
  return {parameters:{teeth,depth,pitch,distance,outer,root,tip,pressureAngle,tipHalfWidth,wormTip,clearance},angularSteps,axialSteps,phaseSteps,radialSteps,seamError,radii,phases};
}
