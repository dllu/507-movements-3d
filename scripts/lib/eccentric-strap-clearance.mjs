import {THREE} from '../../src/simulation/eccentric-strap.js';
import {nativePlateContours} from './weighted-clutch-native-contours.mjs';

// Conservative bounds for the full continuous motion, using the native
// polygon contours. A sample is expanded by maximum material-point travel
// before clipping to the guide's x range, then expanded in y as well.
export function eccentricStrapClearance(model, steps=512) {
  const u=model.root.userData,g=u.geometry,b=u.blocks,d=u.joints.dimensions;
  model.update(0);
  const rod=b.eccentricRod, contours=nativePlateContours(rod.geometry);
  let maximumRodRadius=0,maximumForkX=-Infinity,maximumOtherStrapRadius=0;
  const angles=[Math.asin((g.sliderY-g.eccentricity)/g.eccentricRodLength)-g.rodLocalAngle,
    Math.asin((g.sliderY+g.eccentricity)/g.eccentricRodLength)-g.rodLocalAngle];
  const point=new THREE.Vector3();
  for(const ring of contours)for(const [x,y]of ring) {
    maximumRodRadius=Math.max(maximumRodRadius,Math.hypot(x,y));
    const dx=x-g.rodX,dy=y-g.rodY,candidates=[...angles],stationary=-Math.atan2(dy,dx);
    for(let k=-1;k<=1;k++){const angle=stationary+k*2*Math.PI;if(angle>=angles[0]&&angle<=angles[1])candidates.push(angle);}
    for(const angle of candidates)maximumForkX=Math.max(maximumForkX,dx*Math.cos(angle)-dy*Math.sin(angle));
  }
  for(const [name,part]of Object.entries(u.parts))if(u.families[name]==='strap'&&part!==rod) {
    const positions=part.geometry.attributes.position;
    for(let i=0;i<positions.count;i++) {
      point.fromBufferAttribute(positions,i).applyMatrix4(part.matrixWorld);b.strap.worldToLocal(point);
      maximumOtherStrapRadius=Math.max(maximumOtherStrapRadius,Math.hypot(point.x,point.y));
    }
  }
  const horizontalMinimum=Math.sqrt(g.eccentricRodLength**2-(g.eccentricity+Math.abs(g.sliderY))**2);
  const maximumPointSpeed=g.eccentricity*g.inputSpeedMagnitude*(1+maximumRodRadius/horizontalMinimum);
  const padding=maximumPointSpeed*g.cyclePeriod/(2*steps)+1e-6;
  const boundary=g.guideMinimumX-padding;
  let sampledHeight=0;
  for(let i=0;i<=steps;i++) {
    model.update(g.cyclePeriod*i/steps);
    for(const ring of contours) {
      const points=ring.map(([x,y])=>rod.localToWorld(new THREE.Vector3(x,y,0)));
      for(let j=0;j<points.length;j++) {
        const a=points[j],z=points[(j+1)%points.length];
        if(a.x>=boundary)sampledHeight=Math.max(sampledHeight,Math.abs(a.y-g.sliderY));
        if((a.x<boundary)!==(z.x<boundary)) {
          const y=a.y+(z.y-a.y)*(boundary-a.x)/(z.x-a.x);
          sampledHeight=Math.max(sampledHeight,Math.abs(y-g.sliderY));
        }
      }
    }
  }
  const rodHeightBound=sampledHeight+padding;
  const checks={
    rodToGuideBase:d.crossheadHalfHeight+d.guideClearance-rodHeightBound,
    rodToGuideLips:d.forkOuterZ+d.guideClearance-d.eyeHalfDepth,
    rodToForkCheeks:d.forkInnerZ-d.eyeHalfDepth,
    rodToForkBridge:.27-maximumForkX,
    otherStrapToGuides:g.guideMinimumX-g.eccentricity-maximumOtherStrapRadius,
    bearingRadial:g.linerInnerRadius*Math.cos(Math.PI/256)-g.sheaveRadius,
    wristRadial:d.wristBoreRadius*Math.cos(Math.PI/128)-d.pinRadius,
    clampBoltRadial:.057*Math.cos(Math.PI/256)-.055,
    flangeBoltRadial:d.flangeBoreRadius*Math.cos(Math.PI/128)-d.flangeBoltRadius,
    shaftSupportRadial:(g.shaftRadius+.002)*Math.cos(Math.PI/256)-g.shaftRadius,
    retainingFlangesAxial:.22-g.strapHalfDepth,
    rearSupportToStrapAxial:.44-.28,
    baseToStrapAxial:.40-.28,
    crossheadToGuideBase:d.guideClearance,
    crossheadToGuideLips:d.guideClearance,
    pinHeadsToGuideLips:.28-.185,
    stemToGuideLips:.28-.115,
    crossheadMinimumGuideEnd:g.outputMinimumX-.30-g.guideMinimumX,
    crossheadMaximumGuideEnd:g.guideMaximumX-g.outputMaximumX-.42,
    inputToCrosshead:g.outputMinimumX-.30-(g.eccentricity+g.flangeRadius),
    inputToGuides:g.guideMinimumX-(g.eccentricity+g.flangeRadius),
    collarWithinStrap:g.linerInnerRadius*Math.cos(Math.PI/256)-g.eccentricity-u.source.collarRadius/100,
    shaftWithinStrap:g.linerInnerRadius*Math.cos(Math.PI/256)-g.eccentricity-g.shaftRadius,
  };
  return {steps,maximumPointSpeed,padding,sampledHeight,rodHeightBound,maximumForkX,maximumOtherStrapRadius,
    checks,minimumClearance:Math.min(...Object.values(checks)),passed:Object.values(checks).every(x=>x>1e-4)};
}
