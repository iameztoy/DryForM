/**** AREA OF TREE COVER + OPTIONAL EXTRA CLASSES USING EACH INPUT IMAGE EXTENT AS AOI
 *
 * For each classification asset:
 *   - The AOI is derived from the image footprint.
 *   - By default, the AOI is the bounding box of the image footprint.
 *   - The script calculates area for class 0.
 *   - Optionally, it also includes additional classes such as mangroves.
 *
 * Default target:
 *   - Tree cover + mangroves where applicable.
 *
 * Chaco:
 *   - Tree cover only, because mangroves are not applicable.
 *
 * Default export:
 *   - One combined CSV table with one row per dataset.
 *
 * Optional grid mode:
 *   - If USE_GRID = true, each image AOI is split into grid tiles.
 *   - Tile-level areas are summed back into one final row per dataset.
 *   - The same grid is displayed on the map for visual inspection.
 ****/


// ======================================================
// 1. USER SETTINGS
// ======================================================

// Main tree-cover class.
var TREE_CLASS_VALUE = 0;

// Include additional classes, such as mangroves.
// Default true: area = tree cover + extra classes where applicable.
var INCLUDE_EXTRA_CLASSES = true;

// Default: calculate over the full image-derived AOI.
// Set to true if you get memory or timeout errors.
var USE_GRID = false;

// If true, the AOI is the bounding box of the image footprint.
// If false, the AOI is the actual image footprint geometry.
var USE_BOUNDING_BOX = true;

// Grid size in metres.
// Used only when USE_GRID = true.
var GRID_SIZE_M = 50000;  // 50 km. Try 25000 or 10000 if needed.

// Processing settings.
var TILE_SCALE = 4;
var MAX_PIXELS_DIRECT = 1e13;
var MAX_PIXELS_TILE = 1e12;

// Display and print settings.
var SHOW_VIS = true;
var SHOW_GRID = true;

// Export settings.
var EXPORT_FOLDER = 'GEE_area_exports';
var EXPORT_NAME = 'DryForM_tree_plus_mangroves_area_by_dataset_image_extent';

// Default false:
//   - one combined export task containing all datasets.
// If true:
//   - one export task per dataset.
var EXPORT_SEPARATE_TASKS = false;

// Optional tile-level export.
// Only relevant when USE_GRID = true.
var EXPORT_TILE_LEVEL_RESULTS = false;

// Default scale.
// These DryForM / AlphaEarth classification layers are assumed to be 10 m.
var DEFAULT_SCALE = 10;


// ======================================================
// 2. DEFINE DATASETS
// ======================================================
//
// Class logic used here:
//   - class 0 = tree cover
//   - class 3 = mangroves in the 10-class AOI schema
//
// Chaco:
//   - mangroves are not applicable, so extra_class_values is empty.
//
// To include another class in any AOI, add its class value to
// extra_class_values and its name to extra_class_names.

