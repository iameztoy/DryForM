/*******************************************************
 * AlphaEarth / Satellite Embeddings + Supervised LC
 * Multi-AOI + Multi-Classifier + Flexible Export Layouts
 *
 * AOIs: caatinga, cerrado, chaco, tanzania
 * YEAR default: 2020
 *
 * EXPORT LAYOUTS IMPLEMENTED
 *
 * A) One separate metrics file per AOI + method
 *    Example:
 *      RF_Chaco.csv
 *      KNN_Chaco.csv
 *      RF_Caatinga.csv
 *      ...
 *
 * B) One combined metrics file per AOI
 *    Example:
 *      Chaco_allMethods.csv
 *      Caatinga_allMethods.csv
 *      ...
 *
 * C) One single global metrics file
 *    Example:
 *      AllAOIs_allMethods.csv
 *
 * You can enable one, two, or all three layouts at the same time.
 *
 * NOTE on model export:
 *  - Export.classifier.toAsset only supports tree-based classifiers
 *    (e.g., smileRandomForest, smileCart, DecisionTree, DecisionTreeEnsemble).
 *  - So model export will only work for RF/CART-like exportable classifiers.
 *******************************************************/


// ======================================================
// 0) USER SETTINGS
// ======================================================

// ------------------------------
// 0.1 AOI selection
// ------------------------------
// If true, run all AOIs in one single execution.
// If false, only AOI_NAME is used.
var RUN_ALL_AOIS = true;

// Used only if RUN_ALL_AOIS = false
var AOI_NAME = 'cerrado';   // 'caatinga' | 'cerrado' | 'chaco' | 'tanzania'

// ------------------------------
// 0.2 Year and label property
// ------------------------------
var YEAR = 2020;
var landcover = "visulcrec"; // or "visu_lc"

// ------------------------------
// 0.3 Method selection
// ------------------------------
// If true, run all METHODS_TO_RUN.
// If false, only CLASSIFIER_METHOD is used.
var RUN_MULTI_METHODS = true;

// Used only if RUN_MULTI_METHODS = false
var CLASSIFIER_METHOD = 'RF'; // 'RF'|'CART'|'GTB'|'KNN'|'NB'|'SVM'|'MIN_DIST'

// Used if RUN_MULTI_METHODS = true
var METHODS_TO_RUN = ['RF', 'CART', 'GTB', 'KNN', 'NB', 'SVM', 'MIN_DIST'];

// ------------------------------
// 0.4 Sampling / buffering
// ------------------------------
var SCALE = 10;
var TRAIN_TILE_SCALE = 8;
var TEST_TILE_SCALE  = 16;

var TRAIN_GEOM_MODE = 'POINTS'; // 'POINTS' | 'POLYGONS'

// Training buffer
var TRAIN_BUFFER_METERS = 20;   // used only if TRAIN_GEOM_MODE === 'POINTS'

// Validation buffer
// Kept TRUE by default, as requested
var BUFFER_VALIDATION = true;
var VALIDATION_BUFFER_METERS = 20;

// ------------------------------
// 0.5 Safety valves for heavy validation
// ------------------------------
// Safety valve 1: limit validation FEATURES before buffering/sampleRegions.
// Helpful when validation is still too heavy.
var LIMIT_VALIDATION_FEATURES = false;
var VALIDATION_FEATURE_CAP = 200;
var VALIDATION_FEATURE_SEED = 42;

// Safety valve 2: limit final sampled validation rows after sampleRegions.
// Less powerful than feature cap, but still useful for export size control.
var LIMIT_VALIDATION_SAMPLES = false;
var VALIDATION_SAMPLE_CAP = 50000;
var VALIDATION_SAMPLE_SEED = 99;

// ------------------------------
// 0.6 NaiveBayes preprocessing
// ------------------------------
// NaiveBayes expects positive integer features; embeddings can be negative floats.
// Enable only if using NB.
var NB_ENABLE_PREPROCESS = false;
var NB_SCALE  = 1000;
var NB_OFFSET = 1000;

