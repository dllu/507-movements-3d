// Measured from mm_113.png; see docs/mujoco-113-rack-pinion.md.
export const rackPinionSource = {
  "axis": [
    279.6590409877415,
    424.5290843694545
  ],
  "tilt": 0.014284572605454144,
  "module": 0.06859999999999991,
  "teeth": 15,
  "phase": 0.2732531110153622,
  "rackOrigin": -1.5953032038621555,
  "circles": {
    "hub": {
      "center": [
        279.6590409877415,
        424.5290843694545
      ],
      "radius": 26.30065551375702
    },
    "shaft": {
      "center": [
        279.716315233034,
        424.4778296744188
      ],
      "radius": 19.52762214538049
    },
    "leftRoller": {
      "center": [
        60.222764673089586,
        346.177729386456
      ],
      "radius": 24.465026564382043
    },
    "rightRoller": {
      "center": [
        463.61297918399026,
        342.5837363682621
      ],
      "radius": 24.390760923523352
    },
    "leftRim": {
      "center": [
        60.35220787572385,
        346.5048796003495
      ],
      "radius": 18.350386609280452
    },
    "rightRim": {
      "center": [
        463.11257348676156,
        343.0250612235522
      ],
      "radius": 18.226008377772878
    }
  },
  "lines": {
    "railTop": {
      "slope": -0.01428554426908202,
      "intercept": 310.78907259265156
    },
    "railBottom": {
      "slope": -0.011499339364133871,
      "intercept": 321.61754237641105
    }
  },
  "edges": {
    "railLeft": 20,
    "railRight": 512,
    "rackLeft": 102,
    "rackRight": 428,
    "rackRootLeft": 365,
    "rackRootRight": 360,
    "rackTipLeft": 377,
    "rackTipRight": 373
  }
};
