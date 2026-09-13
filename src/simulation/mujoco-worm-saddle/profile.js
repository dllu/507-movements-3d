// The 104 engraving does not have uniform wheel tooth spacing. Eighteen teeth
// preserve its measured worm pitch and wheel envelope with a stub addendum.
export function makeWormSaddleProfile({teeth=18,depth=.24,pressureAngle=20*Math.PI/180}={}) {
  const axis=[242.84838820052923,284.19286718274094],wormAxisY=(151.86458333333334+206.63333333333333)/2;
  const pitch=.30339306743356037,lead=pitch/(2*Math.PI),distance=(axis[1]-wormAxisY)/100;
  const wheelRadius=.8940035191936661,wheelRoot=.7368431782216253,pitchRadius=teeth*lead;
  const wormRoot=(194.62921348314606-162.99019607843138)/200,wormTip=(206.63333333333333-151.86458333333334)/200;
  const tipHalfWidth=.09120969968379253/2,rootHalfWidth=tipHalfWidth+(wormTip-wormRoot)*Math.tan(pressureAngle);
  const low=(80-axis[0])/100,high=(442-axis[0])/100,center=(low+high)/2;
  const phase=(115.23732107974557+.5203173157714861*(wormAxisY-180)-axis[0])/100+tipHalfWidth-Math.PI*lead;
  const mod=x=>x-pitch*Math.round(x/pitch);
  return {axis,world:([x,y])=>[(x-axis[0])/100,(axis[1]-y)/100],pitch,lead,teeth,depth,pressureAngle,distance,wheelRadius,wheelRoot,pitchRadius,
    wormRoot,wormTip,tipHalfWidth,rootHalfWidth,low,high,center,phase:mod(phase),
    // A taller generating cutter gives the observed root relief. Its working
    // flank follows the actual worm; the extra height is below the contact.
    hobTip:distance-wheelRoot,clearance:.0004,
    wormPitchRadius:distance-pitchRadius,
    foot:{left:184.70833333333334,right:313.3181818181818,top:382.05263157894734,bottom:412.4166666666667},
    bed:{top:389.3125,bottom:424.36742424242425,left:88,right:390},
    bearingRadius:.23572004338159758,shaftRadius:.14203565776903757};
}
