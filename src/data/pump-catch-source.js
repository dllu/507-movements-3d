// Native stroke-center reconstruction of Brown, PDF page 30 / printed 26.
// Common shaft axis adopts the measured front-bearing center. Hidden depths
// and bores are explicit reconstruction assumptions, not engraving readings.
export default {
  image:'artifacts/reference/brown-086-detail.png',width:1200,height:1240,scale:240,
  center:[614.539127896197,613.5827437563297],wheelOuter:332.5361135088947,wheelInner:248.30199563233663,
  shaftRadius:36.88341194561888,bearingRadius:55.438640870169884,
  catchPivot:[346.23647578795556,596.5900588821324],catchPinRadius:13.252531723229366,
  catch:[
    ['moveTo',145,818],['lineTo',315,611],['quadraticCurveTo',306,589,320,578],['lineTo',337,565],
    ['lineTo',494,394],['quadraticCurveTo',515,385,523,405],['quadraticCurveTo',534,428,525,458],
    ['lineTo',510,434],['quadraticCurveTo',505,426,500,435],['lineTo',387,578],['lineTo',373,620],
    ['lineTo',169,847],['quadraticCurveTo',145,865,143,837],['lineTo',145,818],
  ],
  cam:[
    ['moveTo',501,441],['quadraticCurveTo',488,460,483,488],['quadraticCurveTo',483,548,512,586],
    ['lineTo',564,651],['lineTo',651,638],['lineTo',664,579],['lineTo',563,537],
    ['quadraticCurveTo',523,497,501,441],
  ],
  standard:[
    ['moveTo',240,1133],['lineTo',297,1133],['lineTo',521,696],['lineTo',521,545],['lineTo',554,545],
    ['quadraticCurveTo',611,479,676,542],['lineTo',708,542],['lineTo',708,712],['lineTo',929,1133],
    ['lineTo',1006,1133],['lineTo',1006,1186],['lineTo',240,1186],['lineTo',240,1133],
  ],
  standardOpening:[
    ['moveTo',403,1108],['lineTo',581,752],['quadraticCurveTo',611,718,641,754],['lineTo',833,1108],
    ['lineTo',814,1134],['lineTo',424,1134],['lineTo',403,1108],
  ],
  upperSpoke:[
    ['moveTo',590,540],['lineTo',592,444],['quadraticCurveTo',590,393,578,359],['lineTo',652,359],
    ['quadraticCurveTo',632,417,633,509],['lineTo',635,540],['lineTo',590,540],
  ],
  topBeam:{left:63,right:991,top:77,bottom:165},post:{left:99,right:186,top:165,bottom:1206},
  stop:{left:617,right:727,top:111,bottom:165},base:{left:205,right:1046,top:1186,bottom:1207},
  visibleRope:{x:309,top:714,bottom:1060,width:30},
  rearRuns:{left:615,right:1130,upper:[291,314],lower:[908,938]},
  qualification:'Circle fits and manual visible contours. The common axis, hidden cam root, four completed spokes, plate depths and plain bearing bores reconstruct concealed parts. The two hatched rear runs appear to belong to a separate input belt; its hidden pulley and return path require reconstruction. Pump-rope termination and bucket are omitted by the engraving and remain unresolved in the initial geometry study.',
};
