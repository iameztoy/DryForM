/*******************************************************
 * AlphaEarth / Satellite Embeddings + Supervised LC
 * Multi-AOI + Multi-Classifier + Exports (Assets / CSV)
 *
 * AOIs: caatinga, cerrado, chaco, tanzania
 * YEAR default: 2020
 *
 * MAIN UPDATES
 *  - AOI-dependent remap preserved (Chaco = no mangroves)
 *  - Training and validation buffering separated
 *  - Validation buffer kept TRUE by default (as requested)
 *  - Multi-method benchmark mode added
 *  - One AOI metrics table export added (1 row per algorithm)
 *  - Single-method export mode preserved for classified/model assets
 *
 * NOTE on model export:
 *  - Export.classifier.toAsset only supports tree-based classifiers
 *    (e.g., smileRandomForest, smileCart, DecisionTree, DecisionTreeEnsemble).
 *    For other methods, this script exports metadata / metrics only.
 *******************************************************/

// ======================================================
// 0) USER SETTINGS
// ======================================================

// ---- AOI selector (ONLY change this) ----
var AOI_NAME = 'cerrado';   // 'caatinga' | 'cerrado' | 'chaco' | 'tanzania'

// ---- Year selector ----
var YEAR = 2020;

// ---- Ground truth label property ----
var landcover = "visulcrec"; // or "visu_lc"

// ---- Sampling/processing ----
var SCALE = 10;
var TRAIN_TILE_SCALE = 8;
var TEST_TILE_SCALE  = 16;

// ---- Geometry mode ----
var TRAIN_GEOM_MODE = 'POINTS'; // 'POINTS' | 'POLYGONS'

// ---- Training buffer ----
var TRAIN_BUFFER_METERS = 20;   // used only if TRAIN_GEOM_MODE === 'POINTS'

// ---- Validation buffer ----
// Kept TRUE by default as requested
var BUFFER_VALIDATION = true;
var VALIDATION_BUFFER_METERS = 20;

// ---- Optional validation sample cap (safety valve) ----
// If buffered validation becomes too large, switch this to true.
var LIMIT_VALIDATION_SAMPLES = false;
var VALIDATION_SAMPLE_CAP = 50000;
var VALIDATION_SAMPLE_SEED = 42;

// ---- Classifier selector ----
// Used only when RUN_MULTI_METHODS = false
var CLASSIFIER_METHOD = 'RF'; // 'RF'|'CART'|'GTB'|'KNN'|'NB'|'SVM'|'MIN_DIST'

// ---- Multi-method benchmark mode ----
// If true, the script runs all METHODS_TO_RUN and exports one AOI metrics table
var RUN_MULTI_METHODS = true;
var METHODS_TO_RUN = ['RF', 'CART', 'GTB', 'KNN', 'NB', 'SVM', 'MIN_DIST'];

// ---- NaiveBayes preprocessing (optional) ----
// NaiveBayes expects positive integer features; embeddings can be negative floats.
// Enable only if using NB.
var NB_ENABLE_PREPROCESS = false;
var NB_SCALE  = 1000;
var NB_OFFSET = 1000;

// ---- Export toggles ----
// Recommended for benchmarking:
//   - keep classified/model exports OFF
//   - export only AOI metrics table
var DO_EXPORT_CLASSIFIED_ASSET = false;
var DO_EXPORT_MODEL_ASSET      = false;
var DO_EXPORT_RUN_METADATA     = false;

// AOI metrics table export (all methods for selected AOI)
var DO_EXPORT_AOI_METRICS_ASSET = false;
var DO_EXPORT_AOI_METRICS_DRIVE = true;

// ---- Export folders (assets) ----
var EXPORT_CLASS_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/Classification/";
var EXPORT_MODEL_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/";
var EXPORT_META_FOLDER    = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/RunMetadata/";
var EXPORT_METRICS_FOLDER = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/Metrics/";

// ---- Drive export folder ----
var EXPORT_DRIVE_FOLDER = "DryForm_AOI_Metrics";

// ---- Export CRS ----
var EXPORT_CRS = "EPSG:4326";


// ======================================================
// 1) AOIs (ALL)
// ======================================================

var caatinga = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Caatinga");
var cerrado  = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Cerrado");
var chaco    = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Chaco");
var tanzania = ee.FeatureCollection("users/iameztoy/dryform/AOIs/zone_Tanzania");

// AOI dictionary
var AOIS = {
  caatinga: caatinga,
  cerrado:  cerrado,
  chaco:    chaco,
  tanzania: tanzania
};

