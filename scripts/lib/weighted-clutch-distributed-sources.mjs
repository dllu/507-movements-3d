export const distributedClutchSources=[
  'package.json','package-lock.json',
  ...['weighted-clutch-source','weighted-clutch-source-fit','weighted-clutch-distributed-candidate',
    'weighted-clutch-key-candidate','weighted-clutch-independent-candidate','weighted-clutch-lost-motion-candidate',
    'weighted-clutch-candidate','weighted-clutch-lost-motion','weighted-clutch-linkage','weighted-clutch-distributed-sources',
    'study-report-io'].map(name=>'scripts/lib/'+name+'.mjs'),
  ...['primitives','bevel-geometry','jaw-clutch-geometry','finite-plate-geometry','conforming-plate-mesh',
    'clutch-section-geometry'].map(name=>'src/simulation/'+name+'.js'),
];
