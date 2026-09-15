import {Curve,Vector3} from 'three';

// Lift a planar, arclength-parameterized open band into an axially separated
// full wrap. z is affine in MATERIAL distance, not pulley angle. As the band
// moves, each material point keeps its z coordinate; the contact helix migrates
// around the drum without requiring axial slip of the material on the drum.
// Endpoint depths and adequate drum width must be qualified by the caller.
export class AxiallySeparatedBand extends Curve {
 constructor(planar,{startZ,endZ}){
  super();this.planar=planar;this.planarLength=planar.getLength();
  if(!Number.isFinite(startZ)||!Number.isFinite(endZ)||!Number.isFinite(this.planarLength)||this.planarLength<=0)throw new RangeError('Band needs finite endpoint depths and positive length');
  this.startZ=startZ;this.endZ=endZ;this.slope=(endZ-startZ)/this.planarLength;
  this.length=Math.hypot(this.planarLength,endZ-startZ);this.stretch=this.length/this.planarLength;
 }
 getPoint(t,target=new Vector3()){
  this.planar.getPointAt(t,target);target.z=this.startZ+(this.endZ-this.startZ)*t;return target;
 }
 getPointAt(t,target=new Vector3()){return this.getPoint(t,target);}
 getPointAtDistance(distance,target=new Vector3()){return this.getPoint(distance/this.length,target);}
 getTangent(t,target=new Vector3()){
  this.planar.getTangentAt(t,target);target.z=this.slope;return target.normalize();
 }
 getTangentAt(t,target=new Vector3()){return this.getTangent(t,target);}
 getLength(){return this.length;}
}