// ------------------------------
// 0.7 Export layouts for METRICS TABLES
// ------------------------------
// Layout A: one file per AOI + method
var EXPORT_LAYOUT_A_METHOD_BY_METHOD = false;

// Layout B: one file per AOI with all methods for that AOI
var EXPORT_LAYOUT_B_ONE_FILE_PER_AOI = true;

// Layout C: one single global file with all AOIs + all methods
var EXPORT_LAYOUT_C_ONE_GLOBAL_FILE = false;

// ------------------------------
// 0.8 Table export destinations
// ------------------------------
// These apply to layouts A, B and C
var DO_EXPORT_TABLES_TO_DRIVE = true;
var DO_EXPORT_TABLES_TO_ASSET = false;

// ------------------------------
// 0.9 Optional classified/model/metadata exports
// ------------------------------
// These are queued for every AOI + method run.
// Use carefully if RUN_ALL_AOIS=true and RUN_MULTI_METHODS=true,
// because many tasks can be created.
var DO_EXPORT_CLASSIFIED_ASSET = false;
var DO_EXPORT_MODEL_ASSET      = false;
var DO_EXPORT_RUN_METADATA     = false;

// ------------------------------
// 0.10 Export folders
// ------------------------------
var EXPORT_CLASS_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/Classification/";
var EXPORT_MODEL_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/";
var EXPORT_META_FOLDER    = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/RunMetadata/";
var EXPORT_METRICS_FOLDER = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/Metrics/";

var EXPORT_DRIVE_FOLDER = "DryForm_Metrics";

// ------------------------------
// 0.11 Export CRS
// ------------------------------
var EXPORT_CRS = "EPSG:4326";

// ------------------------------
// 0.12 Visualization
// ------------------------------
// To avoid clutter, only the first AOI + first method result is visualized.
var VISUALIZE_FIRST_RESULT = true;


// ======================================================
// 1) AOIs AND INPUT DATA
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

var AOI_NAMES_ALL = ['caatinga', 'cerrado', 'chaco', 'tanzania'];
var AOI_NAMES_TO_RUN = RUN_ALL_AOIS ? AOI_NAMES_ALL : [AOI_NAME];

// AlphaEarth embeddings
var dataset = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

// Ground truth
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
// Tanzania entry kept as in your original script; revise if polygon asset exists.
var GTPol_DF_Balanced = {
  chaco:    ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_chaco"),
  caatinga: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_caatinga"),
  cerrado:  ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_cerrado"),
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania") // revise if polygon asset exists
};


// ======================================================
// 2) CLASSIFIER PARAMETERS
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
// 3) HELPER FUNCTIONS
// ======================================================

function token(x) {
  if (x === null || x === undefined) return 'def';
  var s = String(x);
  s = s.replace(/\./g, 'p');
  s = s.replace(/\s+/g, '');
  return s;
}

function methodSetTag() {
  return RUN_MULTI_METHODS ? 'multi' : token(CLASSIFIER_METHOD);
}

