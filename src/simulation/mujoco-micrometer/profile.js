import source from './source.js';
export function makeMicrometerProfile({segments=128,clearance=.001,turns=3}={}) {
 if(!Number.isInteger(segments)||segments<32||!Number.isFinite(clearance)||clearance<=0||clearance>.005||!Number.isFinite(turns)||turns<=0||turns>3)throw new RangeError('Invalid micrometer profile');
 const e=source.edges,axis=[(e.outerCoreLeft+e.outerCoreRight+e.innerCoreLeft+e.innerCoreRight)/4,e.outerBottom],y=p=>(axis[1]-p)/100;
 const pitchOuter=source.threads.outer[1]/100,pitchInner=source.threads.inner[1]/100,leadOuter=pitchOuter/(2*Math.PI),leadInner=pitchInner/(2*Math.PI);
 const innerCrest=(e.innerCrestRight-e.innerCrestLeft)/200,innerCore=Math.max((e.innerCoreRight-e.innerCoreLeft)/200,.6*innerCrest),outerCrest=(e.outerCrestRight-e.outerCrestLeft)/200;
 // The depicted outer root is too small for the inner thread and a wall.
 const bore=innerCrest+clearance,outerCore=Math.max((e.outerCoreRight-e.outerCoreLeft)/200,bore+.025),top=y(e.outerTop),ceiling=top-.12;
 const innerLow=y(e.innerBottom-7),innerHigh=ceiling-.10,widthOuter=pitchOuter/2,widthInner=pitchInner/2;
 // p109: square threads with land equal to groove (half the pitch) on an inner
 // core of at least 0.6 of its crest diameter (Brown's thin bands, 0.41 and
 // 0.45 p, read as coil springs). Each exposed thread ends in a full radial
 // face flush inside its sleeve or screw end, not a wedge run-out fin.
 // The measured band centre lines are kept.
 const phase=(name,lead)=>y(source.threads[name][0]+source.threads[name][3]/2)+lead*Math.PI/2;
 const outer={inner:outerCore,outer:outerCrest,low:0,high:top-.06,width:widthOuter,lead:leadOuter,phase:phase('outer',leadOuter),squareEnds:true};
 // Same-hand helices give z_inner = (lead_outer - lead_inner) * angle.
 // Brown's opposite inner slope would instead add the two advances.
 const inner={inner:innerCore,outer:innerCrest,low:innerLow,high:innerHigh,width:widthInner,lead:leadInner,phase:phase('inner',leadInner),squareEnds:true};
 const internal={...inner,squareEnds:false,inner:innerCore+clearance,outer:bore,low:0,high:ceiling,width:pitchInner-widthInner-2*clearance,phase:inner.phase+pitchInner/2};
 return {source,axis,y,segments,clearance,turns,pitchOuter,pitchInner,leadOuter,leadInner,difference:leadOuter-leadInner,outerCore,outerCrest,innerCore,innerCrest,bore,top,ceiling,innerLow,innerHigh,tipLow:y(e.innerBottom),outer,inner,internal};
}
