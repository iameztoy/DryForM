
//***********************************************************
// DRYFORM - Step 2.2 - Ground Truth Balance
//***********************************************************


/*
Author: Iban Ameztoy | Joint Research Center - European Commission | DryForM Exploratory Research Project 2022-2024 - Units S.4/D.1

 The script shall be adequated if different ground truth data is used as an input.
   
   Notes:

 ** visu_lc attribute is the original disaggregated version of the visual interpretation step
        
        It includes 13 classes:
          tc1	1, tc2	1, tc3	1, shrub	2, owl	2, grass	3, grasstree	3, mangroves	4, Flooded Veg.	5
          built	6, PWater	7, SWater	0, Bare	9,  Crops	10
          Not Included: tc4, tc5, tc67, Snow, moss/lichen
 ** visulcrec attribute is the reclassified version of the disaggregated version (visu_lc). 
        It includes 9 classes:
          tc1	1, tc2	1, tc3	1, shrub	2, owl	2, grass	3, grasstree	3, mangroves	4, Flooded Veg.	5
          built	6, PWater	7, SWater	0, Bare	9,  Crops	10
          Not Included: tc4, tc5, tc67, Snow, moss/lichen

 For pixel based classification: We consider the TC class as a single set (TC1 + TC2 + TC3) -> Therefore, we should downsample the sample set.
 Exporting the filtered features as assets avoids to implement this repetitively in the Training phase. Thus, getting a consistent 
 and unique sample set and avoiding iterative randomness in the filtering process. This is needed to use always the same set while 
 implementing the hyperparameter tuning and training phase.
 
*/

var chaco_n = "chaco";
var caatinga_n = "caatinga";
var cerrado_n = "cerrado";
var tanzania_n = "tanzania";

var caatinga = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Caatinga");
var cerrado = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Cerrado");
var chaco = ee.FeatureCollection("users/iameztoy/dryform/AOIs/eco_zone_Chaco");
var tanzania = ee.FeatureCollection("users/iameztoy/dryform/AOIs/zone_Tanzania");

// Change this to filter the points in the target AOI
var aoi_n = tanzania_n;

// Imported Ground Truth - Original set
var GroundTruthPoint_DF = ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPoint_DF");
var GroundTruthPol_DF = ee.FeatureCollection("projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/GroundTruthPol_DF");

// Select either points or polygons
var Gtp = GroundTruthPoint_DF 

// Point or polygon filtering | change variable aoi_n to run on a different biome
var gtp_f = Gtp.filter(ee.Filter.eq('aoiname', aoi_n)); 
var gtp_tr =  gtp_f.filter(ee.Filter.eq('purp', "training"));
var gtp_vl =  gtp_f.filter(ee.Filter.eq('purp', "validation")); // Validation does not need to be balanced

print("Original Training", gtp_tr.size());
print("Original Validation", gtp_vl.size());

// In order to balance the class respect the other classes, the target column in randomized and merged again with the other classes.

    // Classes TC TC(1) + TC(2) + TC(3)
    // Total number of the three tree cover classes is 450 (tc1+tc2+tc3). Balanced samples are 150 approx.

var aTC = gtp_tr.filter(ee.Filter.lte("visu_lc", 3)); // First we select the Tree Cover class from the visu_lc attribute (Anything below or equal 3)
var bTC = aTC.randomColumn(); // We create a random values column
var cTC = bTC.filter('random > 0.65'); //We select a % over the random column. For random > 0 -> 450 classes. For 0.65: 159 samples 0.5: 221 samples
print("TC selected", cTC.size())

    // Classes Shrub(7 or 2) and OWL(8 or 2). There are different alternatives:
      // 1. Keep them separated (not very convenient for the pixel based approach), 2. Merge them, 3. Keep only shrub class 
      
var aSh = gtp_tr.filter(ee.Filter.eq("visu_lc", 7));

    // Class Grass(9 or 3) and GrassTree (10 or 3). There are different alternatives
      // 1. Keep them separated (not very convenient for the pixel based approach), 2. Merge them, 3. Keep only shrub class 

var aGr = gtp_tr.filter(ee.Filter.eq("visu_lc", 9));
var gt11 =  gtp_tr.filter(ee.Filter.gte("visu_lc", 11)); // Select all the other classes and merge


  // We merge the newly created columns into the final training set
gtp_tr = gt11.merge(cTC).merge(aSh).merge(aGr); 

// Rename the inputs | Final set for RF
var trainingGcp = gtp_tr;
var validationGcp = gtp_vl;

print("Training GCP Final", trainingGcp);
print("Validation GCP Final", validationGcp);

// Export to asset 
// Only the training dataset. The validation remains as it is; it does not need to be balanced.

Export.table.toAsset({
		collection: trainingGcp,
    description: "GTPoint_DF_Balanced_" + aoi_n,
    assetId: "projects/hardy-tenure-383607/assets/DryForm_Project/GroundTruth/" + "GTPoint_DF_Balanced_" + aoi_n,
//	maxVertices:,
})


Export.table.toDrive({
		collection: trainingGcp,
    description: "TrainingGCP_toDrive",
    folder: "exportGEE",
//	fileNamePrefix:,
    fileFormat: "SHP",
//	selectors:,
//	maxVertices:,
})
