// Original-engraving ink fit and conjugate pitch reconstruction. The pitch
// curve keeps only the first and third harmonics, with the third limited to
// 2.5 source pixels (refit in /dev/shm/u2 with scripts/fit-roller-yoke-cam.mjs
// data): the fitted 5th and 7th harmonics made the yoke jerk and surge, so the
// cam is deliberately smoothed at the cost of a 3.7-pixel RMS ink residual.
export default {
  "axis": [
    129.817384168008,
    170.98288983650667
  ],
  "shaftRadius": 0.26524515971335727,
  "meanPitchRadius": 0.8267631951773983,
  "rollerRadius": 0.19387990218756157,
  "initialQ": -0.22295483475268496,
  "coefficients": [
    [
      1,
      0.064365234375,
      -0.203300110057
    ],
    [
      3,
      0.0154496536258,
      0.0196547246952
    ]
  ],
  "rollerMidpointY": 193.27837331177517,
  "lines": {
    "leftRailLeft": 91.81730769230765,
    "leftRailRight": 100.16911764705884,
    "rightRailLeft": 160.875,
    "rightRailRight": 170.41911764705878,
    "topCrossbarTop": 66.625,
    "topCrossbarBottom": 80.827380952381,
    "bottomCrossbarTop": 302.725,
    "bottomCrossbarBottom": 316.05792682926847,
    "leftCheekLeft": 87.76785714285712,
    "leftCheekRight": 102.9083333333333,
    "rightCheekLeft": 156.475,
    "rightCheekRight": 173.32499999999996,
    "lowerGuideTop": 398.7530487804878,
    "lowerGuideBottom": 417.49999999999983
  }
};
