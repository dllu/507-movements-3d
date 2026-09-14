import * as THREE from 'three';

// Upper-right spoke traced from the 525 px mm_134.png engraving.
// The short extensions at the rim/hub ensure a continuous casting in depth.
export function ropeDrumSpokeShape() {
  const shape = new THREE.Shape();
  const p = (x, y) => [(x - 253) * .01, (231 - y) * .01];
  shape.moveTo(...p(250, 188));
  shape.bezierCurveTo(...p(278, 187), ...p(334, 129), ...p(338, 109));
  shape.lineTo(...p(344, 99));
  shape.lineTo(...p(383, 146));
  shape.lineTo(...p(374, 150));
  shape.bezierCurveTo(...p(350, 155), ...p(304, 202), ...p(294, 224));
  shape.lineTo(...p(272, 217));
  shape.lineTo(...p(251, 209));
  shape.closePath();
  return shape;
}