function aoiSetTag() {
  return RUN_ALL_AOIS ? 'allAOIs' : token(AOI_NAME);
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

function getCompositeForMethod(baseComposite, method) {
  method = (method || 'RF').toUpperCase();

  if (method === 'NB' && NB_ENABLE_PREPROCESS) {
    return baseComposite
      .multiply(NB_SCALE)
      .add(NB_OFFSET)
      .round()
      .toInt();
  }
  return baseComposite;
}

function arrayMean(arr) {
  return ee.Number(
    ee.List(ee.Array(arr).toList()).flatten().reduce(ee.Reducer.mean())
  );
}

function maybeLimitValidationFeatures(fc) {
  if (LIMIT_VALIDATION_FEATURES) {
    fc = fc
      .randomColumn('rand_vf', VALIDATION_FEATURE_SEED)
      .sort('rand_vf')
      .limit(VALIDATION_FEATURE_CAP);
  }
  return fc;
}

function maybeLimitValidationSamples(fc) {
  if (LIMIT_VALIDATION_SAMPLES) {
    fc = fc
      .randomColumn('rand_vs', VALIDATION_SAMPLE_SEED)
      .sort('rand_vs')
      .limit(VALIDATION_SAMPLE_CAP);
  }
  return fc;
}

function buildRunTag(aoiName, method) {
  var bufTrainTag = (TRAIN_GEOM_MODE === 'POINTS')
    ? ('buf' + token(TRAIN_BUFFER_METERS))
    : 'poly';

  var bufValidTag = BUFFER_VALIDATION
    ? ('vbuf' + token(VALIDATION_BUFFER_METERS))
    : 'vpts';

  return 'AE' + token(YEAR) +
         '_' + token(aoiName) +
         '_' + bufTrainTag +
         '_' + bufValidTag +
         '_' + token(landcover) +
         '_' + token(method) +
         '_' + paramSuffix(method);
}

function buildMethodMetricsTag(runTag) {
  return 'MethodMetrics_' + runTag;
}

function buildAoiMetricsTag(aoiName) {
  return 'AOIMetrics_AE' + token(YEAR) +
         '_' + token(aoiName) +
         '_' + token(landcover) +
         '_' + methodSetTag();
}

function buildGlobalMetricsTag() {
  return 'GlobalMetrics_AE' + token(YEAR) +
         '_' + aoiSetTag() +
         '_' + token(landcover) +
         '_' + methodSetTag();
}

function buildAoiContext(aoiName) {
  var aoi = AOIS[aoiName];

  var imageIC = dataset
    .filterDate(YEAR + '-01-01', (YEAR + 1) + '-01-01')
    .filterBounds(aoi);

  var composite = imageIC.mosaic();

  // Training set by AOI + geometry mode
  var trainingRaw = (TRAIN_GEOM_MODE === 'POLYGONS')
    ? GTPol_DF_Balanced[aoiName]
    : GTPoint_DF_Balanced[aoiName];

  // Validation set from original points
  var validationRaw = GroundTruthPoint_DF
    .filter(ee.Filter.eq('aoiname', aoiName))
    .filter(ee.Filter.eq('purp', 'validation'));

  // AOI-dependent remap
  var classValues_default = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];
  var remapValues_default = [6, 0, 1, 2, 3, 4, 5, 7, 8, 9];

  var classValues_chaco = [0, 1, 2, 3, 5, 6, 7, 9, 10];
  var remapValues_chaco = [6, 0, 1, 2, 3, 4, 5, 7, 8];

  var classValues = (aoiName === 'chaco') ? classValues_chaco : classValues_default;
  var remapValues = (aoiName === 'chaco') ? remapValues_chaco : remapValues_default;
  var hasMangroves = (aoiName !== 'chaco');

  var trainingGcp = trainingRaw.remap(classValues, remapValues, landcover);
  var validationGcp = validationRaw.remap(classValues, remapValues, landcover);

  // Optional feature cap before buffering
  validationGcp = maybeLimitValidationFeatures(validationGcp);

  // Buffer training
  if (TRAIN_GEOM_MODE === 'POINTS' && TRAIN_BUFFER_METERS > 0) {
    var applyTrainBuffer = function(f) { return f.buffer(TRAIN_BUFFER_METERS); };
    trainingGcp = trainingGcp.map(applyTrainBuffer);
  }

  // Buffer validation
  if (BUFFER_VALIDATION && VALIDATION_BUFFER_METERS > 0) {
    var applyValidBuffer = function(f) { return f.buffer(VALIDATION_BUFFER_METERS); };
    validationGcp = validationGcp.map(applyValidBuffer);
  }

  return {
    aoiName: aoiName,
    aoi: aoi,
    imageIC: imageIC,
    composite: composite,
    trainingGcp: trainingGcp,
    validationGcp: validationGcp,
    classValues: classValues,
    remapValues: remapValues,
    hasMangroves: hasMangroves
  };
}

