const weights=Array.from({length:257},(_,i)=>(i===0||i===256?1:i%2?4:2)/768),
  sine=weights.map((_,i)=>Math.sin(2*Math.PI*i/256));

// Bound the actual polygonal display tube between two linear pose intervals.
// Bow and lead sections have fixed connectivity. Only the winding arc changes
// its section count, so it additionally needs a mesh interpolation allowance.
export function makePumpCatchRopeDisplacement({R,r=.0625,thetaMax=.25,Dmax=4,arcStep=.003,sides=24}){
  if(!(R>r&&r>0&&thetaMax>0&&thetaMax<=.25&&Dmax>0))throw Error('Outside rope displacement domain');
  const minimumSpeed=.25*Math.cos(thetaMax),derivativeBound=.25+3*R*Math.sin(thetaMax),
    curvatureBound=R*Math.sin(thetaMax)+derivativeBound**2/minimumSpeed+3*R+.25,
    leadCoefficient=R+1/12+r*derivativeBound/minimumSpeed,
    extraGuard=4e-12,amplitudeGuard=1e-12,
    // For A <= 1, rationalizing each quadrature term gives E(A,D) >= K*A².
    quietCoefficient=Math.PI**2*(.5-1e-12)/(Math.hypot(Dmax,Math.PI)+Dmax),
    arcInterpolation=(R+r)*arcStep**2/8+r*arcStep*2*Math.sin(Math.PI/sides)/4,
    wrapSwitch=(R+r+leadCoefficient)*1e-7,vertexRounding=Math.sqrt(3)*2**-22,
    meshAllowance=2*(arcInterpolation+wrapSwitch+vertexRounding);
  function extra(A,D){
    let sum=0;for(let i=0;i<weights.length;i++){
      const c=A*Math.PI*sine[i];sum+=weights[i]*c*c/(Math.hypot(D,c)+D);
    }return sum;
  }
  function g(theta){
    if(theta<=0)return R*theta;
    const s=Math.sin(theta),c=Math.cos(theta);let lead=0;
    for(let i=0;i<weights.length;i++){
      const t=i/256,v=1-t,x=v*v*.25*s+2*v*t*(3*R*(c-1)-s/4),
        y=-v*v*.25*c+2*v*t*(-.5+c/4)-t*t*.25;
      lead+=weights[i]*Math.hypot(x,y);
    }return R*s+.25-lead;
  }
  const slack=q=>q[2]+g(q[0]);
  function amplitude(S,D){
    if(S<=0)return 0;
    if(S>=extra(1,D))throw Error('Amplitude exceeds proved unit bound');
    let lo=0,hi=1;
    for(let i=0;i<44;i++){const mid=(lo+hi)/2;if(extra(mid,D)>S)hi=mid;else lo=mid;}
    return(lo+hi)/2;
  }
  function envelope(a,b){
    if(a.length!==3||b.length!==3||![...a,...b].every(Number.isFinite))throw Error('Invalid pose coordinates');
    if(Math.min(a[0],b[0])<=-Math.PI||Math.max(a[0],b[0])>thetaMax||Math.min(a[2],b[2])< -1e-10)throw Error('Unqualified pose domain');
    const D=[3.7-Math.max(a[2],b[2])-1e-12,3.7-Math.min(a[2],b[2])+1e-12];
    if(!(D[0]>0&&D[1]<=Dmax))throw Error('Unqualified bow span');
    // g is linear on the wrapped side. On the unwound side, differentiating
    // the positive-weight lead quadrature bounds |g''| by curvatureBound.
    // The first derivative agrees at zero, so the same interpolation bound
    // holds across zero. Small wrap suppression and arithmetic enter guards.
    const sa=slack(a),sb=slack(b),bend=Math.max(a[0],b[0])<=0?0:curvatureBound*(b[0]-a[0])**2/8,
      S=[Math.min(sa,sb)-bend-extraGuard,Math.max(sa,sb)+bend+extraGuard];
    if(S[1]>=extra(1,Dmax))throw Error('Interval exceeds proved unit amplitude');
    const quiet=S[1]<=1e-8;let A;
    if(quiet){
      // The global quadratic bound first limits A. Substituting that smaller
      // amplitude into the rationalized denominator sharpens the upper bound.
      // sqrt(D²+c²)-D <= c²/(2D) independently supplies a positive lower bound.
      const initialUpper=Math.sqrt(Math.max(0,S[1])/quietCoefficient)+amplitudeGuard,
        localCoefficient=Math.PI**2*(.5-1e-12)/(Math.hypot(D[1],Math.PI*initialUpper)+D[1]);
      A=[S[0]<=1e-12?0:Math.max(0,Math.sqrt(2*D[0]*S[0]/(Math.PI**2*(.5+1e-12)))-amplitudeGuard),
        Math.sqrt(Math.max(0,S[1])/localCoefficient)+amplitudeGuard];
    }else A=[S[0]<=1e-12?0:Math.max(0,amplitude(S[0],D[0])-amplitudeGuard),amplitude(S[1],D[1])+amplitudeGuard];
    return{D,S,A,quiet};
  }
  function interval(a0,a1,b0,b1){
    const a=envelope(a0,a1),b=envelope(b0,b1),
      dy=Math.max(Math.abs(a0[2]-b0[2]),Math.abs(a1[2]-b1[2]))+1e-12,
      dtheta=Math.max(Math.abs(a0[0]-b0[0]),Math.abs(a1[0]-b1[0]))+1e-12,
      dA=Math.max(a.A[1]-b.A[0],b.A[1]-a.A[0]),
      ratio=Math.max(a.A[1]/a.D[0]-b.A[0]/b.D[1],b.A[1]/b.D[0]-a.A[0]/a.D[1]),
      bow=Math.hypot(dy,dA)+r*Math.PI*ratio,upper=Math.max(leadCoefficient,R+r)*dtheta,
      displacement=Math.max(bow,upper,dy)+meshAllowance;
    return{displacement,bow,upper,dy,dtheta,dA,ratio,a,b};
  }
  return{interval,envelope,slack,extra,amplitude,parameters:{R,r,thetaMax,Dmax,arcStep,sides,minimumSpeed,derivativeBound,
    curvatureBound,leadCoefficient,extraGuard,amplitudeGuard,quietCoefficient,arcInterpolation,wrapSwitch,vertexRounding,meshAllowance},
    argument:[
      'On a linear pose interval S=y+g(theta). Wrapped g=R*theta. Unwound g=R*sin(theta)+0.25 minus the positive-weight lead-length quadrature. Bernstein derivative bounds give |g second derivative| <= curvatureBound, so endpoint slack bounds expanded by curvatureBound*deltaTheta²/8 cover the entire interval.',
      'The positive-weight bow extra-length sum increases with amplitude and decreases with D. Its two endpoint solves therefore bound every amplitude in the slack/D box. Small slack uses a rationalized quadratic lower bound on extra length. Guards cover quadrature arithmetic, its zero-slack switch and finite bisection.',
      'Every corresponding bow vertex differs by at most hypot(height difference, amplitude difference) plus r*pi*abs(A/D-B/D). The normal-frame bound follows from atan being 1-Lipschitz. Identical bow and lead triangle connectivity extends vertex bounds to all triangle interiors; caps and end straights share these bounds.',
      'Different winding section counts are compared through a common arc/polygon parameterization. Arc interpolation contributes (R+r)*step²/8; triangulation of a ruled polygon cell adds at most r*step*2*sin(pi/sides)/4. Two meshes receive this allowance. Suppressed sub-1e-7 arcs and Float32 vertex rounding are separately included.',
    ]};
}
