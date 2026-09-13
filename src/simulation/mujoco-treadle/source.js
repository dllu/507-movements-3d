// Measured reconstruction targets for movement 082; not a qualified mechanism.
export default {
  "center": [
    492.670600482243,
    522.2145678294165
  ],
  "scale": 228.9964147872054,
  "circles": {
    "wheelFace": {
      "center": [
        492.670600482243,
        522.2145678294165
      ],
      "radius": 228.9964147872054,
      "rmsPixels": 1.4307935098148066,
      "visibleRays": 58
    },
    "wheelHub": {
      "center": [
        492.7507282586605,
        524.2291985635783
      ],
      "radius": 59.57419185079351,
      "rmsPixels": 0.9879212609936041,
      "visibleRays": 59
    },
    "treadleFulcrum": {
      "center": [
        303.80857360912455,
        990.2024859933236
      ],
      "radius": 34.924465734740714,
      "rmsPixels": 0.9543631709428015,
      "visibleRays": 46
    },
    "upperPawlPivot": {
      "center": [
        808.1140200108301,
        420.36146772207206
      ],
      "radius": 27.64866930958117,
      "rmsPixels": 0.6422122867433481,
      "visibleRays": 26
    },
    "lowerPawlPivot": {
      "center": [
        778.544176119239,
        648.9065530834864
      ],
      "radius": 22.44682883045097,
      "rmsPixels": 0.790472915242172,
      "visibleRays": 39
    },
    "upperRodTop": {
      "center": [
        878.142603270853,
        406.5066601791689
      ],
      "radius": 25.378910295091487,
      "rmsPixels": 1.0822082150893044,
      "visibleRays": 45
    },
    "lowerRodTop": {
      "center": [
        815.546292636505,
        669.130900745379
      ],
      "radius": 22.544766978741322,
      "rmsPixels": 1.0504932664698199,
      "visibleRays": 35
    }
  },
  "ratchet": {
    "teeth": 26,
    "tipPhase": 0.6771389293751424,
    "outerRadiusPixels": 279.4772727272727,
    "rootRadiusPixels": 250.5,
    "shortFaceFraction": 0.27,
    "tipFitRmsPixels": 10.240698116660159,
    "direction": "Short face precedes the tip in increasing polar angle; both profiles and contact direction still require mechanical qualification."
  },
  "upperRodBottom": [
    937,
    887
  ],
  "lowerRodBottom": [
    836,
    989
  ],
  "upperStrapPin": [
    1035,
    929
  ],
  "lowerStrapPin": [
    1035,
    1020
  ],
  "pulley": {
    "axisX": 1035,
    "top": 610,
    "bottom": 710,
    "axialEdges": [
      1000,
      1060
    ],
    "postEdges": [
      944,
      977,
      1083,
      1117
    ]
  },
  "treadles": {
    "upperToe": [
      1245,
      923
    ],
    "lowerToe": [
      1263,
      1045
    ],
    "pedestalBottom": 1100
  },
  "upperPawl": {
    "outer": [
      [
        697,
        352
      ],
      [
        732,
        357
      ],
      [
        762,
        371
      ],
      [
        790,
        389
      ],
      [
        812,
        411
      ]
    ],
    "inner": [
      [
        684,
        369
      ],
      [
        727,
        372
      ],
      [
        764,
        394
      ],
      [
        794,
        416
      ],
      [
        810,
        435
      ]
    ]
  },
  "lowerPawl": {
    "outer": [
      [
        742,
        540
      ],
      [
        774,
        570
      ],
      [
        790,
        605
      ],
      [
        795,
        641
      ]
    ],
    "inner": [
      [
        742,
        544
      ],
      [
        756,
        573
      ],
      [
        767,
        603
      ],
      [
        769,
        627
      ]
    ]
  },
  "assumptions": [
    "Uniform 26-tooth divisions regularize the 22 visible/partly visible tips; four teeth are covered by the arms and pawls.",
    "The smooth face, shaft and ratchet outline are reconstructed concentrically despite small differences between the drawn circles.",
    "The end-on pulley spans source y=610..710. The longer vertical lines below it are the hanging strap and stand, not its rim. Its hidden depth follows a circular wheel.",
    "Rod and strap eye centers are separate from the pawl pivots. Link lengths and treadle attachment positions need not be equal.",
    "Tip and root radii approximate stroke centerlines, not the outer edge of the printing ink. Pawl outline readings remain a first geometry target."
  ],
  "provenance": {
    "file": "artifacts/review/082-source-measurements.json",
    "sha256": "6927645397001e61b930a42a2051466f30eef5a574365169d1014829b8011d5b",
    "image": {
      "file": "artifacts/reference/brown-082-detail.png",
      "sha256": "c6deeeffea0405eefa9177561b2884fffee0cdacef5e97c45b3c1faee46611f1",
      "page": "PDF page 28 / printed page 24",
      "crop": [
        3070,
        2510,
        1350,
        1250
      ]
    },
    "overlay": "artifacts/review/082-source-measurements.png"
  }
};
