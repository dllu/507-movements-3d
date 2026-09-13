import source from './source.js';

// The tool path specifies the machined surface, not the simulated output.
export function makeBarrelCamProfile({segments=384,clearance=.0001,reversalAngle=.08}={}) {
  const e=source.edges,axis=[(e.barrelLeft+e.barrelRight)/2,(e.barrelTop+e.barrelBottom)/2];
  const x=v=>(v-axis[0])/100,y=v=>(axis[1]-v)/100;
  const radius=(e.barrelBottom-e.barrelTop)/200,left=x(e.barrelLeft),right=x(e.barrelRight),stroke=source.uniformFit.stroke/100;
  const minimum=x(source.uniformFit.minimum),d=reversalAngle,slope=stroke/(Math.PI-d),phase=source.uniformFit.phase;
  const half=a=>{
    if(a<d){const t=a/d;return[minimum+slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3)];}
    if(a>Math.PI-d){const t=(Math.PI-a)/d;return[minimum+stroke-slope*d*(t**3-t**4/2),slope*(3*t*t-2*t**3)];}
    return[minimum+slope*(a-d/2),slope];
  };
  const law=angle=>{const a=((angle+phase)%(2*Math.PI)+2*Math.PI)%(2*Math.PI),[position,velocity]=half(Math.min(a,2*Math.PI-a));return{x:position,derivative:a>Math.PI?-velocity:velocity};};
  const cutterRadius=source.uniformFit.width/200/Math.hypot(1,slope/radius),pinRadius=cutterRadius-clearance;
  const pinLow=y(243),pinHigh=radius-.04,floor=pinLow-cutterRadius-.01;
  // The groove walls are ruled along radial rays. Sweep the complete pin's
  // angular footprint: the nearest point on a ray lies at r*cos(delta),
  // at distance r*sin(delta) from the pin's lower end. The relieved floor
  // is one source pixel below that working end.
  const extent=(r,angle,side)=>{
    const limit=Math.asin(Math.min(1,cutterRadius/r));
    const at=delta=>{
      const distance2=(r*Math.sin(delta))**2;
      return side*law(angle+delta).x+Math.sqrt(Math.max(0,cutterRadius*cutterRadius-distance2));
    };
    if(limit<1e-9)return law(angle).x;
    let best=-Infinity,index=0;const count=24;
    for(let i=0;i<=count;i++){const value=at(limit*(2*i/count-1));if(value>best){best=value;index=i;}}
    let low=limit*(2*Math.max(0,index-1)/count-1),high=limit*(2*Math.min(count,index+1)/count-1);
    const ratio=(Math.sqrt(5)-1)/2;let a=high-ratio*(high-low),b=low+ratio*(high-low),fa=at(a),fb=at(b);
    for(let i=0;i<32;i++)if(fa>fb){high=b;b=a;fb=fa;a=high-ratio*(high-low);fa=at(a);}else{low=a;a=b;fa=fb;b=low+ratio*(high-low);fb=at(b);}
    return side*Math.max(best,fa,fb);
  };
  const radii=[floor,radius];
  const walls=[-1,1].map(side=>{
    const edge=Array.from({length:segments+1},(_,i)=>extent(pinLow,i===segments?0:2*Math.PI*i/segments,side));
    return radii.map(()=>edge);
  });
  return{axis,x,y,radius,left,right,stroke,minimum,slope,phase,law,segments,clearance,reversalAngle,
    cutterRadius,pinRadius,pinLow,pinHigh,floor,radii,walls,initialTip:law(0).x,
    shaftRadius:(e.shaftBottom-e.shaftTop)/200,rodHalfHeight:(e.rodBottom-e.rodTop)/200,rodY:y(source.pin.center[1]),rodHalfDepth:.06};
}
