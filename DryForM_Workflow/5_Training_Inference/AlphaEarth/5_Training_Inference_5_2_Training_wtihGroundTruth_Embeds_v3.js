/*******************************************************
 * AlphaEarth / Satellite Embeddings + Supervised LC
 * Multi-AOI + Multi-Classifier + Detailed Metrics Export
 *
 * AOIs: caatinga, cerrado, chaco, tanzania
 * YEAR default: 2020
 *
 * EXPORT SCOPES
 *   A) Per AOI + method
 *   B) Per AOI
 *   C) Global
 *
 * For each enabled scope, the script exports:
 *   1) Summary table
 *   2) Per-class metrics table
 *   3) Importance table
 *   4) Confusion matrix table
 *
 * IMPORTANT
 * - Earth Engine Export.table creates one table per export.
 * - So the 4 table families are exported as separate CSV/asset tables.
 *******************************************************/


// ======================================================
// 0) USER SETTINGS
// ======================================================

// ------------------------------
// 0.1 AOI selection
// ------------------------------
var RUN_ALL_AOIS = true;
var AOI_NAME = 'cerrado';   // used only if RUN_ALL_AOIS = false

// ------------------------------
// 0.2 Year and label property
// ------------------------------
var YEAR = 2020;
var landcover = "visulcrec"; // or "visu_lc"

// ------------------------------
// 0.3 Method selection
// ------------------------------
var RUN_MULTI_METHODS = true;
var CLASSIFIER_METHOD = 'RF'; // used only if RUN_MULTI_METHODS = false
var METHODS_TO_RUN = ['RF', 'CART', 'GTB', 'KNN', 'NB', 'SVM', 'MIN_DIST'];

// ------------------------------
// 0.4 Sampling / buffering
// ------------------------------
var SCALE = 10;
var TRAIN_TILE_SCALE = 8;
var TEST_TILE_SCALE  = 16;

var TRAIN_GEOM_MODE = 'POINTS'; // 'POINTS' | 'POLYGONS'
var TRAIN_BUFFER_METERS = 20;

// Validation buffer kept TRUE by default, as requested
var BUFFER_VALIDATION = true;
var VALIDATION_BUFFER_METERS = 20;

// ------------------------------
// 0.5 Safety valves
// ------------------------------
// Optional cap on validation FEATURES before buffering/sampleRegions
var LIMIT_VALIDATION_FEATURES = false;
var VALIDATION_FEATURE_CAP = 200;
var VALIDATION_FEATURE_SEED = 42;

// Optional cap on sampled validation rows after sampleRegions
var LIMIT_VALIDATION_SAMPLES = false;
var VALIDATION_SAMPLE_CAP = 50000;
var VALIDATION_SAMPLE_SEED = 99;

// ------------------------------
// 0.6 NaiveBayes preprocessing
// ------------------------------
var NB_ENABLE_PREPROCESS = false;
var NB_SCALE  = 1000;
var NB_OFFSET = 1000;

// ------------------------------
// 0.7 Export scopes
// ------------------------------
// A) one export set per AOI + method
var EXPORT_SCOPE_A_PER_RUN = false;

// B) one export set per AOI (all methods together for that AOI)
var EXPORT_SCOPE_B_PER_AOI = false;

// C) one global export set (all AOIs + all methods together)
var EXPORT_SCOPE_C_GLOBAL = true;

// ------------------------------
// 0.8 Export destinations
// ------------------------------
var DO_EXPORT_TABLES_TO_DRIVE = true;
var DO_EXPORT_TABLES_TO_ASSET = false;

// ------------------------------
// 0.9 Optional classified/model/metadata exports
// ------------------------------
// These are still per AOI + method.
// Use carefully if RUN_ALL_AOIS=true and RUN_MULTI_METHODS=true.
var DO_EXPORT_CLASSIFIED_ASSET = false;
var DO_EXPORT_MODEL_ASSET      = false;
var DO_EXPORT_RUN_METADATA     = false;

// ------------------------------
// 0.10 Export folders
// ------------------------------
var EXPORT_CLASS_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/Classification/";
var EXPORT_MODEL_FOLDER   = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/";
var EXPORT_META_FOLDER    = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/RunMetadata/";
var EXPORT_TABLES_FOLDER  = "projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/DetailedTables/";