var DATASETS = [
  {
    dataset_id: 'caatinga_AE2020_MIN_DIST_meuclidean_k1',
    aoi_name: 'Caatinga',
    method_name: 'MIN_DIST',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_caatinga_buf20_vbuf20_visulcrec_MIN_DIST_meuclidean_k1'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [3],
    extra_class_names: ['mangroves']
  },
  {
    dataset_id: 'caatinga_AE2020_RF_nT90',
    aoi_name: 'Caatinga',
    method_name: 'RF',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_caatinga_buf20_vbuf20_visulcrec_RF_nT90_vpsdef_mlp1_bf0p5_mNdef_se6769'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [3],
    extra_class_names: ['mangroves']
  },
  {
    dataset_id: 'caatinga_AE2020_SVM_LINEAR',
    aoi_name: 'Caatinga',
    method_name: 'SVM_LINEAR',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_caatinga_buf20_vbuf20_visulcrec_SVM_svmC_SVC_kLINEAR_cdef_gdef_nudef_dpVoting'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [3],
    extra_class_names: ['mangroves']
  },
  {
    dataset_id: 'cerrado_AE2020_RF_nT90',
    aoi_name: 'Cerrado',
    method_name: 'RF',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_cerrado_buf20_vbuf20_visulcrec_RF_nT90_vpsdef_mlp1_bf0p5_mNdef_se6769'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [3],
    extra_class_names: ['mangroves']
  },
  {
    dataset_id: 'tanzania_AE2020_SVM_LINEAR',
    aoi_name: 'Tanzania',
    method_name: 'SVM_LINEAR',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_tanzania_buf20_vbuf20_visulcrec_SVM_svmC_SVC_kLINEAR_cdef_gdef_nudef_dpVoting'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [3],
    extra_class_names: ['mangroves']
  },
  {
    dataset_id: 'chaco_AE2020_RF_nT90',
    aoi_name: 'Chaco',
    method_name: 'RF',
    image: ee.Image(
      'projects/hardy-tenure-383607/assets/DryForm_Project/Classification/' +
      'Class_AE2020_chaco_buf20_vbuf20_visulcrec_RF_nT90_vpsdef_mlp1_bf0p5_mNdef_se6769'
    ),
    band: null,
    scale: DEFAULT_SCALE,
    extra_class_values: [],
    extra_class_names: []
  }
];


// ======================================================
// 3. UNIQUE AOI CONFIGS FOR CLEAN DISPLAY
// ======================================================

var UNIQUE_AOI_CONFIGS = [];
var SEEN_AOIS = {};

DATASETS.forEach(function(cfg) {
  if (!SEEN_AOIS[cfg.aoi_name]) {
    SEEN_AOIS[cfg.aoi_name] = true;
    UNIQUE_AOI_CONFIGS.push(cfg);
  }
});


// ======================================================
// 4. HELPER FUNCTIONS
// ======================================================

function zeroIfNull(value) {
  return ee.Number(
    ee.Algorithms.If(
      ee.Algorithms.IsEqual(value, null),
      0,
      value
    )
  );
}


// Return target class values as a client-side list.
// Default with INCLUDE_EXTRA_CLASSES = true:
//   [0, 3] for datasets where extra_class_values = [3]
//   [0] for datasets where extra_class_values = []
function getTargetClasses(cfg) {
  var classes = [TREE_CLASS_VALUE];

  if (INCLUDE_EXTRA_CLASSES) {
    var extras = cfg.extra_class_values || [];
    extras.forEach(function(v) {
      if (classes.indexOf(v) === -1) {
        classes.push(v);
      }
    });
  }

  return classes;
}


function getTargetClassLabel(cfg) {
  var classes = getTargetClasses(cfg);
  var names = ['tree_cover'];

  if (INCLUDE_EXTRA_CLASSES) {
    var extraNames = cfg.extra_class_names || [];
    extraNames.forEach(function(n) {
      names.push(n);
    });
  }

  return names.join('+') + ' | class_values=' + classes.join(',');
}


// Get selected band name for reporting.
function getBandName(cfg) {
  if (cfg.band === null || cfg.band === undefined || cfg.band === '') {
    return ee.String(cfg.image.bandNames().get(0));
  } else {
    return ee.String(cfg.band);
  }
}


// Get classification image.
// By default, the first band is selected and renamed to 'class'.
function getClassImage(cfg) {
  var image = cfg.image;

  if (cfg.band === null || cfg.band === undefined || cfg.band === '') {
    return image.select(0).rename('class');
  } else {
    return image.select(cfg.band).rename('class');
  }
}


// Derive AOI from the classification image itself.
function getImageAOI(cfg) {
  var classImage = getClassImage(cfg);

  var footprint = classImage.geometry();
  var bbox = footprint.bounds(1);

  return USE_BOUNDING_BOX ? bbox : footprint;
}


