
//***********************************************************
// DRYFORM - Step 4 -Segmentation of preprocessed imagery
//***********************************************************

/*
Author: Iban Ameztoy | Joint Research Center - European Commission | DryForM Exploratory Research Project 2022-2024 - Units S.4/D.1

This piece of code is to export as an asset an all-in-one segmented Image Collection.
As input we use the preprocessed imagery that was also exported as an asset in a previous step. See section "3_Preprocessing".
It is also intended for testing purposes. Size segmentations (seeds): 12, 24 and 49. 
    Alternativelly 5, 10, 17 (or 18), 28 could be used (not 5 nor 10). 
    These correspond to the 4%, 30%, 50% and 80% of the area of the Ground Truth buffers, being the 100% equal to a half an hectare polygon.
First run uses all the available multitemporal bands (73)
    These can be further reduced both in the temporal and spectral domains by reducing the number of bands, indexes and glcm variables. 
    However, I want to use them all as to run a RF training step and check the importance table values. 

*/

// Area of Interest
var aoi = ee.FeatureCollection("users/iameztoy/dryform/AOIs/zone_Tanzania");
var aoib = aoi.geometry().buffer(300)

// Image Collection S1 + S2 + Indexes + GLCM variables

/*
// Bands based on Importance Table for RF: 80, default, 2, 0.5, 50 | First 30 features/bands
var bands = ("t0_B11", "t2_VH","t0_B12", "t2_B11", "t2_B12", "t0_VH", "t2_B8", "t0_gNDVI", "t3_B11", "t1_B11", "t0_gray_savg_glcm", "t3_B12",
             "t3_VH", "t1_gray_savg_glcm", "t3_gray_savg_glcm", "t3_gNDVI", "t1_B12", "t1_VH", "t0_MSAVI", "t3_MSAVI", "t3_VV", "t2_gray_savg_glcm",
              "t2_MSAVI", "t0_B3", "t2_gNDVI", "t2_VV", "t0_gray_idm_glcm", "t1_gNDVI", "t2_SI", "t3_gray_contrast_glcm");
*/

var target_image = ee.ImageCollection("projects/hardy-tenure-383607/assets/DryForm_Project/PreprocessedImagery/s1s2_Tanzania");

target_image = target_image.mosaic().clip(aoib)
//var bands = (["t0_B4", "t1_MSAVI"]) //e.g. "t0_B4", "t1_MSAVI"
//chao_ic = chao_ic.select(bands);

// SNIC parameters
var segsize = 28;
var comp = 0;
var conn = 8;
var nbsize = 256;

var seeds = ee.Algorithms.Image.Segmentation.seedGrid(segsize);

var snic = ee.Algorithms.Image.Segmentation.SNIC({
  image: target_image, 
  //size: 12,
  compactness: comp,  
  connectivity: conn, 
  neighborhoodSize: nbsize, 
  seeds: seeds
});

Export.image.toAsset({
  image: snic,
  description: 'Tanzania_SNIC_sNAc0c8n256se' +  segsize.toString(),
  assetId: 'projects/hardy-tenure-383607/assets/DryForm_Project/Segmentation/Tanzania_SNIC_sNAc0c8n256se' +  segsize.toString(),
  crs: "EPSG:4326",
  //crsTransform: proj_obj.transform,
    scale: 10,
  //region: geometry,
  maxPixels: 1e13
    
});


/*
Export.image.toAsset({
  image: snic,
  description: 'SNIC_Test',
  assetId: 'projects/dryform-383607/assets/SNIC_Test/test1',  // <> modify these
  region: geometry,
  scale: 10,
  crs: "EPSG:32658",
  maxPixels: 1e13
});
*/
