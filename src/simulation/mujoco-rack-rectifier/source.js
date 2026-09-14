// Measured source and coupled tooth fits; see docs/mujoco-116-rack-rectifier.md.
export const rackRectifierSource = {
  "axis": [
    237.89453485195676,
    286.9411353243507
  ],
  "shaftRadius": 0.19324121530562313,
  "pinion": {
    "teeth": 13,
    "module": 0.076,
    "profileShift": 1.0000000000000002,
    "phase": 0.15009412016850274,
    "origins": {
      "upper": -1.3276419641455677,
      "lower": -1.1793489734190872
    }
  },
  "ratchet": {
    "teeth": 6,
    "direction": 1,
    "faceFraction": 0.08,
    "phase": 0.8242590100238845,
    "rootRadius": 0.26296136835038564,
    "tipRadius": 0.34601099043843775
  },
  "pawlPivot": [
    -0.28894534851956766,
    0.2794113532435068
  ],
  "frame": {
    "top": 204.26838235294082,
    "bottom": 370.0955882352953,
    "leftRodTop": 273.3295454545454,
    "leftRodBottom": 312.2386363636363,
    "rightRodTop": 272.375,
    "rightRodBottom": 305.625,
    "leftInner": 56.04166666666667,
    "rightInner": 455.7083333333333
  }
};