// Create an AOI feature for display and diagnostics.
function getImageAOIFeature(cfg) {
  var aoi = getImageAOI(cfg);

  return ee.Feature(aoi, {
    'dataset_id': cfg.dataset_id,
    'aoi_name': cfg.aoi_name,
    'method_name': cfg.method_name,
    'aoi_source': USE_BOUNDING_BOX ? 'image_footprint_bounding_box' : 'image_footprint'
  });
}


// Creates a binary mask for the target classes.
// By default:
//   - Caatinga, Cerrado, Tanzania: class 0 + class 3
//   - Chaco: class 0 only
function makeTargetClassMask(cfg) {
  var classImage = getClassImage(cfg);
  var targetClasses = getTargetClasses(cfg);

  var targetOnes = targetClasses.map(function() {
    return 1;
  });

  var targetMask = classImage
    .remap(targetClasses, targetOnes, 0)
    .eq(1)
    .selfMask()
    .rename('target_class_mask');

  return targetMask;
}


// Creates area image in m² for the target classes.
function makeAreaImage(cfg) {
  var areaImage = makeTargetClassMask(cfg)
    .multiply(ee.Image.pixelArea())
    .rename('area_m2');

  return areaImage;
}


// Creates area image representing valid data coverage.
function makeValidDataAreaImage(cfg) {
  var classImage = getClassImage(cfg);

  var validAreaImage = classImage
    .mask()
    .selfMask()
    .multiply(ee.Image.pixelArea())
    .rename('valid_data_area_m2');

  return validAreaImage;
}


// ======================================================
// 5. GRID CREATION
// ======================================================

function makeGrid(aoi) {
  var gridProjection = ee.Projection('EPSG:3857');

  var grid = aoi
    .coveringGrid(gridProjection, GRID_SIZE_M)
    .filterBounds(aoi)
    .map(function(cell) {
      var clippedGeom = cell.geometry().intersection(aoi, 1);
      var tileAreaM2 = clippedGeom.area(1);

      return ee.Feature(clippedGeom)
        .set('tile_id', cell.id())
        .set('tile_area_m2', tileAreaM2)
        .set('tile_area_km2', tileAreaM2.divide(1e6));
    })
    .filter(ee.Filter.gt('tile_area_m2', 0));

  return grid;
}


// Create grid features for display.
// Calculated only once per AOI name, not once per model.
function getGridForDisplay(cfg) {
  var aoi = getImageAOI(cfg);
  var grid = makeGrid(aoi);

  grid = grid.map(function(tile) {
    return tile.set({
      'aoi_name': cfg.aoi_name,
      'representative_dataset_id': cfg.dataset_id,
      'grid_size_m': GRID_SIZE_M
    });
  });

  return grid;
}


// ======================================================
// 6. DIRECT CALCULATION OVER FULL IMAGE-DERIVED AOI
// ======================================================