var EXPORT_DRIVE_FOLDER = "DryForm_DetailedMetrics";

// ------------------------------
// 0.11 Export CRS
// ------------------------------
var EXPORT_CRS = "EPSG:4326";

// ------------------------------
// 0.12 Visualization
// ------------------------------
var VISUALIZE_FIRST_RESULT = true;


// ======================================================
// 1) INPUT DATA
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

var dataset = ee.ImageCollection('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL');

var GroundTruthPoint_DF = ee.FeatureCollection(
  "projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPoint_DF"
);
var GroundTruthPol_DF = ee.FeatureCollection(
  "projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPol_DF"
);

var GTPoint_DF_Balanced = {
  chaco:    ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_chaco"),
  caatinga: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_caatinga"),
  cerrado:  ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_cerrado"),
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania")
};

var GTPol_DF_Balanced = {
  chaco:    ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_chaco"),
  caatinga: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_caatinga"),
  cerrado:  ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPol_DF_Balanced_cerrado"),
  tanzania: ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GTPoint_DF_Balanced_tanzania")
};


// ======================================================
// 2) CLASSIFIER PARAMETERS
// ======================================================

var RF_numberOfTrees      = 90;
var RF_variablesPerSplit  = null;
var RF_minLeafPopulation  = 1;
var RF_bagFraction        = 0.5;
var RF_maxNodes           = null;
var RF_seed               = 6769;

var CART_maxNodes          = null;
var CART_minLeafPopulation = 1;

var GTB_numberOfTrees = 200;
var GTB_shrinkage     = 0.005;
var GTB_samplingRate  = 0.7;
var GTB_maxNodes      = null;
var GTB_loss          = "LeastAbsoluteDeviation";
var GTB_seed          = 0;

var KNN_k            = 1;
var KNN_searchMethod = "AUTO";
var KNN_metric       = "EUCLIDEAN";

var NB_lambda = 0.000001;

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

var MIN_metric   = "euclidean";
var MIN_kNearest = 1;


// ======================================================
// 3) HELPERS
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

function safeDivide(num, den) {
  num = ee.Number(num);
  den = ee.Number(den);
  return ee.Number(ee.Algorithms.If(den.neq(0), num.divide(den), 0));
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

function buildRunUID(aoiName, method) {
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

function getClassSchema(aoiName) {
  if (aoiName === 'chaco') {
    return {
      classSeq:      [0,1,2,3,4,5,6,7,8],
      classNames:    ['Tree Cover','Shrubs','Grass','Flooded Vegetation','Built','Permanent Water','Seasonal Water','Bare','Crops'],
      originalCodes: [1,2,3,5,6,0,7,9,10],
      hasMangroves:  false,
      treeSeq:       0
    };
  }

  return {
    classSeq:      [0,1,2,3,4,5,6,7,8,9],
    classNames:    ['Tree Cover','Shrubs','Grass','Mangroves','Flooded Vegetation','Built','Permanent Water','Seasonal Water','Bare','Crops'],
    originalCodes: [1,2,3,4,5,6,0,7,9,10],
    hasMangroves:  true,
    treeSeq:       0
  };
}

function buildAoiContext(aoiName) {
  var aoi = AOIS[aoiName];
  var schema = getClassSchema(aoiName);

  var imageIC = dataset
    .filterDate(YEAR + '-01-01', (YEAR + 1) + '-01-01')
    .filterBounds(aoi);

  var composite = imageIC.mosaic();

  var trainingRaw = (TRAIN_GEOM_MODE === 'POLYGONS')
    ? GTPol_DF_Balanced[aoiName]
    : GTPoint_DF_Balanced[aoiName];

  var validationRaw = GroundTruthPoint_DF
    .filter(ee.Filter.eq('aoiname', aoiName))
    .filter(ee.Filter.eq('purp', 'validation'));

  var classValues_default = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10];
  var remapValues_default = [6, 0, 1, 2, 3, 4, 5, 7, 8, 9];

  var classValues_chaco = [0, 1, 2, 3, 5, 6, 7, 9, 10];
  var remapValues_chaco = [6, 0, 1, 2, 3, 4, 5, 7, 8];

  var classValues = (aoiName === 'chaco') ? classValues_chaco : classValues_default;
  var remapValues = (aoiName === 'chaco') ? remapValues_chaco : remapValues_default;

  var trainingGcp = trainingRaw.remap(classValues, remapValues, landcover);
  var validationGcp = validationRaw.remap(classValues, remapValues, landcover);

  validationGcp = maybeLimitValidationFeatures(validationGcp);

  if (TRAIN_GEOM_MODE === 'POINTS' && TRAIN_BUFFER_METERS > 0) {
    var applyTrainBuffer = function(f) { return f.buffer(TRAIN_BUFFER_METERS); };
    trainingGcp = trainingGcp.map(applyTrainBuffer);
  }

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
    schema: schema,
    remapValues: remapValues
  };
}

