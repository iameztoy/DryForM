
//***********************************************************
// DRYFORM - Step 5.3 - Apply Saved Model
//***********************************************************

/*
Author: Iban Ameztoy | Joint Research Center - European Commission | DryForM Exploratory Research Project 2022-2024 - Units S.4/D.1

This script implements the RF saved model over the pre-processed imagery. Models can be saved in step 5.2.
    This can be used to run inference over the same or different Area of Interest;
    The final/definitive model was trained using all the available bands (72);
      Therefore, if you intend to re-use this model, you should precompute and use all the bands created in the pre-processing step (section 3)

User should take into account that, as of May 2024, saved models cannot be "printed".
See GEE forum thread: https://groups.google.com/g/google-earth-engine-developers/c/njOjzcRJMB8/m/UVZYizj4BQAJ
Printing Feature Importance and Out of Bag error might be implemented in the future. 
*/

// Target imagery preprocessed in a previous step. See section 3.0

var target = ee.ImageCollection("projects/hardy-tenure-383607/assets/DryForm_Project/PreprocessedImagery/s1s2_Ecoz_12708").mosaic();
// target can be replaced by the pre-processed image collections of other areas of interest (e.g. Chaco, Caatinga, etc.)


// Prepare the classifier
var RF_ChacCaat = 'projects/hardy-tenure-383607/assets/DryForm_Project/ClassifierModels/ClassPB_chaco_caatinga_b20_nT130';
var savedClassifier = ee.Classifier.load(RF_ChacCaat); // Load the classifier
var classified = target.classify(savedClassifier); // Classify with saved classifier

// Apply masks for classes of interest
var classified_TC = classified.eq(0).selfMask(); // Select Only Tree Cover
var classified_shrubs = classified.eq(1).selfMask(); // Select Only Shrubs

// Visualization
var vp_s1s2 = {"opacity":1,"bands":["t0_B8","t1_B8","t2_B8"],"min":1,"max":144,"gamma":1};
Map.addLayer(target, vp_s1s2, "Multitemporal Imagery - B8"); //Visualize pre-computed image collection stack.
Map.addLayer(classified_TC, {palette:"green"}, "LC from Saved Model - Tree Cover", 1);
Map.addLayer(classified_shrubs, {palette:"orange"}, "LC from Saved Model - Shrubs", 0);