function calculateWholeImageAOI(cfg) {
  var aoi = getImageAOI(cfg);

  var areaImage = makeAreaImage(cfg);
  var countImage = makeTargetClassMask(cfg);
  var validAreaImage = makeValidDataAreaImage(cfg);

  var statsImage = areaImage
    .addBands(countImage)
    .addBands(validAreaImage);

  var stats = statsImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: aoi,
    scale: cfg.scale,
    maxPixels: MAX_PIXELS_DIRECT,
    tileScale: TILE_SCALE,
    bestEffort: false
  });

  var targetAreaM2 = zeroIfNull(stats.get('area_m2'));
  var pixelCount = zeroIfNull(stats.get('target_class_mask'));
  var validDataAreaM2 = zeroIfNull(stats.get('valid_data_area_m2'));

  var aoiAreaM2 = aoi.area(1);

  var percentOfAOI = ee.Number(
    ee.Algorithms.If(
      aoiAreaM2.gt(0),
      targetAreaM2.divide(aoiAreaM2).multiply(100),
      0
    )
  );

  var percentOfValidData = ee.Number(
    ee.Algorithms.If(
      validDataAreaM2.gt(0),
      targetAreaM2.divide(validDataAreaM2).multiply(100),
      0
    )
  );

  return ee.Feature(null, {
    'dataset_id': cfg.dataset_id,
    'aoi_name': cfg.aoi_name,
    'method_name': cfg.method_name,
    'band_used': getBandName(cfg),
    'target_class_label': getTargetClassLabel(cfg),
    'target_class_values': getTargetClasses(cfg).join(','),
    'include_extra_classes': INCLUDE_EXTRA_CLASSES,
    'method': 'whole_image_aoi',
    'aoi_source': USE_BOUNDING_BOX ? 'image_footprint_bounding_box' : 'image_footprint',
    'scale_m': cfg.scale,
    'grid_size_m': 0,
    'number_of_tiles': 0,
    'target_area_m2': targetAreaM2,
    'target_area_ha': targetAreaM2.divide(1e4),
    'target_area_km2': targetAreaM2.divide(1e6),
    'image_aoi_area_km2': aoiAreaM2.divide(1e6),
    'valid_data_area_km2': validDataAreaM2.divide(1e6),
    'percent_of_image_aoi': percentOfAOI,
    'percent_of_valid_data_area': percentOfValidData,
    'pixel_count_target_classes': pixelCount
  });
}


// ======================================================
// 7. GRID-BASED CALCULATION
// ======================================================

function calculateOneTile(cfg, tileFeature) {
  var geom = tileFeature.geometry();

  var areaImage = makeAreaImage(cfg);
  var countImage = makeTargetClassMask(cfg);
  var validAreaImage = makeValidDataAreaImage(cfg);

  var statsImage = areaImage
    .addBands(countImage)
    .addBands(validAreaImage);

  var stats = statsImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geom,
    scale: cfg.scale,
    maxPixels: MAX_PIXELS_TILE,
    tileScale: TILE_SCALE,
    bestEffort: false
  });

  var targetAreaM2 = zeroIfNull(stats.get('area_m2'));
  var pixelCount = zeroIfNull(stats.get('target_class_mask'));
  var validDataAreaM2 = zeroIfNull(stats.get('valid_data_area_m2'));

  return ee.Feature(null, {
    'dataset_id': cfg.dataset_id,
    'aoi_name': cfg.aoi_name,
    'method_name': cfg.method_name,
    'band_used': getBandName(cfg),
    'target_class_label': getTargetClassLabel(cfg),
    'target_class_values': getTargetClasses(cfg).join(','),
    'include_extra_classes': INCLUDE_EXTRA_CLASSES,
    'method': 'grid_tile',
    'scale_m': cfg.scale,
    'grid_size_m': GRID_SIZE_M,
    'tile_id': tileFeature.get('tile_id'),
    'tile_area_km2': ee.Number(tileFeature.get('tile_area_km2')),
    'target_area_m2': targetAreaM2,
    'target_area_ha': targetAreaM2.divide(1e4),
    'target_area_km2': targetAreaM2.divide(1e6),
    'valid_data_area_km2': validDataAreaM2.divide(1e6),
    'pixel_count_target_classes': pixelCount
  });
}