function runOneMethodOnAoi(ctx, method) {
  method = method.toUpperCase();

  var compositeForTraining = getCompositeForMethod(ctx.composite, method);

  var training = compositeForTraining.sampleRegions({
    collection: ctx.trainingGcp,
    properties: [landcover],
    scale: SCALE,
    tileScale: TRAIN_TILE_SCALE,
    geometries: false
  });

  var classifier = getClassifier(method).train({
    features: training,
    classProperty: landcover,
    inputProperties: compositeForTraining.bandNames()
  });

  var classified = compositeForTraining.classify(classifier);
  var classifiedByte = classified.toByte();

  var test = classifiedByte.sampleRegions({
    collection: ctx.validationGcp,
    properties: [landcover],
    tileScale: TEST_TILE_SCALE,
    scale: SCALE,
    geometries: false
  });

  test = maybeLimitValidationSamples(test);

  var validCM = test.errorMatrix(landcover, 'classification');
  var trainCM = classifier.confusionMatrix();

  var runUID = buildRunUID(ctx.aoiName, method);
  var schema = ctx.schema;
  var nClasses = schema.classSeq.length;

  var cmList = ee.List(validCM.array().toList());
  var totalSamples = ee.Number(test.size());

  var classMetricFeatures = [];
  var confusionFeatures = [];

  var macroF1Sum = ee.Number(0);
  var weightedF1Sum = ee.Number(0);

  var treePrecision = ee.Number(0);
  var treeRecall = ee.Number(0);
  var treeCommission = ee.Number(0);
  var treeOmission = ee.Number(0);
  var treeF1 = ee.Number(0);

  for (var i = 0; i < nClasses; i++) {
    var row = ee.List(cmList.get(i));
    var tp = ee.Number(row.get(i));
    var rowTotal = ee.Number(row.reduce(ee.Reducer.sum()));

    var colVals = [];
    for (var r = 0; r < nClasses; r++) {
      colVals.push(ee.Number(ee.List(cmList.get(r)).get(i)));
    }
    var colTotal = ee.Number(ee.List(colVals).reduce(ee.Reducer.sum()));

    var fp = colTotal.subtract(tp);
    var fn = rowTotal.subtract(tp);
    var tn = totalSamples.subtract(tp).subtract(fp).subtract(fn);

    var precision = safeDivide(tp, colTotal); // user accuracy
    var recall = safeDivide(tp, rowTotal);    // producer accuracy
    var commission = ee.Number(1).subtract(precision);
    var omission = ee.Number(1).subtract(recall);
    var f1 = safeDivide(ee.Number(2).multiply(precision).multiply(recall), precision.add(recall));

    macroF1Sum = macroF1Sum.add(f1);
    weightedF1Sum = weightedF1Sum.add(f1.multiply(rowTotal));

    if (i === schema.treeSeq) {
      treePrecision = precision;
      treeRecall = recall;
      treeCommission = commission;
      treeOmission = omission;
      treeF1 = f1;
    }

    classMetricFeatures.push(
      ee.Feature(null, {
        run_uid: runUID,
        year: YEAR,
        aoi: ctx.aoiName,
        classifierMethod: method,
        landcover: landcover,
        feature_set: 'AlphaEarth_Annual',
        band_combination: 'ALL_EMBEDDINGS',

        class_seq: schema.classSeq[i],
        class_name: schema.classNames[i],
        original_class_code: schema.originalCodes[i],

        reference_total: rowTotal,
        predicted_total: colTotal,
        tp: tp,
        fp: fp,
        fn: fn,
        tn: tn,

        precision_user_acc: precision,
        recall_producer_acc: recall,
        commission_error: commission,
        omission_error: omission,
        f1: f1
      })
    );

    var confProps = {
      run_uid: runUID,
      year: YEAR,
      aoi: ctx.aoiName,
      classifierMethod: method,
      landcover: landcover,
      feature_set: 'AlphaEarth_Annual',
      band_combination: 'ALL_EMBEDDINGS',
      reference_class_seq: schema.classSeq[i],
      reference_class_name: schema.classNames[i],
      original_class_code: schema.originalCodes[i],
      row_total: rowTotal
    };

    for (var j = 0; j < nClasses; j++) {
      confProps['pred_' + String(j)] = ee.Number(row.get(j));
    }

    confusionFeatures.push(ee.Feature(null, confProps));
  }

  var macroF1 = safeDivide(macroF1Sum, nClasses);
  var weightedF1 = safeDivide(weightedF1Sum, totalSamples);

  var explainDict = ee.Dictionary(classifier.explain());
  var importanceDict = ee.Dictionary(ee.Algorithms.If(
    explainDict.contains('importance'),
    explainDict.get('importance'),
    ee.Dictionary({})
  ));

  var importanceKeys = ee.List(importanceDict.keys());
  var hasImportance = importanceKeys.size().gt(0);
  var importanceSum = ee.Number(ee.Algorithms.If(
    hasImportance,
    ee.List(importanceDict.values()).reduce(ee.Reducer.sum()),
    0
  ));

  var importanceFc = ee.FeatureCollection(ee.Algorithms.If(
    hasImportance,
    ee.FeatureCollection(importanceKeys.map(function(key) {
      key = ee.String(key);
      var raw = ee.Number(importanceDict.get(key));
      var rel = ee.Number(ee.Algorithms.If(
        importanceSum.neq(0),
        raw.multiply(100).divide(importanceSum),
        0
      ));
      return ee.Feature(null, {
        run_uid: runUID,
        year: YEAR,
        aoi: ctx.aoiName,
        classifierMethod: method,
        landcover: landcover,
        feature_set: 'AlphaEarth_Annual',
        band_combination: 'ALL_EMBEDDINGS',
        feature: key,
        raw_importance: raw,
        relative_importance_pct: rel,
        importance_available: 1
      });
    })),
    ee.FeatureCollection([
      ee.Feature(null, {
        run_uid: runUID,
        year: YEAR,
        aoi: ctx.aoiName,
        classifierMethod: method,
        landcover: landcover,
        feature_set: 'AlphaEarth_Annual',
        band_combination: 'ALL_EMBEDDINGS',
        feature: 'NA',
        raw_importance: 0,
        relative_importance_pct: 0,
        importance_available: 0
      })
    ])
  ));

  var top1Feature = ee.String(ee.Algorithms.If(
    hasImportance,
    ee.Feature(importanceFc.sort('relative_importance_pct', false).first()).get('feature'),
    'NA'
  ));

  var top1ImportancePct = ee.Number(ee.Algorithms.If(
    hasImportance,
    ee.Feature(importanceFc.sort('relative_importance_pct', false).first()).get('relative_importance_pct'),
    0
  ));

  var summaryFeature = ee.Feature(null, {
    run_uid: runUID,
    year: YEAR,
    aoi: ctx.aoiName,
    classifierMethod: method,
    landcover: landcover,
    feature_set: 'AlphaEarth_Annual',
    band_combination: 'ALL_EMBEDDINGS',

    n_classes: nClasses,
    hasMangroves: ctx.schema.hasMangroves ? 1 : 0,

    imageCount: ctx.imageIC.size(),
    trainFeatureCount: ctx.trainingGcp.size(),
    validFeatureCount: ctx.validationGcp.size(),
    trainSampleCount: training.size(),
    validSampleCount: test.size(),

    trainGeomMode: TRAIN_GEOM_MODE,
    trainBufferMeters: (TRAIN_GEOM_MODE === 'POINTS') ? TRAIN_BUFFER_METERS : 0,
    validationBuffered: BUFFER_VALIDATION ? 1 : 0,
    validationBufferMeters: BUFFER_VALIDATION ? VALIDATION_BUFFER_METERS : 0,

    validationFeatureCapApplied: LIMIT_VALIDATION_FEATURES ? 1 : 0,
    validationFeatureCap: LIMIT_VALIDATION_FEATURES ? VALIDATION_FEATURE_CAP : -1,
    validationSampleCapApplied: LIMIT_VALIDATION_SAMPLES ? 1 : 0,
    validationSampleCap: LIMIT_VALIDATION_SAMPLES ? VALIDATION_SAMPLE_CAP : -1,

    trainingOA: trainCM.accuracy(),
    validationOA: validCM.accuracy(),
    kappa: validCM.kappa(),
    macroF1: macroF1,
    weightedF1: weightedF1,

    tree_cover_class_seq: schema.treeSeq,
    tree_cover_precision: treePrecision,
    tree_cover_recall: treeRecall,
    tree_cover_commission: treeCommission,
    tree_cover_omission: treeOmission,
    tree_cover_f1: treeF1,

    top1_feature: top1Feature,
    top1_feature_importance_pct: top1ImportancePct
  });

  return {
    runUID: runUID,
    aoiName: ctx.aoiName,
    method: method,
    aoi: ctx.aoi,
    classifier: classifier,
    classifiedByte: classifiedByte,
    summaryFc: ee.FeatureCollection([summaryFeature]),
    classMetricsFc: ee.FeatureCollection(classMetricFeatures),
    importanceFc: importanceFc,
    confusionFc: ee.FeatureCollection(confusionFeatures)
  };
}

