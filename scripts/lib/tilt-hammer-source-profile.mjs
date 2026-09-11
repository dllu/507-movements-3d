import * as THREE from 'three';

export const tiltHammerSource = {
  scale: 350,
  camCenter: [917.140095864471, 815.6803828598087],
  flankCenter: [822.5785024188078, 789.3853776573754],
  flankRadius: 206.5437461597015,
  pivot: [1505, 725],
  noseCenter: [907, 582],
  noseRadius: 27,
};

// Coordinates are readings on brown-072-detail.png. Curves join the visible
// outline, independently of the cam-contact and gravity calculations.
export function tiltHammerOutlines() {
  const hammer = new THREE.Shape();
  hammer.moveTo(282, 257);
  hammer.bezierCurveTo(285, 204, 285, 136, 305, 117);
  hammer.quadraticCurveTo(319, 99, 339, 105);
  hammer.bezierCurveTo(490, 126, 633, 126, 750, 179);
  hammer.bezierCurveTo(850, 223, 907, 266, 1000, 292);
  hammer.bezierCurveTo(1180, 350, 1393, 405, 1505, 416);
  hammer.lineTo(1472, 641);
  hammer.lineTo(1471, 600);
  hammer.bezierCurveTo(1468, 541, 1410, 526, 1350, 511);
  hammer.bezierCurveTo(1250, 487, 1131, 451, 1062, 451);
  hammer.bezierCurveTo(988, 444, 960, 493, 943, 551);
  hammer.quadraticCurveTo(943, 568, 921, 558);
  hammer.lineTo(859, 548);
  hammer.bezierCurveTo(872, 478, 844, 398, 803, 380);
  hammer.bezierCurveTo(700, 354, 465, 301, 282, 257);
  hammer.closePath();
  const striker = new THREE.Shape();
  striker.moveTo(344, 273); striker.lineTo(566, 322);
  striker.quadraticCurveTo(558, 345, 542, 363);
  striker.lineTo(351, 321); striker.lineTo(344, 273); striker.closePath();
  const workpiece = new THREE.Shape();
  workpiece.moveTo(39, 264); workpiece.lineTo(69, 311);workpiece.lineTo(54, 316);
  workpiece.lineTo(77, 333);workpiece.lineTo(51, 340);
  workpiece.bezierCurveTo(104, 394, 145, 423, 200, 452);
  workpiece.bezierCurveTo(294, 513, 355, 525, 417, 525);
  workpiece.lineTo(495, 525);
  workpiece.bezierCurveTo(556, 524, 606, 481, 628, 442);
  workpiece.quadraticCurveTo(633, 430, 618, 428);
  workpiece.lineTo(550, 418);
  workpiece.bezierCurveTo(537, 449, 527, 459, 497, 458);
  workpiece.lineTo(451, 458);
  workpiece.bezierCurveTo(417, 454, 372, 440, 339, 422);
  workpiece.lineTo(320, 391);
  workpiece.bezierCurveTo(235, 381, 114, 333, 39, 264);workpiece.closePath();
  const sleeve = new THREE.Shape();
  sleeve.moveTo(1505, 416);sleeve.lineTo(1620, 427);sleeve.lineTo(1575, 660);
  sleeve.lineTo(1472, 641);sleeve.closePath();
  const neck = new THREE.Shape();
  neck.moveTo(1482, 643);neck.lineTo(1572, 659);neck.lineTo(1546, 690);
  neck.lineTo(1550, 725);neck.lineTo(1455, 725);neck.lineTo(1457, 705);
  neck.lineTo(1480, 675);neck.closePath();
  const noseStem = new THREE.Shape();
  noseStem.moveTo(883, 551);noseStem.lineTo(934, 559);noseStem.lineTo(934, 582);
  noseStem.lineTo(880, 582);noseStem.closePath();
  return Object.fromEntries(Object.entries({hammer,striker,workpiece,sleeve,neck,noseStem})
    .map(([name,shape])=>[name,shape.getPoints(24).map(p=>[p.x,p.y])]));
}
