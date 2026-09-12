// A planar section cell joins corresponding vertices of two regular polygons.
// Cross-section planes separate distinct cells; oriented closed-cell faces
// establish that each triangulated cell is embedded as well.
function planarSection({name,curvature,turn,maximumStepLength,radius,sides=24}){
  const cosine=Math.cos(turn),beta=curvature*maximumStepLength,
    planeCoefficient=cosine-radius*curvature,
    faceCoefficient=Math.cos(beta)-radius*curvature/cosine
      -Math.sin(beta)*curvature*maximumStepLength/(2*cosine*Math.cos(Math.PI/sides));
  return{name,curvature,turn,maximumStepLength,beta,planeCoefficient,faceCoefficient,
    passed:turn<Math.PI/2&&beta<Math.PI/2&&planeCoefficient>0&&faceCoefficient>0};
}

export function pumpCatchRopeSelfBounds({R,r,thetaMin,thetaMax,Dmin,Dmax,amplitudeMax,quietDmin,quietAmplitudeMax}){
  const s=Math.sin(thetaMax),c=Math.cos(thetaMax),leadMinimumSpeed=c/4,
    leadMaximumXSpeed=3*R*(1-c)+s/4,leadMaximumYSpeed=.5-c/4,
    leadMaximumSpeed=Math.hypot(leadMaximumXSpeed,leadMaximumYSpeed),
    leadMaximumAcceleration=Math.hypot(6*R*(1-c)+s,1-c),
    leadCurvature=leadMaximumAcceleration/leadMinimumSpeed**2,
    leadTurn=thetaMax+Math.atan(leadMaximumXSpeed/leadMinimumSpeed),
    bowCurvature=2*Math.PI**2*amplitudeMax/Dmin**2,bowTurn=2*Math.atan(Math.PI*amplitudeMax/Dmin),
    lead=planarSection({name:'unwound-cubic-lead',curvature:leadCurvature,turn:leadTurn,maximumStepLength:leadMaximumSpeed/64,radius:r}),
    bow=planarSection({name:'slack-bow',curvature:bowCurvature,turn:bowTurn,
      maximumStepLength:Math.hypot(Dmax,Math.PI*amplitudeMax)/512,radius:r}),
    quietBow=planarSection({name:'raised-quiet-bow',curvature:2*Math.PI**2*quietAmplitudeMax/quietDmin**2,
      turn:2*Math.atan(Math.PI*quietAmplitudeMax/quietDmin),maximumStepLength:Math.hypot(Dmax,Math.PI*quietAmplitudeMax)/512,radius:r}),
    winding={arcMaximum:-thetaMin,planeCoefficient:R-r,faceCoefficient:Math.cos(.003/2)*(1-r/R),
      passed:thetaMin>-Math.PI&&R>r},
    joins={minimumLeadEndAboveCut:.85-.25-R*s,tailLength:.2,
      passed:.85-.25-R*s>0};
  return{passed:thetaMax>=0&&thetaMax<Math.PI/2&&Dmin>0&&Dmax>=Dmin&&amplitudeMax>=0&&quietDmin>0&&lead.passed&&bow.passed&&quietBow.passed&&winding.passed&&joins.passed,
    lead,bow,quietBow,winding,joins,
    argument:[
      'For any later section, its center projects at least cos(total tangent turn) times intervening arc length along the earlier tangent. Its disk offset projects at most radius times maximum curvature times that length. Positive planeCoefficient therefore puts all later rings strictly beyond every earlier section plane.',
      'In chord coordinates, side-triangle determinants divided by radius squared times chord length times sin(section angle) are bounded below by faceCoefficient. The cap determinants have positive cos(beta). Closed cell surfaces keep their outward orientation and degree one under continuous straightening, excluding local folding.',
      'Circular winding rings satisfy the same plane separation directly: (R-radius)*sin(angle difference)>0 for an arc below pi. Their face coefficient is cos(half step)*(1-radius/R).',
      'The winding, lead, upper straight, bow and final straight meet at horizontal normal-section planes. Each complete piece stays on its own side of each join; the unwound lead terminates above the bow cut.',
    ],
    qualification:'These bounds concern the exact coordinates used to construct the planar, untwisted polygonal tube. A separate measured Float32 coordinate bound covers rounding, including arbitrarily short winding cells near the wrap transition. They do not establish finite rope stress or a slack equilibrium.'};
}