function calculateImageAOIWithGrid(cfg) {
  var aoi = getImageAOI(cfg);
  var grid = makeGrid(aoi);

  var tileResults = grid.map(function(tile) {
    return calculateOneTile(cfg, tile);
  });

  var targetAreaM2 = ee.Number(tileResults.aggregate_sum('target_area_m2'));
  var pixelCount = ee.Number(tileResults.aggregate_sum('pixel_count_target_classes'));

  var validDataAreaKm2 = ee.Number(tileResults.aggregate_sum('valid_data_area_km2'));
  var validDataAreaM2 = validDataAreaKm2.multiply(1e6);

  var aoiAreaM2 = aoi.area(1);

  var percentOfAOI = ee.Number(
    ee.Algorithms.If(
      aoiAreaM2.gt(0),
      targetAreaM2.divide(aoiAreaM2).multiply(100),
      0
    )
  );

  var percentOfValidData = ee.Number(
    ee.Algorithms.If(
      validDataAreaM2.gt(0),
      targetAreaM2.divide(validDataAreaM2).multiply(100),
      0
    )
  );

  return ee.Feature(null, {
    'dataset_id': cfg.dataset_id,
    'aoi_name': cfg.aoi_name,
    'method_name': cfg.method_name,
    'band_used': getBandName(cfg),
    'target_class_label': getTargetClassLabel(cfg),
    'target_class_values': getTargetClasses(cfg).join(','),
    'include_extra_classes': INCLUDE_EXTRA_CLASSES,
    'method': 'grid_sum',
    'aoi_source': USE_BOUNDING_BOX ? 'image_footprint_bounding_box' : 'image_footprint',
    'scale_m': cfg.scale,
    'grid_size_m': GRID_SIZE_M,
    'number_of_tiles': grid.size(),
    'target_area_m2': targetAreaM2,
    'target_area_ha': targetAreaM2.divide(1e4),
    'target_area_km2': targetAreaM2.divide(1e6),
    'image_aoi_area_km2': aoiAreaM2.divide(1e6),
    'valid_data_area_km2': validDataAreaM2.divide(1e6),
    'percent_of_image_aoi': percentOfAOI,
    'percent_of_valid_data_area': percentOfValidData,
    'pixel_count_target_classes': pixelCount
  });
}


function getTileLevelResultsForDataset(cfg) {
  var aoi = getImageAOI(cfg);
  var grid = makeGrid(aoi);

  var tileResults = grid.map(function(tile) {
    return calculateOneTile(cfg, tile);
  });

  return tileResults;
}


// ======================================================
// 8. RUN SUMMARY CALCULATION FOR ALL DATASETS
// ======================================================

var summaryFeatures = DATASETS.map(function(cfg) {
  return USE_GRID
    ? calculateImageAOIWithGrid(cfg)
    : calculateWholeImageAOI(cfg);
});

var summaryResults = ee.FeatureCollection(summaryFeatures);


// ======================================================
// 9. CREATE AOI AND GRID FEATURECOLLECTIONS FOR VISUAL CHECK
// ======================================================

// AOI features: one per dataset.
var allAoiFeatures = DATASETS.map(function(cfg) {
  return getImageAOIFeature(cfg);
});

var imageAOIsAllDatasets = ee.FeatureCollection(allAoiFeatures);


// Unique AOI features: one per AOI name.
var uniqueAoiFeatures = UNIQUE_AOI_CONFIGS.map(function(cfg) {
  return getImageAOIFeature(cfg);
});

var imageAOIsUnique = ee.FeatureCollection(uniqueAoiFeatures);


// Grid features: one grid per AOI name.
var displayGridList = UNIQUE_AOI_CONFIGS.map(function(cfg) {
  return getGridForDisplay(cfg);
});

var displayGrid = ee.FeatureCollection(displayGridList).flatten();


// ======================================================
// 10. PRINT AND DISPLAY
// ======================================================