function exportTableCollection(fc, tag) {
  if (DO_EXPORT_TABLES_TO_ASSET) {
    Export.table.toAsset({
      collection: fc,
      description: tag,
      assetId: EXPORT_TABLES_FOLDER + tag
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

function exportFourTables(summaryFc, classMetricsFc, importanceFc, confusionFc, tagRoot) {
  exportTableCollection(summaryFc,      'Summary_'      + tagRoot);
  exportTableCollection(classMetricsFc, 'ClassMetrics_' + tagRoot);
  exportTableCollection(importanceFc,   'Importance_'   + tagRoot);
  exportTableCollection(confusionFc,    'Confusion_'    + tagRoot);
}

function exportOptionalRunOutputs(result) {
  if (DO_EXPORT_CLASSIFIED_ASSET) {
    Export.image.toAsset({
      image: result.classifiedByte.clip(result.aoi),
      description: 'Class_' + result.runUID,
      assetId: EXPORT_CLASS_FOLDER + 'Class_' + result.runUID,
      pyramidingPolicy: {'.default': 'mode'},
      region: result.aoi.geometry(),
      scale: SCALE,
      crs: EXPORT_CRS,
      maxPixels: 1e13
    });
  }

  if (DO_EXPORT_MODEL_ASSET) {
    if (canExportClassifier(result.method)) {
      Export.classifier.toAsset({
        classifier: result.classifier,
        description: 'Model_' + result.runUID,
        assetId: EXPORT_MODEL_FOLDER + 'Model_' + result.runUID
      });
    } else {
      print('INFO: Export.classifier.toAsset not supported for method ' + result.method +
            ' (' + result.aoiName + ').');
    }
  }

  if (DO_EXPORT_RUN_METADATA) {
    var explainDict = ee.Dictionary(result.classifier.explain());

    var meta = ee.Feature(null, {
      run_uid: result.runUID,
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
      classifierExplain: explainDict.serialize()
    });

    Export.table.toAsset({
      collection: ee.FeatureCollection([meta]),
      description: 'RunMeta_' + result.runUID,
      assetId: EXPORT_META_FOLDER + 'RunMeta_' + result.runUID
    });
  }
}

function visualizeFirstResult(result) {
  if (!VISUALIZE_FIRST_RESULT) return;

  var classifiedVis = result.classifiedByte.clip(result.aoi);
  var hasMangroves = (result.aoiName !== 'chaco');

  Map.setOptions('SATELLITE');
  Map.centerObject(result.aoi, 6);
  Map.addLayer(result.aoi, {color: 'red'}, 'AOI Boundary (' + result.aoiName + ')', 0);
  Map.addLayer(classifiedVis, null, 'LC ' + YEAR + ' (' + result.method + ', ' + result.aoiName + ')', 0);

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
// 5) MAIN EXECUTION
// ======================================================

var globalSummaryFc = ee.FeatureCollection([]);
var globalClassMetricsFc = ee.FeatureCollection([]);
var globalImportanceFc = ee.FeatureCollection([]);
var globalConfusionFc = ee.FeatureCollection([]);

var perAoiCollections = {};
for (var a0 = 0; a0 < AOI_NAMES_TO_RUN.length; a0++) {
  perAoiCollections[AOI_NAMES_TO_RUN[a0]] = {
    summaryFc: ee.FeatureCollection([]),
    classMetricsFc: ee.FeatureCollection([]),
    importanceFc: ee.FeatureCollection([]),
    confusionFc: ee.FeatureCollection([])
  };
}

var firstVisualized = false;

for (var a = 0; a < AOI_NAMES_TO_RUN.length; a++) {
  var aoiName = AOI_NAMES_TO_RUN[a];
  var ctx = buildAoiContext(aoiName);

  print('----------------------------------------');
  print('AOI:', aoiName);
  print('Embedding count (' + aoiName + ')', ctx.imageIC.size());
  print('Training features (' + aoiName + ')', ctx.trainingGcp.size());
  print('Validation features (' + aoiName + ')', ctx.validationGcp.size());

  for (var m = 0; m < METHODS_THIS_RUN.length; m++) {
    var method = METHODS_THIS_RUN[m];
    var result = runOneMethodOnAoi(ctx, method);

    print('Prepared:', aoiName, method, result.runUID);

    globalSummaryFc      = globalSummaryFc.merge(result.summaryFc);
    globalClassMetricsFc = globalClassMetricsFc.merge(result.classMetricsFc);
    globalImportanceFc   = globalImportanceFc.merge(result.importanceFc);
    globalConfusionFc    = globalConfusionFc.merge(result.confusionFc);

    perAoiCollections[aoiName].summaryFc      = perAoiCollections[aoiName].summaryFc.merge(result.summaryFc);
    perAoiCollections[aoiName].classMetricsFc = perAoiCollections[aoiName].classMetricsFc.merge(result.classMetricsFc);
    perAoiCollections[aoiName].importanceFc   = perAoiCollections[aoiName].importanceFc.merge(result.importanceFc);
    perAoiCollections[aoiName].confusionFc    = perAoiCollections[aoiName].confusionFc.merge(result.confusionFc);

    exportOptionalRunOutputs(result);

    if (EXPORT_SCOPE_A_PER_RUN) {
      exportFourTables(
        result.summaryFc,
        result.classMetricsFc,
        result.importanceFc,
        result.confusionFc,
        'Run_' + result.runUID
      );
    }

    if (!firstVisualized && VISUALIZE_FIRST_RESULT) {
      visualizeFirstResult(result);
      firstVisualized = true;
    }
  }

  if (EXPORT_SCOPE_B_PER_AOI) {
    exportFourTables(
      perAoiCollections[aoiName].summaryFc,
      perAoiCollections[aoiName].classMetricsFc,
      perAoiCollections[aoiName].importanceFc,
      perAoiCollections[aoiName].confusionFc,
      'AOI_' + token(aoiName) + '_AE' + token(YEAR) + '_' + token(landcover) + '_' + methodSetTag()
    );
  }
}

if (EXPORT_SCOPE_C_GLOBAL) {
  exportFourTables(
    globalSummaryFc,
    globalClassMetricsFc,
    globalImportanceFc,
    globalConfusionFc,
    'Global_AE' + token(YEAR) + '_' + aoiSetTag() + '_' + token(landcover) + '_' + methodSetTag()
  );
}


// ======================================================
// 6) OPTIONAL PRINTED PREVIEWS
// ======================================================

print('Global summary table', globalSummaryFc);
print('Global class metrics table', globalClassMetricsFc);
print('Global importance table', globalImportanceFc);
print('Global confusion table', globalConfusionFc);

if (!RUN_ALL_AOIS) {
  var metricsChart = ui.Chart.feature.byFeature(
    perAoiCollections[AOI_NAMES_TO_RUN[0]].summaryFc.sort('validationOA', false),
    'classifierMethod',
    ['validationOA', 'kappa', 'macroF1', 'weightedF1', 'tree_cover_f1']
  ).setChartType('ColumnChart').setOptions({
    title: 'Benchmark metrics - ' + AOI_NAMES_TO_RUN[0] + ' (' + YEAR + ')',
    hAxis: {title: 'Classifier'},
    vAxis: {title: 'Metric value'},
    legend: {position: 'top'}
  });
  print(metricsChart);
}
