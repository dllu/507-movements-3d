// Source-proportioned governor geometry and explicit study masses in consistent
// kilogram/world-length/second units (0.1 m per world unit).
export const governorGeometry=()=>({topY:2.8,pivotRadius:.405,ballArm:3.858,elbowArm:2.388,lowerLink:2.351,sleeveRadius:.333,ballRadius:.612,initialSpread:.365,highSpread:.60,gravity:98.1,ballMass:1,upperMass:.02,lowerMass:.02,sleeveMass:.1,upperRadius:.035,lowerRadius:.03});

// Uniform solid capsule moments about its midpoint, parallel/perpendicular to
// its long axis. Split the cylinder and two hemispheres; include their offset
// and hemisphere first moments in the perpendicular second moment.
export function capsuleMoments(mass,length,radius){
 const cylinder=mass*length/(length+4*radius/3),caps=mass-cylinder;
 return{axial:.5*cylinder*radius**2+.4*caps*radius**2,transverse:cylinder*(length**2/12+radius**2/4)+caps*(.4*radius**2+length**2/4+3*length*radius/8)};
}
export function governorEquilibrium(theta,g=governorGeometry()){
 const sn=Math.sin(theta),cs=Math.cos(theta),rb=g.pivotRadius+g.ballArm*sn,rbPrime=g.ballArm*cs,re=g.pivotRadius+g.elbowArm*sn,rePrime=g.elbowArm*cs,d=re-g.sleeveRadius,drop=Math.sqrt(g.lowerLink**2-d*d);
 if(!(drop>0&&theta>0))throw new RangeError('Governor spread is outside the assembly branch');
 const sleevePrime=g.elbowArm*sn+d*rePrime/drop,lowerAngle=Math.asin(-d/g.lowerLink),lowerPrime=-rePrime/drop;
 const ru=g.pivotRadius+.5*g.ballArm*sn,rl=.5*(re+g.sleeveRadius),iu=capsuleMoments(g.upperMass,g.ballArm,g.upperRadius),il=capsuleMoments(g.lowerMass,g.lowerLink,g.lowerRadius);
 const potentialSlope=g.gravity*(2*g.ballMass*g.ballArm*sn+g.upperMass*g.ballArm*sn+g.lowerMass*(g.elbowArm*sn+sleevePrime)+g.sleeveMass*sleevePrime);
 const inertiaSlope=4*g.ballMass*rb*rbPrime+2*(g.upperMass*ru*g.ballArm*cs+2*(iu.transverse-iu.axial)*sn*cs)+2*(g.lowerMass*rl*rePrime+2*(il.transverse-il.axial)*Math.sin(lowerAngle)*Math.cos(lowerAngle)*lowerPrime);
 if(!(potentialSlope>0&&inertiaSlope>0))throw new RangeError('Governor equilibrium is not supported');
 return{speed:Math.sqrt(2*potentialSlope/inertiaSlope),potentialSlope,inertiaSlope,sleeveY:g.topY-g.elbowArm*cs-drop,ballRadius:rb,lowerAngle};
}