function runOneMethodOnAoi(ctx, method) {
  method = method.toUpperCase();

  var compositeForTraining = getCompositeForMethod(ctx.composite, method);

  // Training sample
  var training = compositeForTraining.sampleRegions({
    collection: ctx.trainingGcp,
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

  // Classify
  var classified = compositeForTraining.classify(classifier);
  var classifiedByte = classified.toByte();

  // Validation sample
  var test = classifiedByte.sampleRegions({
    collection: ctx.validationGcp,
    properties: [landcover],
    tileScale: TEST_TILE_SCALE,
    scale: SCALE,
    geometries: false
  });

  test = maybeLimitValidationSamples(test);

  var trainCM = classifier.confusionMatrix();
  var validCM = test.errorMatrix(landcover, 'classification');
  var runTag = buildRunTag(ctx.aoiName, method);

  var metrics = ee.Feature(null, {
    runTag: runTag,
    year: YEAR,
    aoi: ctx.aoiName,
    landcover: landcover,
    classifierMethod: method,

    trainGeomMode: TRAIN_GEOM_MODE,
    trainBufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? TRAIN_BUFFER_METERS : 0,
    validationBuffered: BUFFER_VALIDATION ? 1 : 0,
    validationBufferMeters: BUFFER_VALIDATION ? VALIDATION_BUFFER_METERS : 0,

    validationFeatureCapApplied: LIMIT_VALIDATION_FEATURES ? 1 : 0,
    validationFeatureCap: LIMIT_VALIDATION_FEATURES ? VALIDATION_FEATURE_CAP : -1,
    validationSampleCapApplied: LIMIT_VALIDATION_SAMPLES ? 1 : 0,
    validationSampleCap: LIMIT_VALIDATION_SAMPLES ? VALIDATION_SAMPLE_CAP : -1,

    scale: SCALE,
    bandsCount: compositeForTraining.bandNames().size(),
    imageCount: ctx.imageIC.size(),

    trainFeatureCount: ctx.trainingGcp.size(),
    validFeatureCount: ctx.validationGcp.size(),
    trainSampleCount: training.size(),
    validSampleCount: test.size(),

    hasMangroves: ctx.hasMangroves ? 1 : 0,
    outputClassCount: ctx.remapValues.length,

    trainingOA: trainCM.accuracy(),
    validationOA: validCM.accuracy(),
    kappa: validCM.kappa(),
    meanUserAcc: arrayMean(validCM.consumersAccuracy()),
    meanProducerAcc: arrayMean(validCM.producersAccuracy()),
    meanF1: arrayMean(validCM.fscore())
  });

  return {
    aoiName: ctx.aoiName,
    method: method,
    runTag: runTag,
    classifier: classifier,
    classifiedByte: classifiedByte,
    metrics: metrics,
    aoi: ctx.aoi
  };
}

function exportTableCollection(fc, tag) {
  if (DO_EXPORT_TABLES_TO_ASSET) {
    Export.table.toAsset({
      collection: fc,
      description: tag,
      assetId: EXPORT_METRICS_FOLDER + tag
    });
  }

  if (DO_EXPORT_TABLES_TO_DRIVE) {
    Export.table.toDrive({
      collection: fc,
      description: tag,
      folder: EXPORT_DRIVE_FOLDER,
      fileNamePrefix: tag,
      fileFormat: 'CSV'
    });
  }
}

function exportMethodMetrics(result) {
  var tag = buildMethodMetricsTag(result.runTag);
  var fc = ee.FeatureCollection([result.metrics]);
  exportTableCollection(fc, tag);
}

function exportAoiMetrics(aoiName, metricsArray) {
  var tag = buildAoiMetricsTag(aoiName);
  var fc = ee.FeatureCollection(metricsArray).sort('validationOA', false);
  exportTableCollection(fc, tag);
}

function exportGlobalMetrics(metricsArray) {
  var tag = buildGlobalMetricsTag();
  var fc = ee.FeatureCollection(metricsArray);
  exportTableCollection(fc, tag);
}

function exportOptionalRunOutputs(result) {
  // Classified map
  if (DO_EXPORT_CLASSIFIED_ASSET) {
    Export.image.toAsset({
      image: result.classifiedByte.clip(result.aoi),
      description: 'Class_' + result.runTag,
      assetId: EXPORT_CLASS_FOLDER + 'Class_' + result.runTag,
      pyramidingPolicy: {'.default': 'mode'},
      region: result.aoi.geometry(),
      scale: SCALE,
      crs: EXPORT_CRS,
      maxPixels: 1e13
    });
  }

  // Model
  if (DO_EXPORT_MODEL_ASSET) {
    if (canExportClassifier(result.method)) {
      Export.classifier.toAsset({
        classifier: result.classifier,
        description: 'Model_' + result.runTag,
        assetId: EXPORT_MODEL_FOLDER + 'Model_' + result.runTag
      });
    } else {
      print('INFO: Export.classifier.toAsset not supported for method ' + result.method +
            ' (' + result.aoiName + ').');
    }
  }

  // Run metadata
  if (DO_EXPORT_RUN_METADATA) {
    var explainDict = ee.Dictionary(result.classifier.explain());

    var meta = ee.Feature(null, {
      runTag: result.runTag,
      year: YEAR,
      aoi: result.aoiName,
      landcover: landcover,
      classifierMethod: result.method,
      trainGeomMode: TRAIN_GEOM_MODE,
      trainBufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? TRAIN_BUFFER_METERS : 0,
      validationBuffered: BUFFER_VALIDATION ? 1 : 0,
      validationBufferMeters: BUFFER_VALIDATION ? VALIDATION_BUFFER_METERS : 0,
      validationFeatureCapApplied: LIMIT_VALIDATION_FEATURES ? 1 : 0,
      validationFeatureCap: LIMIT_VALIDATION_FEATURES ? VALIDATION_FEATURE_CAP : -1,
      validationSampleCapApplied: LIMIT_VALIDATION_SAMPLES ? 1 : 0,
      validationSampleCap: LIMIT_VALIDATION_SAMPLES ? VALIDATION_SAMPLE_CAP : -1,
      scale: SCALE,
      hasMangroves: (result.aoiName !== 'chaco') ? 1 : 0,
      classifierExplain: explainDict.serialize()
    });

    Export.table.toAsset({
      collection: ee.FeatureCollection([meta]),
      description: 'RunMeta_' + result.runTag,
      assetId: EXPORT_META_FOLDER + 'RunMeta_' + result.runTag
    });
  }
}

function visualizeFirstResult(result) {
  if (!VISUALIZE_FIRST_RESULT) return;

  var classifiedVis = result.classifiedByte.clip(result.aoi);

  Map.setOptions('SATELLITE');
  Map.centerObject(result.aoi, 6);
  Map.addLayer(result.aoi, {color: 'red'}, 'AOI Boundary (' + result.aoiName + ')', 0);
  Map.addLayer(classifiedVis, null, 'LC ' + YEAR + ' (' + result.method + ', ' + result.aoiName + ')', 0);

  var hasMangroves = (result.aoiName !== 'chaco');

  var tc    = classifiedVis.eq(0).selfMask();
  var shrub = classifiedVis.eq(1).selfMask();
  var grass = classifiedVis.eq(2).selfMask();

  var mangroves = hasMangroves ? classifiedVis.eq(3).selfMask() : ee.Image(0).selfMask();

  var idx_fveg   = hasMangroves ? 4 : 3;
  var idx_built  = hasMangroves ? 5 : 4;
  var idx_pwater = hasMangroves ? 6 : 5;
  var idx_swater = hasMangroves ? 7 : 6;
  var idx_bare   = hasMangroves ? 8 : 7;
  var idx_crop   = hasMangroves ? 9 : 8;

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
  if (hasMangroves) {
    Map.addLayer(mangroves, {palette: "00cf75"}, "Mangroves", 0);
  }
  Map.addLayer(fveg,   {palette: "0096a0"}, "Flooded Vegetation", 0);
  Map.addLayer(built,  {palette: "fa0000"}, "Built", 0);
  Map.addLayer(pwater, {palette: "0064c8"}, "Permanent Water", 0);
  Map.addLayer(bare,   {palette: "b4b4b4"}, "Bare", 0);
  Map.addLayer(crop,   {palette: "f096ff"}, "Crops", 0);
}


// ======================================================
// 4) RUN DEFINITIONS
// ======================================================

var METHODS_THIS_RUN = RUN_MULTI_METHODS ? METHODS_TO_RUN.slice() : [CLASSIFIER_METHOD];

print('AOI_NAMES_TO_RUN', AOI_NAMES_TO_RUN);
print('METHODS_THIS_RUN', METHODS_THIS_RUN);
print('Total AOI x method combinations', AOI_NAMES_TO_RUN.length * METHODS_THIS_RUN.length);


// ======================================================
// 5) MAIN EXECUTION LOOP
// ======================================================

var allMetrics = [];
var metricsByAoi = {};
var firstVisualized = false;

for (var a = 0; a < AOI_NAMES_TO_RUN.length; a++) {
  var aoiName = AOI_NAMES_TO_RUN[a];
  var ctx = buildAoiContext(aoiName);

  print('----------------------------------------');
  print('AOI:', aoiName);
  print('Embedding count (' + aoiName + ')', ctx.imageIC.size());
  print('Training features (' + aoiName + ')', ctx.trainingGcp.size());
  print('Validation features (' + aoiName + ')', ctx.validationGcp.size());

  metricsByAoi[aoiName] = [];

  for (var m = 0; m < METHODS_THIS_RUN.length; m++) {
    var method = METHODS_THIS_RUN[m];
    var result = runOneMethodOnAoi(ctx, method);

    allMetrics.push(result.metrics);
    metricsByAoi[aoiName].push(result.metrics);

    print('Prepared:', aoiName, method, result.runTag);

    // Optional per-run exports (classified/model/metadata)
    exportOptionalRunOutputs(result);

    // Layout A: separate file per AOI + method
    if (EXPORT_LAYOUT_A_METHOD_BY_METHOD) {
      exportMethodMetrics(result);
    }

    // Visualize only the first result
    if (!firstVisualized && VISUALIZE_FIRST_RESULT) {
      visualizeFirstResult(result);
      firstVisualized = true;
    }
  }

  // Layout B: one file per AOI with all methods
  if (EXPORT_LAYOUT_B_ONE_FILE_PER_AOI) {
    exportAoiMetrics(aoiName, metricsByAoi[aoiName]);
  }
}

// Layout C: one single global file
if (EXPORT_LAYOUT_C_ONE_GLOBAL_FILE) {
  exportGlobalMetrics(allMetrics);
}


// ======================================================
// 6) OPTIONAL PRINTED SUMMARIES
// ======================================================

var globalMetricsFc = ee.FeatureCollection(allMetrics);
print('Global metrics feature collection', globalMetricsFc);

if (!RUN_ALL_AOIS) {
  var tagForChart = AOI_NAMES_TO_RUN[0];
  var aoiMetricsFc = ee.FeatureCollection(metricsByAoi[tagForChart]).sort('validationOA', false);

  var metricsChart = ui.Chart.feature.byFeature(
    aoiMetricsFc,
    'classifierMethod',
    ['validationOA', 'kappa', 'meanF1']
  ).setChartType('ColumnChart').setOptions({
    title: 'Benchmark metrics by algorithm - ' + tagForChart + ' (' + YEAR + ')',
    hAxis: {title: 'Classifier'},
    vAxis: {title: 'Metric value'},
    legend: {position: 'top'}
  });

  print(metricsChart);
}
