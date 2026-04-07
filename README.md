# DryForM

DryForM is a **Google Earth Engine (GEE) workflow** for dry-forest and tree-cover mapping, model training, post-processing, disturbance analysis, and interactive time-series exploration.

The repository contains the script pipeline developed in the DryForM exploratory work (2022–2024), organized as numbered modules that can be run step-by-step in GEE. AlphaEarth modules have been added a posteriori, between 2025 & 2026.

---

## What this repository contains

This project is a scripted workflow (mostly JavaScript for GEE Code Editor) covering:

- creation of a sampling framework from multiple land-cover sources,
- ground-truth preparation and balancing,
- Sentinel-1/Sentinel-2 preprocessing,
- Random Forest training and inference,
- optional object-based segmentation,
- post-processing and area summaries,
- disturbance detection with CCDC,
- an app-like time-series explorer.

All major modules are under `DryForM_Workflow/` and are prefixed with step numbers to indicate execution order.

---

## Repository structure

```text
DryForM_Workflow/
├── 1_SamplingFramework/
│   ├── 1_0_LCProc_v3_2
│   └── 1_1_Export2Drive_Optional
├── 2_Samples/
│   ├── 2_0_AutoSampling
│   ├── 2_1_GroundTruth_Visu
│   ├── 2_2_BalanceGT
│   └── 2_3_Separability
├── 3_Preprocessing/
│   ├── 3_0_PrepS1S2_v9_(working_Allinone)
│   └── s1_code/
├── 4_Segmentation/
│   └── 4_0_SNIC_Segmentation_ObjectOriented
├── 5_Training_Inference/
│   ├── 5_1_HyperparameterTunning
│   ├── 5_2_Training_withAutoSample
│   ├── 5_2_Training_withGroundTruth
│   ├── 5_3_ApplySavedModel_Optional
│   ├── 5_Training_Inference_5_2_Training_wtihGroundTruth_Embeds
│   └── 5_Training_Inference_5_2_Training_wtihGroundTruth_Embeds_BenchmarkMode
├── 6_Postprocessing/
│   └── 6_0_PostProc_v1
├── 7_Disturbance/
│   ├── 7_0_CCDC_InspectPixels_v3
│   ├── 7_1_CCDC_CreateAutomated_v3
│   ├── 7_2_CCDC_Extract_NonAutomated_v3
│   └── req/
├── 8_Utils/
│   ├── 8_0_Visualize_ClassificationResults
│   ├── 8_1_recurrent_IC_removal
│   └── 8_2_CalculateAreas
└── 9_App/
    ├── Time Series Explorer with images_df_vd_b2v10
    └── req/
```

> Note: scripts are stored without `.js` extensions, but are intended for Google Earth Engine JavaScript workflows.

---

## Workflow overview (recommended order)

### 1) Sampling framework
- **`1_0_LCProc_v3_2`** builds a preliminary LC reference layer from multiple global products and AOIs.
- **`1_1_Export2Drive_Optional`** optionally exports that layer to Google Drive.

### 2) Sample preparation
- **`2_0_AutoSampling`** generates auto-sampled points from step 1 outputs.
- **`2_1_GroundTruth_Visu`** loads/visualizes manually interpreted ground truth.
- **`2_2_BalanceGT`** balances class distributions for training/validation.
- **`2_3_Separability`** computes separability metrics (e.g., Jeffries–Matusita).

### 3) S1/S2 preprocessing
- **`3_0_PrepS1S2_v9_(working_Allinone)`** prepares multi-temporal Sentinel-1/Sentinel-2 composites and exports tiled assets.
- `s1_code/` includes helper modules required by preprocessing.

### 4) (Optional) object-based segmentation
- **`4_0_SNIC_Segmentation_ObjectOriented`** runs SNIC segmentation for object-oriented workflows.

### 5) Training and inference
- **`5_1_HyperparameterTunning`** tunes Random Forest parameters.
- **`5_2_Training_withGroundTruth`** runs supervised RF training with visual GT.
- **`5_2_Training_withAutoSample`** alternative training with auto-sampled GT.
- **`5_3_ApplySavedModel_Optional`** applies previously exported model assets.
- Embedding-based variants are provided in:
  - `5_Training_Inference_5_2_Training_wtihGroundTruth_Embeds`
  - `5_Training_Inference_5_2_Training_wtihGroundTruth_Embeds_BenchmarkMode`

### 6) Post-processing
- **`6_0_PostProc_v1`** mitigates no-data artifacts in classification outputs.

### 7) Disturbance analysis (CCDC)
- **`7_1_CCDC_CreateAutomated_v3`** creates CCDC outputs.
- **`7_2_CCDC_Extract_NonAutomated_v3`** extracts disturbance-relevant bands.
- **`7_0_CCDC_InspectPixels_v3`** interactive per-pixel inspection.

### 8) Utilities
- visualization, image collection maintenance helpers, and area statistics.

### 9) App / integration
- **`Time Series Explorer with images_df_vd_b2v10`** integrates classification, imagery chips, temporal profiles, and disturbance layers.

---

## Prerequisites

- A Google Earth Engine account with permission to run and export tasks.
- Access to required GEE assets referenced in scripts (AOIs, GT, intermediate outputs).
- (Optional) OEEex plugin or task management strategy for large export batches.

---

## How to use

1. Open [Google Earth Engine Code Editor](https://code.earthengine.google.com/).
2. Copy a script from this repository into a new GEE script.
3. Update parameters in each script (AOI, year, asset paths, class fields, export paths).
4. Run modules in numbered order (1 → 9), using optional modules as needed.
5. Validate outputs after each stage before proceeding.

Because many scripts reference private/project assets, adaptation to your own GEE assets is expected.

---

## Areas of interest and classes

The workflow is configured around multiple AOIs (e.g., Chaco, Caatinga, Cerrado, Tanzania/Tanganyika in different script versions) and supports reclassified LC targets for model training.

Class schemas and remapping arrays are defined directly in training scripts; adjust them consistently across balancing, training, validation, and visualization modules.

---

## Outputs

Depending on the executed path and options, outputs may include:

- LC proxy/sampling framework layers,
- training and validation sample assets,
- quarterly (or alternative interval) S1/S2 composites,
- trained classifier assets and classified rasters,
- post-processed classification maps,
- CCDC disturbance layers,
- summary tables and visualization layers.

---

## Important notes

- This repo captures working research scripts; variable names, comments, and assumptions are tuned to DryForM processing context.
- Some modules are explicitly marked as optional or experimental.
- Several scripts note known limitations (e.g., Sentinel-1 overlap artifacts, non-automated extraction steps) and ongoing optimization ideas.

---

## Contributing

Contributions are welcome for:

- documentation improvements,
- script refactoring and parameterization,
- reproducibility improvements (config-driven assets/AOI setup),
- automation of currently manual steps.

When submitting changes, please keep the numbered workflow logic intact and document any breaking changes in step dependencies.
