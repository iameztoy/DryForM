/*******************************************************
 * AlphaEarth / Satellite Embeddings + Validation Tables
 * Multi-AOI + Multi-Classifier + Optional Tree Export
 *
 * AOIs: caatinga, cerrado, chaco, tanzania
 * YEAR default: 2020
 *
 * PURPOSE:
 *  - Run selected classifiers on AlphaEarth embeddings
 *  - Export one validation-metrics table per AOI x algorithm
 *  - Optionally export one single consolidated table
 *  - Optionally export Tree Cover binary map as asset
 *******************************************************/

// ======================================================
// 0) USER SETTINGS
// ======================================================

// ---- Year selector ----
var YEAR = 2020;

// ---- Ground truth label property ----
var landcover = "visulcrec";   // or "visu_lc"

// ---- Sampling / processing ----
var SCALE = 10;
var TRAIN_TILE_SCALE = 8;
var TEST_TILE_SCALE  = 16;

// ---- Buffer settings (points) ----
var TRAIN_GEOM_MODE = 'POINTS';  // 'POINTS' | 'POLYGONS'
var BUFFER_METERS   = 20;        // used only for POINTS

// ---- AOIs to run ----
var AOI_NAMES_TO_RUN = ['caatinga', 'cerrado', 'chaco', 'tanzania'];

// ---- Methods to run ----
var METHODS_TO_RUN = [
  'MIN_DIST_COS',
  'KNN_LINEAR',
  'SVM_LINEAR',
  'RF',
  'GTB',
  'SVM_RBF'
];

// ---- Export toggles ----
var DO_EXPORT_PER_RUN_TABLES      = true;   // one CSV per AOI x algorithm
var DO_EXPORT_SINGLE_SUMMARY_TABLE = false; // NEW: one single CSV with all runs
var DO_EXPORT_TREE_ASSET           = false; // NEW: one tree-cover asset per AOI x algorithm

// ---- Export settings ----
var EXPORT_DRIVE_FOLDER = 'DryForm_AlphaEarth_ValidationMetrics';
var EXPORT_FILE_FORMAT  = 'CSV';

// ---- Tree asset export settings ----
var EXPORT_TREE_FOLDER = "projects/hardy-tenure-383607/assets/DryForm_Project/Classification/TreeCover/";
var EXPORT_CRS         = "EPSG:4326";

// ---- Optional prints / preview ----
var DO_PRINT_DIAGNOSTICS = true;
var DO_PREVIEW_FIRST_AOI = false;

// ---- Missing metric sentinel for CSV exports ----
var MISSING_VALUE = -9999;

// ======================================================
// 1) AOIs
// ======================================================

var caatinga = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Caatinga");
var cerrado  = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Cerrado");
var chaco    = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Chaco");
var tanzania = ee.FeatureCollection("users/iameztoy/dryform/AOIs/zone_Tanzania");

var AOIS = {
  caatinga: caatinga,
  cerrado:  cerrado,
  chaco:    chaco,
  tanzania: tanzania
};

// ======================================================
// 2) AlphaEarth embeddings
// ======================================================

var dataset = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

// ======================================================
// 3) Ground Truth collections
// ======================================================

var GroundTruthPoint_DF = ee.FeatureCollection(
  "projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPoint_DF"
);

var GroundTruthPol_DF = ee.FeatureCollection(
  "projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPol_DF"
);

// Balanced training sets (Points)
var GTPoint_DF_Balanced = {
  chaco:    ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_chaco"),
  caatinga: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_caatinga"),
  cerrado:  ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_cerrado"),
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania")
};

// Balanced training sets (Polygons)
var GTPol_DF_Balanced = {
  chaco:    ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_chaco"),
  caatinga: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_caatinga"),
  cerrado:  ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_cerrado"),
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania") // revise if needed
};

// ======================================================
// 4) Class schema helpers
// ======================================================