if (SHOW_VIS) {
  print('Expected number of summary rows:', DATASETS.length);
  print('Number of unique AOIs displayed:', UNIQUE_AOI_CONFIGS.length);
  print('INCLUDE_EXTRA_CLASSES:', INCLUDE_EXTRA_CLASSES);
  print('Summary results: one row per dataset', summaryResults);
  print('Image-derived AOIs: one feature per dataset', imageAOIsAllDatasets);
  print('Unique image-derived AOIs: one feature per AOI name', imageAOIsUnique);

  Map.addLayer(
    imageAOIsUnique.style({
      color: 'red',
      fillColor: '00000000',
      width: 3
    }),
    {},
    'Unique image-derived AOIs'
  );

  Map.addLayer(
    imageAOIsAllDatasets.style({
      color: 'yellow',
      fillColor: '00000000',
      width: 1
    }),
    {},
    'All dataset AOIs',
    false
  );

  if (USE_GRID && SHOW_GRID) {
    print('Grid used for display, one grid per AOI name', displayGrid);
    print('Grid size in metres:', GRID_SIZE_M);

    Map.addLayer(
      displayGrid.style({
        color: 'orange',
        fillColor: '00000000',
        width: 1
      }),
      {},
      'Grid tiles used for calculation'
    );
  }

  // Add each target mask as a separate layer.
  // These are turned off by default to avoid visual clutter.
  DATASETS.forEach(function(cfg) {
    Map.addLayer(
      makeTargetClassMask(cfg),
      {palette: ['blue']},
      'Target classes - ' + cfg.dataset_id,
      false
    );
  });

  Map.centerObject(imageAOIsUnique, 4);
}


// ======================================================
// 11. EXPORT SETTINGS
// ======================================================

var SUMMARY_SELECTORS = [
  'dataset_id',
  'aoi_name',
  'method_name',
  'band_used',
  'target_class_label',
  'target_class_values',
  'include_extra_classes',
  'method',
  'aoi_source',
  'scale_m',
  'grid_size_m',
  'number_of_tiles',
  'target_area_m2',
  'target_area_ha',
  'target_area_km2',
  'image_aoi_area_km2',
  'valid_data_area_km2',
  'percent_of_image_aoi',
  'percent_of_valid_data_area',
  'pixel_count_target_classes'
];

var TILE_SELECTORS = [
  'dataset_id',
  'aoi_name',
  'method_name',
  'band_used',
  'target_class_label',
  'target_class_values',
  'include_extra_classes',
  'method',
  'scale_m',
  'grid_size_m',
  'tile_id',
  'tile_area_km2',
  'target_area_m2',
  'target_area_ha',
  'target_area_km2',
  'valid_data_area_km2',
  'pixel_count_target_classes'
];


// ======================================================
// 12. EXPORT SUMMARY TABLE
// ======================================================

// Option A: one combined task.
// With the current list, this should create 1 task and 6 rows.
if (!EXPORT_SEPARATE_TASKS) {
  Export.table.toDrive({
    collection: summaryResults,
    description: EXPORT_NAME,
    folder: EXPORT_FOLDER,
    fileNamePrefix: EXPORT_NAME,
    fileFormat: 'CSV',
    selectors: SUMMARY_SELECTORS
  });
}


// Option B: one task per dataset.
// With the current list, this should create 6 tasks.
if (EXPORT_SEPARATE_TASKS) {
  DATASETS.forEach(function(cfg) {
    var oneResult = ee.FeatureCollection([
      USE_GRID
        ? calculateImageAOIWithGrid(cfg)
        : calculateWholeImageAOI(cfg)
    ]);

    Export.table.toDrive({
      collection: oneResult,
      description: EXPORT_NAME + '_' + cfg.dataset_id,
      folder: EXPORT_FOLDER,
      fileNamePrefix: EXPORT_NAME + '_' + cfg.dataset_id,
      fileFormat: 'CSV',
      selectors: SUMMARY_SELECTORS
    });
  });
}


// ======================================================
// 13. OPTIONAL TILE-LEVEL EXPORT
// ======================================================

if (USE_GRID && EXPORT_TILE_LEVEL_RESULTS) {

  var tileResultsList = DATASETS.map(function(cfg) {
    return getTileLevelResultsForDataset(cfg);
  });

  var tileResults = ee.FeatureCollection(tileResultsList).flatten();

  if (SHOW_VIS) {
    print('Tile-level results', tileResults);
  }

  Export.table.toDrive({
    collection: tileResults,
    description: EXPORT_NAME + '_tile_level',
    folder: EXPORT_FOLDER,
    fileNamePrefix: EXPORT_NAME + '_tile_level',
    fileFormat: 'CSV',
    selectors: TILE_SELECTORS
  });
}
