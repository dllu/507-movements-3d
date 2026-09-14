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
 // Eight straight pitches and 16 equivalent circular teeth on the ends.
 module:.059,pinionTeeth:9,endTeeth:16,straightTeeth:8,sourceRackX:-.05,
};