// Selected AOI
var aoi   = AOIS[AOI_NAME];
var aoi_n = AOI_NAME;

// Safety prints
print('AOI_NAME', AOI_NAME);
print('AOI FC', aoi);


// ======================================================
// 2) AlphaEarth / Satellite Embeddings
// ======================================================

var dataset = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

var imageIC = dataset
  .filterDate(YEAR + '-01-01', (YEAR + 1) + '-01-01')
  .filterBounds(aoi);

print('Embedding collection (filtered)', imageIC);
print('Embedding count', imageIC.size());

var composite = imageIC.mosaic();
var compositeVis = composite.clip(aoi);

// Visualize a few embedding axes
var visParams = {min: -0.3, max: 0.3, bands: ['A01', 'A50', 'A20']};
Map.addLayer(compositeVis, visParams, YEAR + ' embeddings');
Map.setOptions('SATELLITE');
Map.centerObject(aoi, 6);


// ======================================================
// 3) Ground Truth collections + auto training/validation selection
// ======================================================

// Original sample sets
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
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania") // revisar si existe polygon asset correcto
};

// Auto training set based on AOI + mode
var trainingGcp = (TRAIN_GEOM_MODE === 'POLYGONS')
  ? GTPol_DF_Balanced[aoi_n]
  : GTPoint_DF_Balanced[aoi_n];

// Validation set (original points, filtered by AOI + purp=validation)
var gtp_f  = GroundTruthPoint_DF.filter(ee.Filter.eq('aoiname', aoi_n));
var validationGcp = gtp_f.filter(ee.Filter.eq('purp', "validation"));

print("Training GCP (raw)", trainingGcp);
print("Validation GCP (raw)", validationGcp);
print("Training count (raw)", trainingGcp.size());
print("Validation count (raw)", validationGcp.size());


// ======================================================
// 4) AOI-dependent remap (Chaco without mangroves)
// ======================================================

// Default: cerrado, caatinga, tanzania
var classValues_default = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];
var remapValues_default = [6, 0, 1, 2, 3, 4, 5, 7, 8, 9];

// Chaco: no mangroves (class 4 absent)
var classValues_chaco = [0, 1, 2, 3, 5, 6, 7, 9, 10];
var remapValues_chaco = [6, 0, 1, 2, 3, 4, 5, 7, 8];

// Select mapping by AOI
var classValues = (aoi_n === 'chaco') ? classValues_chaco : classValues_default;
var remapValues = (aoi_n === 'chaco') ? remapValues_chaco : remapValues_default;

// Apply remap on label property
trainingGcp   = trainingGcp.remap(classValues, remapValues, landcover);
validationGcp = validationGcp.remap(classValues, remapValues, landcover);

// Buffer only training if POINTS
if (TRAIN_GEOM_MODE === 'POINTS' && TRAIN_BUFFER_METERS > 0) {
  var applyTrainBuffer = function(f) { return f.buffer(TRAIN_BUFFER_METERS); };
  trainingGcp = trainingGcp.map(applyTrainBuffer);
}

// Buffer validation separately
if (BUFFER_VALIDATION && VALIDATION_BUFFER_METERS > 0) {
  var applyValidBuffer = function(f) { return f.buffer(VALIDATION_BUFFER_METERS); };
  validationGcp = validationGcp.map(applyValidBuffer);
}

print("Training GCP final", trainingGcp);
print("Validation GCP final", validationGcp);

Map.addLayer(trainingGcp, null, "Training GCP", 1);
Map.addLayer(aoi, {color: "red"}, "AOI Boundary", 0);


// ======================================================
// 5) AOI-dependent class schema for visualization
// ======================================================

var HAS_MANGROVES = (aoi_n !== 'chaco');


// ======================================================
// 6) Classifier params (defaults exposed as vars)
// ======================================================

// ---- RF (SMILE) ----
var RF_numberOfTrees      = 90;
var RF_variablesPerSplit  = null;
var RF_minLeafPopulation  = 1;
var RF_bagFraction        = 0.5;
var RF_maxNodes           = null;
var RF_seed               = 6769;

// ---- CART (SMILE) ----
var CART_maxNodes          = null;
var CART_minLeafPopulation = 1;

// ---- GTB (SMILE) ----
var GTB_numberOfTrees = 200;
var GTB_shrinkage     = 0.005;
var GTB_samplingRate  = 0.7;
var GTB_maxNodes      = null;
var GTB_loss          = "LeastAbsoluteDeviation";
var GTB_seed          = 0;

