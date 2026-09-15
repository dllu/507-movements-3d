// Symmetric reconstruction from the 525 px engraving; 0.018 world units/pixel.
// Masses, depths and the sleeve's annular-groove bearing are inferred.
export function beltGovernorGeometry(){
 const scale=.018,topY=4.5,pivotRadius=15*scale,initialSpread=Math.atan2(65,178),ballArm=Math.hypot(65,178)*scale,elbowArm=Math.hypot(38,106)*scale,sleeveRadius=15.5*scale;
 const elbowRadius=pivotRadius+elbowArm*Math.sin(initialSpread),elbowY=topY-elbowArm*Math.cos(initialSpread),sleeveY=topY-197*scale;
 return{scale,topY,pivotRadius,initialSpread,ballArm,elbowArm,sleeveRadius,lowerLink:Math.hypot(elbowRadius-sleeveRadius,elbowY-sleeveY),ballRadius:33*scale,gravity:98.1,ballMass:1,upperMass:.02,lowerMass:.02,sleeveMass:.1,upperRadius:.035,lowerRadius:.03,
  sleeveY,grooveDrop:25*scale,bellX:89*scale,bellY:topY-295*scale,outputArm:118*scale,rodLength:127*scale,upperPulleyY:topY-401*scale,middlePulleyY:topY-422*scale,lowerPulleyY:topY-444*scale,pulleyRadius:47*scale,
  collarMass:.01,followerMass:.005,bellArmMass:.02,rodMass:.02,forkMass:.02};
}

// The crank's fork runs in a horizontal annular sleeve groove. Its radial
// sliding freedom permits the crank tip's circular path; no rotating slot is
// attached to the crank. The belt fork is guided vertically at the source X.
export function beltGovernorLinkage(sleeveY,g=beltGovernorGeometry()){
 const x=-g.bellX,y=g.sleeveY-g.grooveDrop-g.bellY;
 const radius=Math.hypot(x,y),phase=Math.atan2(y,x),target=sleeveY-g.grooveDrop-g.bellY;
 if(Math.abs(target)>=radius)throw new RangeError('Crank cannot reach this sleeve height');
 const bellAngle=Math.PI-Math.asin(target/radius)-phase;
 const followerX=g.bellX+x*Math.cos(bellAngle)-y*Math.sin(bellAngle);
 const outputX=g.bellX+g.outputArm*Math.cos(bellAngle),outputY=g.bellY+g.outputArm*Math.sin(bellAngle);
 const rodX=g.bellX+g.outputArm-outputX;
 if(Math.abs(rodX)>=g.rodLength)throw new RangeError('Connecting rod cannot reach the belt fork');
 const rodAngle=Math.asin(rodX/g.rodLength),forkY=outputY-Math.sqrt(g.rodLength**2-rodX**2);
 return{bellAngle,followerX,outputX,outputY,rodAngle,forkY};
}
