export const slidingWormDimensions={
 sourceCenter:[269.5,338.75],scale:.015,teeth:22,module:.07,
 pitchRadius:.77,wormPitchRadius:.20875,wormLength:4*Math.PI*.07,depth:.3,
 shaftY:.97875,crank:[-.2775,-.3825],fixedPivot:[3.045,.09375],
 wheelPhase:1.6540961320037169,wormPhase:.26179938779915,period:12,
};
const g=slidingWormDimensions;
g.rodLength=Math.hypot(g.fixedPivot[0]-g.crank[0],g.fixedPivot[1]-g.crank[1]);
export function slidingWormAtTime(time){
 const wheelAngle=2*Math.PI*time/g.period,inputAngle=g.teeth*wheelAngle;
 const crank=[g.crank[0]*Math.cos(wheelAngle)-g.crank[1]*Math.sin(wheelAngle),g.crank[0]*Math.sin(wheelAngle)+g.crank[1]*Math.cos(wheelAngle)];
 const dy=g.fixedPivot[1]-crank[1],carriageX=g.fixedPivot[0]-crank[0]-Math.sqrt(g.rodLength**2-dy**2);
 const wrist=[carriageX+crank[0],crank[1]],rodAngle=Math.atan2(g.fixedPivot[1]-wrist[1],g.fixedPivot[0]-wrist[0]);
 return {wheelAngle,inputAngle,carriageX,wrist,rodAngle};
}
