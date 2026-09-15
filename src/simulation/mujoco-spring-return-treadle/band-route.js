import {Curve,Vector3} from 'three';

// Full clockwise wrap on the source branch. Both endpoints may move in XY;
// the winding is retained even when entry and exit exchange angular order.
export class ReturnBandRoute extends Curve {
 constructor(upper,lower,radius=.774){
  super();this.upper=new Vector3(upper[0],upper[1],0);this.lower=new Vector3(lower[0],lower[1],0);this.radius=radius;
  if(!(Number.isFinite(radius)&&radius>0))throw new RangeError('Invalid pulley radius');
  const tangent=(external,entry)=>{
   const d2=external.lengthSq();if(!Number.isFinite(d2)||d2<=radius*radius)throw new RangeError('Band endpoint inside pulley');
   const base=external.clone().multiplyScalar(radius*radius/d2),side=new Vector3(-external.y,external.x,0).multiplyScalar(radius*Math.sqrt(d2-radius*radius)/d2);
   const candidates=[base.clone().add(side),base.clone().sub(side)];
   return candidates.find(p=>{
    const span=entry?p.clone().sub(external):external.clone().sub(p);
    return span.dot(new Vector3(p.y,-p.x,0))>0;
   });
  };
  this.entry=tangent(this.upper,true);this.exit=tangent(this.lower,false);
  this.entryAngle=Math.atan2(this.entry.y,this.entry.x);const exitAngle=Math.atan2(this.exit.y,this.exit.x);
  const delta=Math.atan2(Math.sin(exitAngle-this.entryAngle),Math.cos(exitAngle-this.entryAngle));
  if(Math.abs(delta)>Math.PI/2)throw new RangeError('Band left the source winding branch');
  this.sweep=delta-2*Math.PI;this.incoming=this.upper.distanceTo(this.entry);this.outgoing=this.lower.distanceTo(this.exit);this.wrapLength=-radius*this.sweep;
  this.length=this.incoming+this.wrapLength+this.outgoing;
  this.upperGradient=this.upper.clone().sub(this.entry).multiplyScalar(1/this.incoming);
  this.lowerGradient=this.lower.clone().sub(this.exit).multiplyScalar(1/this.outgoing);
  this.rotorPhase=this.entryAngle+this.incoming/radius;
 }
 getPoint(t,target=new Vector3()){
  const s=t*this.length;
  if(s<=this.incoming)return target.copy(this.upper).lerp(this.entry,s/this.incoming);
  if(s>=this.incoming+this.wrapLength)return target.copy(this.exit).lerp(this.lower,(s-this.incoming-this.wrapLength)/this.outgoing);
  const a=this.entryAngle-(s-this.incoming)/this.radius;return target.set(this.radius*Math.cos(a),this.radius*Math.sin(a),0);
 }
 getPointAt(t,target=new Vector3()){return this.getPoint(t,target);}
 getTangent(t,target=new Vector3()){
  const s=t*this.length;
  if(s<=this.incoming)return target.copy(this.upperGradient).negate();
  if(s>=this.incoming+this.wrapLength)return target.copy(this.lowerGradient);
  const a=this.entryAngle-(s-this.incoming)/this.radius;return target.set(Math.sin(a),-Math.cos(a),0);
 }
 getTangentAt(t,target=new Vector3()){return this.getTangent(t,target);}
 getLength(){return this.length;}
}
