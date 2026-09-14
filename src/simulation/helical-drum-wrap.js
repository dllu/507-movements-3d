import * as THREE from 'three';

export class HelicalDrumWrap extends THREE.Curve {
  constructor(radius, sweep, lead) {
    super();
    this.radius = radius;
    this.sweep = sweep;
    this.lead = lead;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const angle = t * this.sweep;
    return target.set(this.radius * Math.sin(angle), -this.radius * Math.cos(angle), (t - .5) * this.lead);
  }
  getTangent(t, target = new THREE.Vector3()) {
    const angle = t * this.sweep;
    return target.set(this.radius * Math.cos(angle), this.radius * Math.sin(angle), this.lead / this.sweep).normalize();
  }
  getLength() {
    return Math.hypot(this.radius * this.sweep, this.lead);
  }
}
