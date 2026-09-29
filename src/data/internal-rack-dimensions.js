// Manual measurements of mm_139.png; the drawing's teeth are not a conjugate pair.
export const internalRackDimensions={
 pixelsPerUnit:100,shaft:[258,276],rackCentre:[253,260],
 frame:{left:73,right:443,top:136,bottom:407},
 window:{left:114,right:399,top:188,bottom:367},
 rackRootBounds:{left:127,right:380,top:207,bottom:313},
 pinionOuterRadius:32,
 suspension:{
  left:{pivot:[93,177],top:[83,117],wrist:[132,152],rackPin:[131,209]},
  right:{pivot:[347,173],top:[342,117],wrist:[382,150],rackPin:[385,208]},
 },
 // Common-module reconstruction chosen to match the measured outer dimensions.
 // Ten pinion teeth as drawn, nine straight pitches and 18 equivalent circular
 // teeth on the ends. Pass 107 (user rule): where Brown draws square racks
 // and pinions, use an ideal involute pinion cut by the standard 20-degree
 // basic rack, so the straight runs carry trapezoidal basic-rack teeth.
 module:.053,pinionTeeth:10,endTeeth:18,straightTeeth:9,sourceRackX:-.05,
 tooth:{pressureAngle:20*Math.PI/180,pinionAddendum:1,pinionDedendum:1.25},
};