// ---- KNN (SMILE) ----
var KNN_k            = 1;
var KNN_searchMethod = "AUTO";
var KNN_metric       = "EUCLIDEAN";

// ---- NB (SMILE) ----
var NB_lambda = 0.000001;

// ---- SVM (libsvm) ----
var SVM_decisionProcedure  = "Voting";
var SVM_svmType            = "C_SVC";
var SVM_kernelType         = "LINEAR";
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
var MIN_metric   = "euclidean";
var MIN_kNearest = 1;


// ======================================================
// 7) Helper functions
// ======================================================

function token(x) {
  if (x === null || x === undefined) return 'def';
  var s = String(x);
  s = s.replace(/\./g, 'p');
  s = s.replace(/\s+/g, '');
  return s;
}

function paramSuffix(method) {
  method = method.toUpperCase();

  if (method === 'RF') {
    return 'nT' + token(RF_numberOfTrees) +
           '_vps' + token(RF_variablesPerSplit) +
           '_mlp' + token(RF_minLeafPopulation) +
           '_bf'  + token(RF_bagFraction) +
           '_mN'  + token(RF_maxNodes) +
           '_se'  + token(RF_seed);
  }
  if (method === 'CART') {
    return 'mN' + token(CART_maxNodes) +
           '_mlp' + token(CART_minLeafPopulation);
  }
  if (method === 'GTB') {
    return 'nT' + token(GTB_numberOfTrees) +
           '_sh' + token(GTB_shrinkage) +
           '_sr' + token(GTB_samplingRate) +
           '_mN' + token(GTB_maxNodes) +
           '_ls' + token(GTB_loss) +
           '_se' + token(GTB_seed);
  }
  if (method === 'KNN') {
    return 'k' + token(KNN_k) +
           '_m' + token(KNN_metric) +
           '_sm' + token(KNN_searchMethod);
  }
  if (method === 'NB') {
    return 'lam' + token(NB_lambda) +
           '_pre' + token(NB_ENABLE_PREPROCESS ? 1 : 0) +
           '_sc' + token(NB_SCALE) +
           '_of' + token(NB_OFFSET);
  }
  if (method === 'SVM') {
    return 'svm' + token(SVM_svmType) +
           '_k' + token(SVM_kernelType) +
           '_c' + token(SVM_cost) +
           '_g' + token(SVM_gamma) +
           '_nu' + token(SVM_nu) +
           '_dp' + token(SVM_decisionProcedure);
  }
  if (method === 'MIN_DIST') {
    return 'm' + token(MIN_metric) +
           '_k' + token(MIN_kNearest);
  }
  return 'params';
}

function canExportClassifier(method) {
  method = method.toUpperCase();
  return (method === 'RF' || method === 'CART');
}

