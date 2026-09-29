import source from './source.js';
export function makeLeadscrewSlideProfile({segments=256,contactSegments=128,clearance=.001}={}) {
  const e=source.edges,world=p=>[(p[0]-source.axis[0])/100,(source.axis[1]-p[1])/100],x=p=>world([p,0])[0],y=p=>world([0,p])[1];
  const pitch=source.thread[2]/100,lead=pitch/(2*Math.PI);
  // p109: a square thread with land equal to groove (half the pitch). Brown's
  // drawn band (0.27 p) read as a coil spring round a rod. Its measured
  // centre line is kept.
  const drawnWidth=source.thread[3]/100,width=pitch/2;
  const coreRadius=(e.coreBottom-e.coreTop)/200,crestRadius=(e.crestBottom-e.crestTop)/200;
  const phase=x(source.thread[0]+source.thread[1]*(source.axis[1]-231))-lead*Math.PI+drawnWidth/2;
  const carriageBase=x((e.neckLeft+e.neckRight)/2),neckHalf=(e.neckRight-e.neckLeft)/200;
  const external={inner:coreRadius,outer:crestRadius,low:x(source.threadRange[0]),high:x(source.threadRange[1]),width,lead,phase};
  const internal={inner:coreRadius+clearance,outer:crestRadius+clearance,low:-neckHalf,high:neckHalf,width:pitch-width-2*clearance,lead,phase:phase+pitch/2-carriageBase};
  const footBottom=y(e.footBottom),railTop=footBottom-.002,railBottom=y(e.railBottom);
  return {world,x,y,segments,contactSegments,clearance,pitch,lead,coreRadius,crestRadius,phase,carriageBase,neckHalf,external,internal,
    headLeft:x(e.headLeft),headRight:0,headTop:y(e.headTop),headBottom:y(e.baseBottom),headDepth:.36,
    baseTop:y(e.baseTop),baseBottom:y(e.baseBottom),bedEnd:x(source.bedEnd),railEnd:x(396),
    neckTop:y(e.neckTop),neckBottom:y(267),neckDepth:.30,footBottom,footTop:y(source.footTop),footDepth:.30,
    footLeft:x(e.footLeft)-carriageBase,footRight:x(e.footRight)-carriageBase,
    railTop,railBottom,railBackTop:y(e.railBackTop),railFront:.34,railBack:-.43,
    turns:3,period:8};
}
