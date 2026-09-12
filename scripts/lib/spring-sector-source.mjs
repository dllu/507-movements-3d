// Source data for the isolated movement 083 reconstruction study.
export default {
  "scale": 220,
  "center": [
    602.4079509858918,
    384.0351231444831
  ],
  "circles": {
    "rodEyeOuter": {
      "center": [
        606.9381509883632,
        170.96108004488437
      ],
      "radius": 41.739323279154284,
      "rmsResidual": 0.8725429631265191
    },
    "rodEyeInner": {
      "center": [
        606.3290289007981,
        169.7479848447063
      ],
      "radius": 22.258178410170146,
      "rmsResidual": 0.5654644622787933
    },
    "rockshaftEyeOuter": {
      "center": [
        602.4079509858918,
        384.0351231444831
      ],
      "radius": 48.13143178160234,
      "rmsResidual": 1.2513057361216828
    }
  },
  "landmarks": {
    "rodEdges": [
      [
        [
          645,
          153
        ],
        [
          1007,
          257
        ]
      ],
      [
        [
          645,
          195
        ],
        [
          1018,
          304
        ]
      ]
    ],
    "sectorSides": [
      [
        [
          562,
          416
        ],
        [
          310,
          772
        ]
      ],
      [
        [
          651,
          414
        ],
        [
          912,
          791
        ]
      ]
    ],
    "leftOpening": [
      [
        541,
        527
      ],
      [
        562,
        517
      ],
      [
        578,
        527
      ],
      [
        584,
        555
      ],
      [
        582,
        697
      ],
      [
        578,
        770
      ],
      [
        568,
        800
      ],
      [
        553,
        811
      ],
      [
        526,
        806
      ],
      [
        430,
        782
      ],
      [
        406,
        766
      ],
      [
        400,
        742
      ],
      [
        411,
        715
      ]
    ],
    "rightOpening": [
      [
        634,
        527
      ],
      [
        650,
        517
      ],
      [
        674,
        525
      ],
      [
        690,
        546
      ],
      [
        749,
        626
      ],
      [
        801,
        708
      ],
      [
        811,
        736
      ],
      [
        802,
        757
      ],
      [
        775,
        779
      ],
      [
        722,
        796
      ],
      [
        662,
        811
      ],
      [
        641,
        805
      ],
      [
        629,
        785
      ],
      [
        624,
        753
      ],
      [
        626,
        604
      ]
    ],
    "wheel": {
      "left": 246,
      "right": 963,
      "bottom": 968,
      "hub": [
        508,
        684,
        970,
        1012
      ],
      "shaft": [
        584,
        631,
        1014,
        1155
      ]
    },
    "qualification": "Manually located stroke centers and outline targets. Opening lists indicate closed contours; they are not final splines. Wheel tooth count, sector tooth pitch, contact faces, hidden springs and guides remain unmeasured."
  },
  "profile": {
    "divisions": 57,
    "tipRadiusPixels": 509.483154296875,
    "rootRadiusPixels": 487.82513427734375,
    "shortFaceFraction": 0.3339503479003905,
    "phaseDegrees": -2.3196875,
    "tipIndices": [
      -19,
      -8
    ]
  },
  "provenance": [
    {
      "file": "artifacts/review/083-first-source-measurements.json",
      "sha256": "c608dfe02d9b066a9b7667b58220cd99c2f32b23b70771df0bd2a6ea566f9e80"
    },
    {
      "file": "artifacts/review/083-counted-uniform-profile.json",
      "sha256": "d4874e9090be3b06dc5aee0e20af4a4fa63db4fbe421cfc40d221c298213e2c5"
    }
  ],
  "qualification": "Provisional geometry from inspected source contours and a counted 12-tooth arc. Hidden depth and crown dimensions are reconstruction choices; no motion or finite-contact qualification."
};