function getClassifier(method) {
  method = (method || 'RF').toUpperCase();

  if (method === 'RF') {
    return ee.Classifier.smileRandomForest(
      RF_numberOfTrees,
      RF_variablesPerSplit,
      RF_minLeafPopulation,
      RF_bagFraction,
      RF_maxNodes,
      RF_seed
    );
  }
  if (method === 'CART') {
    return ee.Classifier.smileCart(CART_maxNodes, CART_minLeafPopulation);
  }
  if (method === 'GTB') {
    return ee.Classifier.smileGradientTreeBoost(
      GTB_numberOfTrees,
      GTB_shrinkage,
      GTB_samplingRate,
      GTB_maxNodes,
      GTB_loss,
      GTB_seed
    );
  }
  if (method === 'KNN') {
    return ee.Classifier.smileKNN(KNN_k, KNN_searchMethod, KNN_metric);
  }
  if (method === 'NB') {
    return ee.Classifier.smileNaiveBayes(NB_lambda);
  }
  if (method === 'SVM') {
    return ee.Classifier.libsvm(
      SVM_decisionProcedure,
      SVM_svmType,
      SVM_kernelType,
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
  if (method === 'MIN_DIST') {
    return ee.Classifier.minimumDistance(MIN_metric, MIN_kNearest);
  }

  print('WARNING: Unknown CLASSIFIER_METHOD "' + method + '". Falling back to RF.');
  return ee.Classifier.smileRandomForest(RF_numberOfTrees);
}

function getCompositeForMethod(method) {
  method = (method || 'RF').toUpperCase();

  if (method === 'NB' && NB_ENABLE_PREPROCESS) {
    return composite
      .multiply(NB_SCALE)
      .add(NB_OFFSET)
      .round()
      .toInt();
  }
  return composite;
}

function buildRunTag(method) {
  var bufTrainTag = (TRAIN_GEOM_MODE === 'POINTS')
    ? ('buf' + token(TRAIN_BUFFER_METERS))
    : 'poly';

  var bufValidTag = BUFFER_VALIDATION
    ? ('vbuf' + token(VALIDATION_BUFFER_METERS))
    : 'vpts';

  return 'AE' + token(YEAR) +
         '_' + token(aoi_n) +
         '_' + bufTrainTag +
         '_' + bufValidTag +
         '_' + token(landcover) +
         '_' + token(method) +
         '_' + paramSuffix(method);
}

function arrayMean(arr) {
  return ee.Number(
    ee.List(ee.Array(arr).toList())
      .flatten()
      .reduce(ee.Reducer.mean())
  );
}

function maybeLimitValidation(fc) {
  if (LIMIT_VALIDATION_SAMPLES) {
    fc = fc
      .randomColumn('rand_valid', VALIDATION_SAMPLE_SEED)
      .sort('rand_valid')
      .limit(VALIDATION_SAMPLE_CAP);
  }
  return fc;
}

function runOneMethod(method) {
  method = method.toUpperCase();

  var compositeForTraining = getCompositeForMethod(method);

  // Training samples
  var training = compositeForTraining.sampleRegions({
    collection: trainingGcp,
    properties: [landcover],
    scale: SCALE,
    tileScale: TRAIN_TILE_SCALE,
    geometries: false
  });

  // Train classifier
  var classifier = getClassifier(method).train({
    features: training,
    classProperty: landcover,
    inputProperties: compositeForTraining.bandNames()
  });

  // Classify image
  var classified = compositeForTraining.classify(classifier);
  var classifiedByte = classified.toByte();

  // Validation samples from classified image
  var test = classifiedByte.sampleRegions({
    collection: validationGcp,
    properties: [landcover],
    tileScale: TEST_TILE_SCALE,
    scale: SCALE,
    geometries: false
  });

  test = maybeLimitValidation(test);

  // Accuracy metrics
  var trainCM = classifier.confusionMatrix();
  var validCM = test.errorMatrix(landcover, 'classification');

  var runTag = buildRunTag(method);

  var metrics = ee.Feature(null, {
    runTag: runTag,
    year: YEAR,
    aoi: aoi_n,
    landcover: landcover,
    classifierMethod: method,

    trainGeomMode: TRAIN_GEOM_MODE,
    trainBufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? TRAIN_BUFFER_METERS : 0,
    validationBuffered: BUFFER_VALIDATION ? 1 : 0,
    validationBufferMeters: BUFFER_VALIDATION ? VALIDATION_BUFFER_METERS : 0,

    validationCapApplied: LIMIT_VALIDATION_SAMPLES ? 1 : 0,
    validationSampleCap: LIMIT_VALIDATION_SAMPLES ? VALIDATION_SAMPLE_CAP : -1,

    scale: SCALE,
    bandsCount: compositeForTraining.bandNames().size(),

    trainFeatureCount: trainingGcp.size(),
    validFeatureCount: validationGcp.size(),
    trainSampleCount: training.size(),
    validSampleCount: test.size(),

    hasMangroves: HAS_MANGROVES ? 1 : 0,
    outputClassCount: remapValues.length,

    trainingOA: trainCM.accuracy(),
    validationOA: validCM.accuracy(),
    kappa: validCM.kappa(),
    meanUserAcc: arrayMean(validCM.consumersAccuracy()),
    meanProducerAcc: arrayMean(validCM.producersAccuracy()),
    meanF1: arrayMean(validCM.fscore())
  });

  return {
    method: method,
    runTag: runTag,
    classifier: classifier,
    classifiedByte: classifiedByte,
    metrics: metrics
  };
}


// ======================================================
// 8) Methods to run
// ======================================================

var METHODS_THIS_RUN = RUN_MULTI_METHODS ? METHODS_TO_RUN.slice() : [CLASSIFIER_METHOD];
print('METHODS_THIS_RUN', METHODS_THIS_RUN);

var runResults = [];
var metricsFeatures = [];

for (var i = 0; i < METHODS_THIS_RUN.length; i++) {
  var method = METHODS_THIS_RUN[i];
  var result = runOneMethod(method);

  runResults.push(result);
  metricsFeatures.push(result.metrics);

  print('Prepared method:', method, 'runTag:', result.runTag);
}

var metricsFc = ee.FeatureCollection(metricsFeatures).sort('validationOA', false);
print('AOI metrics table', metricsFc);


// ======================================================
// 9) Diagnostics
// ======================================================

if (!RUN_MULTI_METHODS) {
  var single = runResults[0];

  print("Classifier method", single.method);
  print("Classifier explain()", single.classifier.explain());

  var trainAccuracy = single.classifier.confusionMatrix();
  print('Training error matrix', trainAccuracy);
  print('Training overall accuracy', trainAccuracy.accuracy());

  var singleTest = single.classifiedByte.sampleRegions({
    collection: validationGcp,
    properties: [landcover],
    tileScale: TEST_TILE_SCALE,
    scale: SCALE,
    geometries: false
  });

  singleTest = maybeLimitValidation(singleTest);

  var testConfusionMatrix = singleTest.errorMatrix(landcover, 'classification');
  print('Confusion Matrix (Validation)', testConfusionMatrix);
  print('Validation overall accuracy: ', testConfusionMatrix.accuracy());
  print('Validation user accuracy: ', testConfusionMatrix.consumersAccuracy());
  print('Validation producer accuracy: ', testConfusionMatrix.producersAccuracy());
  print('Kappa Coefficient: ', testConfusionMatrix.kappa());
  print('F1-Score: ', testConfusionMatrix.fscore());

  var explainDict = ee.Dictionary(single.classifier.explain());
  var importanceMaybe = ee.Dictionary(ee.Algorithms.If(
    explainDict.contains('importance'),
    explainDict.get('importance'),
    ee.Dictionary({})
  ));

  var importanceSize = importanceMaybe.size();
  print('Importance dict size', importanceSize);

  var sumImp = ee.Number(importanceMaybe.values().reduce(ee.Reducer.sum()));
  var relativeImportance = importanceMaybe.map(function(key, val) {
    return ee.Number(val).multiply(100).divide(sumImp);
  });

  var importanceFc = ee.FeatureCollection([ee.Feature(null, relativeImportance)]);
  var chart = ui.Chart.feature.byProperty({features: importanceFc}).setOptions({
    title: 'Feature Importance (' + single.method + ')',
    vAxis: {title: 'Importance (%)'},
    hAxis: {title: 'Feature'}
  });
  print(chart);
}

// Optional benchmark chart
if (RUN_MULTI_METHODS) {
  var metricsChart = ui.Chart.feature.byFeature(
    metricsFc,
    'classifierMethod',
    ['validationOA', 'kappa', 'meanF1']
  ).setChartType('ColumnChart').setOptions({
    title: 'Benchmark metrics by algorithm - ' + aoi_n + ' (' + YEAR + ')',
    hAxis: {title: 'Classifier'},
    vAxis: {title: 'Metric value'},
    legend: {position: 'top'}
  });
  print(metricsChart);
}


// ======================================================
// 10) Visualization
// ======================================================

// In multi-method mode, visualize only the first method in METHODS_THIS_RUN
var visRun = runResults[0];
var classifiedVis = visRun.classifiedByte.clip(aoi);

Map.addLayer(classifiedVis, null, 'LC ' + YEAR + ' (' + visRun.method + ')', 0);

// Class schema depends on AOI (Chaco lacks mangroves)
var tc    = classifiedVis.eq(0).selfMask();
var shrub = classifiedVis.eq(1).selfMask();
var grass = classifiedVis.eq(2).selfMask();

var mangroves = HAS_MANGROVES ? classifiedVis.eq(3).selfMask() : ee.Image(0).selfMask();

// If no mangroves, indices shift by -1 for subsequent classes
var idx_fveg   = HAS_MANGROVES ? 4 : 3;
var idx_built  = HAS_MANGROVES ? 5 : 4;
var idx_pwater = HAS_MANGROVES ? 6 : 5;
var idx_swater = HAS_MANGROVES ? 7 : 6;
var idx_bare   = HAS_MANGROVES ? 8 : 7;
var idx_crop   = HAS_MANGROVES ? 9 : 8;

var fveg   = classifiedVis.eq(idx_fveg).selfMask();
var built  = classifiedVis.eq(idx_built).selfMask();
var pwater = classifiedVis.eq(idx_pwater).selfMask();
var swater = classifiedVis.eq(idx_swater).selfMask();
var bare   = classifiedVis.eq(idx_bare).selfMask();
var crop   = classifiedVis.eq(idx_crop).selfMask();

Map.addLayer(swater, {palette: "99d9ea"}, "Seasonal Water", 0);
Map.addLayer(tc,     {palette: "005200"}, "Tree Cover", 1);
Map.addLayer(shrub,  {palette: "eabe44"}, "Shrubs", 0);
Map.addLayer(grass,  {palette: "ffff4c"}, "Grass", 0);
if (HAS_MANGROVES) {
  Map.addLayer(mangroves, {palette: "00cf75"}, "Mangroves", 0);
}
Map.addLayer(fveg,   {palette: "0096a0"}, "Flooded Vegetation", 0);
Map.addLayer(built,  {palette: "fa0000"}, "Built", 0);
Map.addLayer(pwater, {palette: "0064c8"}, "Permanent Water", 0);
Map.addLayer(bare,   {palette: "b4b4b4"}, "Bare", 0);
Map.addLayer(crop,   {palette: "f096ff"}, "Crops", 0);


// ======================================================
// 11) Exports
// ======================================================

// ---- Single-method exports only ----
if (!RUN_MULTI_METHODS) {
  var singleRun = runResults[0];

  if (DO_EXPORT_CLASSIFIED_ASSET) {
    Export.image.toAsset({
      image: singleRun.classifiedByte.clip(aoi),
      description: 'Class_' + singleRun.runTag,
      assetId: EXPORT_CLASS_FOLDER + 'Class_' + singleRun.runTag,
      pyramidingPolicy: {'.default': 'mode'},
      region: aoi.geometry(),
      scale: SCALE,
      crs: EXPORT_CRS,
      maxPixels: 1e13
    });
  }

  if (DO_EXPORT_MODEL_ASSET) {
    if (canExportClassifier(singleRun.method)) {
      Export.classifier.toAsset({
        classifier: singleRun.classifier,
        description: 'Model_' + singleRun.runTag,
        assetId: EXPORT_MODEL_FOLDER + 'Model_' + singleRun.runTag
      });
    } else {
      print('INFO: Export.classifier.toAsset not supported for method ' + singleRun.method);
    }
  }

  if (DO_EXPORT_RUN_METADATA) {
    var explainDictSingle = ee.Dictionary(singleRun.classifier.explain());

    var meta = ee.Feature(null, {
      runTag: singleRun.runTag,
      year: YEAR,
      aoi: aoi_n,
      landcover: landcover,
      classifierMethod: singleRun.method,
      trainGeomMode: TRAIN_GEOM_MODE,
      trainBufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? TRAIN_BUFFER_METERS : 0,
      validationBuffered: BUFFER_VALIDATION ? 1 : 0,
      validationBufferMeters: BUFFER_VALIDATION ? VALIDATION_BUFFER_METERS : 0,
      validationCapApplied: LIMIT_VALIDATION_SAMPLES ? 1 : 0,
      validationSampleCap: LIMIT_VALIDATION_SAMPLES ? VALIDATION_SAMPLE_CAP : -1,
      scale: SCALE,
      bandsCount: getCompositeForMethod(singleRun.method).bandNames().size(),
      trainCount: trainingGcp.size(),
      validCount: validationGcp.size(),
      hasMangroves: HAS_MANGROVES ? 1 : 0,
      classifierExplain: explainDictSingle.serialize()
    });

    Export.table.toAsset({
      collection: ee.FeatureCollection([meta]),
      description: 'RunMeta_' + singleRun.runTag,
      assetId: EXPORT_META_FOLDER + 'RunMeta_' + singleRun.runTag
    });
  }
}

// ---- AOI metrics table export (one file for all algorithms in this AOI) ----
var metricsTag = 'AOIMetrics_AE' + token(YEAR) +
                 '_' + token(aoi_n) +
                 '_' + token(landcover) +
                 '_' + (RUN_MULTI_METHODS ? 'multi' : token(CLASSIFIER_METHOD));

if (DO_EXPORT_AOI_METRICS_ASSET) {
  Export.table.toAsset({
    collection: metricsFc,
    description: metricsTag,
    assetId: EXPORT_METRICS_FOLDER + metricsTag
  });
}

if (DO_EXPORT_AOI_METRICS_DRIVE) {
  Export.table.toDrive({
    collection: metricsFc,
    description: metricsTag,
    folder: EXPORT_DRIVE_FOLDER,
    fileNamePrefix: metricsTag,
    fileFormat: 'CSV'
  });
}