function getSchema(aoiName) {
  var isChaco = (aoiName === 'chaco');

  var classValues = isChaco
    ? [0, 1, 2, 3, 5, 6, 7, 9, 10]
    : [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];

  var remapValues = isChaco
    ? [6, 0, 1, 2, 3, 4, 5, 7, 8]
    : [6, 0, 1, 2, 3, 4, 5, 7, 8, 9];

  var classNames = isChaco
    ? [
        'TreeCover',
        'Shrubland',
        'Grassland',
        'FloodedVegetation',
        'Built',
        'PermanentWater',
        'SeasonalWater',
        'Bare',
        'Crops'
      ]
    : [
        'TreeCover',
        'Shrubland',
        'Grassland',
        'Mangroves',
        'FloodedVegetation',
        'Built',
        'PermanentWater',
        'SeasonalWater',
        'Bare',
        'Crops'
      ];

  return {
    classValues: classValues,
    remapValues: remapValues,
    classNames: classNames,
    hasMangroves: !isChaco
  };
}

function sanitizeName(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

// ======================================================
// 5) Training / validation helpers
// ======================================================

function getTrainingRaw(aoiName) {
  return (TRAIN_GEOM_MODE === 'POLYGONS')
    ? GTPol_DF_Balanced[aoiName]
    : GTPoint_DF_Balanced[aoiName];
}

function getValidationRaw(aoiName) {
  return GroundTruthPoint_DF
    .filter(ee.Filter.eq('aoiname', aoiName))
    .filter(ee.Filter.eq('purp', 'validation'));
}

function maybeBuffer(fc) {
  if (TRAIN_GEOM_MODE === 'POINTS' && BUFFER_METERS > 0) {
    return fc.map(function(f) { return f.buffer(BUFFER_METERS); });
  }
  return fc;
}

// ======================================================
// 6) Classifier settings
// ======================================================

// ---- RF ----
var RF_numberOfTrees      = 90;
var RF_variablesPerSplit  = null;
var RF_minLeafPopulation  = 1;
var RF_bagFraction        = 0.5;
var RF_maxNodes           = null;
var RF_seed               = 6769;

// ---- GTB ----
var GTB_numberOfTrees = 200;
var GTB_shrinkage     = 0.005;
var GTB_samplingRate  = 0.7;
var GTB_maxNodes      = null;
var GTB_loss          = "LeastAbsoluteDeviation";
var GTB_seed          = 0;

// ---- KNN ----
var KNN_k            = 1;
var KNN_searchMethod = "LINEAR_SEARCH";
var KNN_metric       = "EUCLIDEAN";

// ---- SVM ----
var SVM_decisionProcedure  = "Voting";
var SVM_svmType            = "C_SVC";
var SVM_shrinking          = true;
var SVM_degree             = null;
var SVM_gamma              = null;
var SVM_coef0              = null;
var SVM_cost               = null;
var SVM_nu                 = null;
var SVM_terminationEpsilon = null;
var SVM_lossEpsilon        = null;
var SVM_oneClass           = null;

// ---- Minimum Distance ----
var MIN_kNearest = 1;

// ======================================================
// 7) Classifier factory
// ======================================================

function getClassifier(methodId) {
  methodId = String(methodId).toUpperCase();

  if (methodId === 'RF') {
    return ee.Classifier.smileRandomForest(
      RF_numberOfTrees,
      RF_variablesPerSplit,
      RF_minLeafPopulation,
      RF_bagFraction,
      RF_maxNodes,
      RF_seed
    );
  }

  if (methodId === 'GTB') {
    return ee.Classifier.smileGradientTreeBoost(
      GTB_numberOfTrees,
      GTB_shrinkage,
      GTB_samplingRate,
      GTB_maxNodes,
      GTB_loss,
      GTB_seed
    );
  }

  if (methodId === 'KNN_LINEAR') {
    return ee.Classifier.smileKNN(
      KNN_k,
      KNN_searchMethod,
      KNN_metric
    );
  }

  if (methodId === 'SVM_LINEAR') {
    return ee.Classifier.libsvm(
      SVM_decisionProcedure,
      SVM_svmType,
      'LINEAR',
      SVM_shrinking,
      SVM_degree,
      SVM_gamma,
      SVM_coef0,
      SVM_cost,
      SVM_nu,
      SVM_terminationEpsilon,
      SVM_lossEpsilon,
      SVM_oneClass
    );
  }

  if (methodId === 'SVM_RBF') {
    return ee.Classifier.libsvm(
      SVM_decisionProcedure,
      SVM_svmType,
      'RBF',
      SVM_shrinking,
      SVM_degree,
      SVM_gamma,
      SVM_coef0,
      SVM_cost,
      SVM_nu,
      SVM_terminationEpsilon,
      SVM_lossEpsilon,
      SVM_oneClass
    );
  }

  if (methodId === 'MIN_DIST_COS') {
    return ee.Classifier.minimumDistance('cosine', MIN_kNearest);
  }

  print('WARNING: Unknown method "' + methodId + '". Falling back to RF.');
  return ee.Classifier.smileRandomForest(RF_numberOfTrees);
}

// ======================================================
// 8) Metric helpers
// ======================================================

function safeDivideOrMissing(num, den) {
  num = ee.Number(num);
  den = ee.Number(den);
  return ee.Number(ee.Algorithms.If(
    den.gt(0),
    num.divide(den),
    MISSING_VALUE
  ));
}

function rowSum(cmArray, rowIndex, nClasses) {
  var s = ee.Number(0);
  for (var j = 0; j < nClasses; j++) {
    s = s.add(ee.Number(cmArray.get([rowIndex, j])));
  }
  return s;
}

function colSum(cmArray, colIndex, nClasses) {
  var s = ee.Number(0);
  for (var i = 0; i < nClasses; i++) {
    s = s.add(ee.Number(cmArray.get([i, colIndex])));
  }
  return s;
}

function makeRunTag(aoiName, methodId) {
  var tag = 'AE' + YEAR +
            '_' + aoiName +
            '_' + methodId +
            '_' + TRAIN_GEOM_MODE;

  if (TRAIN_GEOM_MODE === 'POINTS') {
    tag += '_buf' + BUFFER_METERS;
  }

  tag += '_' + landcover;
  return tag;
}

// ======================================================
// 9) Core run builder
// ======================================================

function buildRunOutputs(aoiName, methodId) {
  var aoiFc = AOIS[aoiName];
  var schema = getSchema(aoiName);
  var classValues  = schema.classValues;
  var remapValues  = schema.remapValues;
  var classNames   = schema.classNames;
  var hasMangroves = schema.hasMangroves;
  var nClasses     = classNames.length;
  var classOrder   = ee.List.sequence(0, nClasses - 1);
  var runTag       = makeRunTag(aoiName, methodId);

  // Embedding image
  var imageIC = dataset
    .filterDate(YEAR + '-01-01', (YEAR + 1) + '-01-01')
    .filterBounds(aoiFc);

  var composite = imageIC.mosaic();

  // Raw GT
  var trainingRaw   = getTrainingRaw(aoiName);
  var validationRaw = getValidationRaw(aoiName);

  // Remap labels
  var trainingGcp   = trainingRaw.remap(classValues, remapValues, landcover);
  var validationGcp = validationRaw.remap(classValues, remapValues, landcover);

  // Optional buffer
  trainingGcp   = maybeBuffer(trainingGcp);
  validationGcp = maybeBuffer(validationGcp);

  // Sample predictors
  var training = composite.sampleRegions({
    collection: trainingGcp,
    properties: [landcover],
    scale: SCALE,
    tileScale: TRAIN_TILE_SCALE
  });

  var validationSample = composite.sampleRegions({
    collection: validationGcp,
    properties: [landcover],
    scale: SCALE,
    tileScale: TEST_TILE_SCALE
  });

  // Train
  var classifier = getClassifier(methodId).train({
    features: training,
    classProperty: landcover,
    inputProperties: composite.bandNames()
  });

  // Metrics
  var trainCm = classifier.confusionMatrix();

  var predictedValidation = validationSample.classify(classifier);
  var validCm = predictedValidation.errorMatrix(
    landcover,
    'classification',
    classOrder
  );

  var cmArray = validCm.array();

  var props = {
    runTag: runTag,
    year: YEAR,
    aoi: aoiName,
    classifierMethod: methodId,
    landcover: landcover,
    trainGeomMode: TRAIN_GEOM_MODE,
    bufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? BUFFER_METERS : 0,
    hasMangroves: hasMangroves,
    classCount: nClasses,
    classNames: classNames.join('|'),
    bandsCount: composite.bandNames().size(),
    embeddingMosaicCount: imageIC.size(),
    trainFeatureCountRaw: trainingRaw.size(),
    validFeatureCountRaw: validationRaw.size(),
    trainSampleCount: training.size(),
    validSampleCount: validationSample.size(),
    trainOA: trainCm.accuracy(),
    trainKappa: trainCm.kappa(),
    validOA: validCm.accuracy(),
    validKappa: validCm.kappa()
  };

  var macroUaSum = ee.Number(0);
  var macroUaN   = ee.Number(0);
  var macroPaSum = ee.Number(0);
  var macroPaN   = ee.Number(0);
  var macroF1Sum = ee.Number(0);
  var macroF1N   = ee.Number(0);

  for (var i = 0; i < nClasses; i++) {
    var cname = classNames[i];
    var cslug = sanitizeName(cname);

    var tp   = ee.Number(cmArray.get([i, i]));
    var rsum = rowSum(cmArray, i, nClasses);
    var csum = colSum(cmArray, i, nClasses);

    var ua = safeDivideOrMissing(tp, rsum);
    var pa = safeDivideOrMissing(tp, csum);

    var f1 = ee.Number(ee.Algorithms.If(
      ee.Number(ua).neq(MISSING_VALUE)
        .and(ee.Number(pa).neq(MISSING_VALUE))
        .and(ee.Number(ua).add(pa).gt(0)),
      ee.Number(2).multiply(ua).multiply(pa).divide(ee.Number(ua).add(pa)),
      MISSING_VALUE
    ));

    var commission = ee.Number(ee.Algorithms.If(
      ee.Number(ua).neq(MISSING_VALUE),
      ee.Number(1).subtract(ua),
      MISSING_VALUE
    ));

    var omission = ee.Number(ee.Algorithms.If(
      ee.Number(pa).neq(MISSING_VALUE),
      ee.Number(1).subtract(pa),
      MISSING_VALUE
    ));

    props['refCount_' + cslug]        = rsum;
    props['predCount_' + cslug]       = csum;
    props['tp_' + cslug]              = tp;
    props['ua_' + cslug]              = ua;
    props['pa_' + cslug]              = pa;
    props['f1_' + cslug]              = f1;
    props['commission_' + cslug]      = commission;
    props['omission_' + cslug]        = omission;

    macroUaSum = ee.Number(ee.Algorithms.If(
      ee.Number(ua).neq(MISSING_VALUE), macroUaSum.add(ua), macroUaSum
    ));
    macroUaN = ee.Number(ee.Algorithms.If(
      ee.Number(ua).neq(MISSING_VALUE), macroUaN.add(1), macroUaN
    ));

    macroPaSum = ee.Number(ee.Algorithms.If(
      ee.Number(pa).neq(MISSING_VALUE), macroPaSum.add(pa), macroPaSum
    ));
    macroPaN = ee.Number(ee.Algorithms.If(
      ee.Number(pa).neq(MISSING_VALUE), macroPaN.add(1), macroPaN
    ));

    macroF1Sum = ee.Number(ee.Algorithms.If(
      ee.Number(f1).neq(MISSING_VALUE), macroF1Sum.add(f1), macroF1Sum
    ));
    macroF1N = ee.Number(ee.Algorithms.If(
      ee.Number(f1).neq(MISSING_VALUE), macroF1N.add(1), macroF1N
    ));

    for (var j = 0; j < nClasses; j++) {
      var pname = classNames[j];
      var pslug = sanitizeName(pname);
      props['cm_ref_' + cslug + '_pred_' + pslug] = ee.Number(cmArray.get([i, j]));
    }
  }

  props['validMacroUA'] = ee.Number(ee.Algorithms.If(
    macroUaN.gt(0), macroUaSum.divide(macroUaN), MISSING_VALUE
  ));
  props['validMacroPA'] = ee.Number(ee.Algorithms.If(
    macroPaN.gt(0), macroPaSum.divide(macroPaN), MISSING_VALUE
  ));
  props['validMacroF1'] = ee.Number(ee.Algorithms.If(
    macroF1N.gt(0), macroF1Sum.divide(macroF1N), MISSING_VALUE
  ));

  // Tree Cover is always output class 0 after remap
  props['treeClassIndex']       = 0;
  props['treeClassName']        = 'TreeCover';
  props['tree_ua']              = props['ua_treecover'];
  props['tree_pa']              = props['pa_treecover'];
  props['tree_f1']              = props['f1_treecover'];
  props['tree_commission']      = props['commission_treecover'];
  props['tree_omission']        = props['omission_treecover'];

  var rowFeature = ee.Feature(null, props);

  if (DO_PRINT_DIAGNOSTICS) {
    print('Run tag', runTag);
    print('AOI', aoiName, 'Method', methodId);
    print('Training raw count', trainingRaw.size());
    print('Validation raw count', validationRaw.size());
    print('Training sample count', training.size());
    print('Validation sample count', validationSample.size());
    print('Validation CM', validCm);
    print('Validation OA', validCm.accuracy());
    print('Validation Kappa', validCm.kappa());
  }

  // Optional per-run table export
  if (DO_EXPORT_PER_RUN_TABLES) {
    Export.table.toDrive({
      collection: ee.FeatureCollection([rowFeature]),
      description: 'ValMetrics_' + runTag,
      folder: EXPORT_DRIVE_FOLDER,
      fileNamePrefix: 'ValMetrics_' + runTag,
      fileFormat: EXPORT_FILE_FORMAT
    });
  }

  // Optional tree-cover asset export
  if (DO_EXPORT_TREE_ASSET) {
    var classifiedFull = composite.classify(classifier).toByte();

    var treeCover = classifiedFull.eq(0).selfMask().toByte()
      .rename('TreeCover')
      .clip(aoiFc)
      .set({
        runTag: runTag,
        year: YEAR,
        aoi: aoiName,
        classifierMethod: methodId,
        className: 'TreeCover',
        classValue: 1
      });

    Export.image.toAsset({
      image: treeCover,
      description: 'Tree_' + runTag,
      assetId: EXPORT_TREE_FOLDER + 'Tree_' + runTag,
      pyramidingPolicy: {'.default': 'mode'},
      region: aoiFc.geometry(),
      scale: SCALE,
      crs: EXPORT_CRS,
      maxPixels: 1e13
    });
  }

  // Optional preview only for first combination
  if (DO_PREVIEW_FIRST_AOI &&
      aoiName === AOI_NAMES_TO_RUN[0] &&
      methodId === METHODS_TO_RUN[0]) {
    Map.centerObject(aoiFc, 6);
    Map.addLayer(aoiFc, {color: 'red'}, 'Preview AOI');
    var visParams = {min: -0.3, max: 0.3, bands: ['A01', 'A50', 'A20']};
    Map.addLayer(composite.clip(aoiFc), visParams, YEAR + ' embeddings preview');
  }

  return rowFeature;
}

// ======================================================
// 10) Launch all tasks
// ======================================================

var allRows = [];
var taskCountTables = 0;
var taskCountTrees  = 0;
var totalRuns       = 0;

AOI_NAMES_TO_RUN.forEach(function(aoiName) {
  METHODS_TO_RUN.forEach(function(methodId) {
    var row = buildRunOutputs(aoiName, methodId);
    allRows.push(row);
    totalRuns += 1;

    if (DO_EXPORT_PER_RUN_TABLES) {
      taskCountTables += 1;
    }
    if (DO_EXPORT_TREE_ASSET) {
      taskCountTrees += 1;
    }
  });
});

// Optional single consolidated table
if (DO_EXPORT_SINGLE_SUMMARY_TABLE) {
  var allFc = ee.FeatureCollection(allRows);

  Export.table.toDrive({
    collection: allFc,
    description: 'ValMetrics_ALL_AOIS_ALL_METHODS_AE' + YEAR + '_' + landcover,
    folder: EXPORT_DRIVE_FOLDER,
    fileNamePrefix: 'ValMetrics_ALL_AOIS_ALL_METHODS_AE' + YEAR + '_' + landcover,
    fileFormat: EXPORT_FILE_FORMAT
  });
}

print('Total runs prepared:', totalRuns);
print('Per-run tables enabled:', DO_EXPORT_PER_RUN_TABLES);
print('Single summary table enabled:', DO_EXPORT_SINGLE_SUMMARY_TABLE);
print('Tree asset export enabled:', DO_EXPORT_TREE_ASSET);
print('Expected per-run table tasks:', taskCountTables);
print('Expected tree asset tasks:', taskCountTrees);
print('AOIs:', AOI_NAMES_TO_RUN);
print('Methods:', METHODS_TO_RUN);
print('Drive folder:', EXPORT_DRIVE_FOLDER);
print('Tree asset folder:', EXPORT_TREE_FOLDER);
