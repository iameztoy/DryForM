
//***********************************************************
// DRYFORM - Step 8.2 - Calculate Areas
//*********************************************************** 

/*
Author: Iban Ameztoy | Joint Research Center - European Commission | DryForM Exploratory Research Project 2022-2024 - Units S.4/D.1

Adapted from a script by C. Bourgoin.
*/

var dataset = ee.ImageCollection('JRC/GFC2020/V1').mosaic(); //Replace this by the target dataset

var visualization = {
  bands: ['Map'],
  palette: ['4D9221']};

var Zones=ee.FeatureCollection('users/bourgoinclement2/World_UNctry_grid');//From Clement Bourgoin


var WC2020 = ee.ImageCollection("ESA/WorldCover/v100").first().unmask();
Map.addLayer(WC2020);
var WC2020_land = (WC2020.gte(1)).and(WC2020.neq(80));
Map.addLayer(WC2020_land.updateMask(WC2020_land));

var dataset_m = dataset.unmask().updateMask(WC2020_land);
Map.addLayer(dataset_m.updateMask(dataset_m), {}, 'EC JRC Global forest cover 2020 – V1 m');

var AllClasses = ee.Image.cat(
      dataset_m.eq(1).rename('Forest'),  
      dataset_m.eq(0).rename('Nonforest'));

var LOOPsamples= function(feature) {
  var vals = AllClasses.multiply(ee.Image.pixelArea()).reduceRegion({
    reducer: ee.Reducer.sum(), 
    geometry: feature.geometry(),
    scale: 10,
    maxPixels: 5e9,
  });
  return ee.Feature(null, vals).copyProperties(feature, feature.propertyNames());
};

var LOOPresult2=Zones.map(LOOPsamples);

Export.table.toDrive({
	collection: LOOPresult2,
	description: 'JRC_GFC2020_V1_F_NF_AreaEstimates',
	folder: '',
	fileNamePrefix: 'JRC_GFC2020_V1_F_NF_AreaEstimates',
});


Map.addLayer(Zones);
Map.setCenter(0.0, 0.0, 2);
Map.addLayer(dataset, visualization, 'EC JRC Global forest cover 2020 – V1');



