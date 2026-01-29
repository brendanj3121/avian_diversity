//////////////////////////////////////////////////////
// Imagery
/////////////////////////////////////////////////////

// Load NAIP ImageCollection for West COS
var naip1 = ee.ImageCollection('USDA/NAIP/DOQQ')
  .filterBounds(roiWest)
  .filterDate('2019-06-01', '2019-09-30');
// East COS  
var naip2 = ee.ImageCollection('USDA/NAIP/DOQQ')
  .filterBounds(roiEast)
  .filterDate('2019-06-01', '2019-09-30');

// NW COS
var naip3 = ee.ImageCollection('USDA/NAIP/DOQQ')
  .filterBounds(roiNW)
  .filterDate('2019-06-01', '2019-09-30');
  
// NE COS
var naip4 = ee.ImageCollection('USDA/NAIP/DOQQ')
  .filterBounds(roiNE)
  .filterDate('2019-06-01', '2019-09-30');

print(naip4);
// Select the first image
var west = naip1.first();
var east = naip2.first();
var nw = naip3.first();
var ne = naip4.first();

// Merge images into image collection and mosaic tiles
var merged = ee.ImageCollection([west, east, nw, ne]).mosaic();

// Add false color image to map
Map.addLayer(merged, {bands: ['N', 'R', 'G'], min: 0, max: 255}, 'Merged NAIP NIR');

////////////////////////////////////////////////////////////////////
// Map Layers
/////////////////////////////////////////////////////////////////////

// Select all bands (R, G, B, NIR)
var bands = merged.select(['R','G','B','N']);
// Compute average brightness across bands
var brightness = bands.reduce(ee.Reducer.mean());
// Visualize brightness as a gradient map
Map.addLayer(brightness, {min: 0, max: 255, palette: ['black','white']}, 'Brightness');

// Perform Canny edge detection using NIR band for vegetation detection.
var canny = ee.Algorithms.CannyEdgeDetector({
  image: merged.select('N'), threshold: 100, sigma: 1
});

// Convert canny values into binary values
var binaryEdges = canny.gt(0);
// Add canny edges to map
Map.addLayer(binaryEdges, {}, 'canny');

///////////////////////////////////////////////////////
// Funtions
//////////////////////////////////////////////////////

function mean(value, region) {
  return value.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: region,
    scale: 0.6,
    maxPixels: 1e9
  });
}

// Formula for Tree Grass Differentiation Index, use for classification
function tgdi(canny, brightness) {
  return canny.log10().multiply(-1).multiply(brightness)
}

/////////////////////////////////////////////////////////////
// Vegetation Classification
/////////////////////////////////////////////////////////////

// First classify UGS vs. non-UGS
// Merge the classes from training samples
var newfc = trees.merge(grass).merge(residential);

// Select the bands for training
var bands = ['R', 'G', 'B', 'N'];
// Sample the input imagery to get a FeatureCollection of our training data.
var training = merged.select(bands).sampleRegions({
  collection: newfc,
  properties: ['ugs'],
  scale: 30
});
// Accuracy assessment by cross validataion with random column, 
// split training data into training and validation sets
// Add random column to training data
var withRandom = training.randomColumn();

var split = 0.7;  // Roughly 70% training, 30% testing.
var trainingSet = withRandom.filter(ee.Filter.lt('random', split));
var validationSet = withRandom.filter(ee.Filter.gte('random', split));

// Make a Random Forest classifier and train it.
var classifier = ee.Classifier.smileRandomForest(10).train({
  features: trainingSet,
  classProperty: 'ugs',
  inputProperties: bands
});

// Classify the input imagery.
var classified = merged.select(bands).classify(classifier);
// Define a palette for the UGS classification.
var palette = [
  'e5c3c8', // non-ugs (0)  //  light pink
  '147505', //  ugs (1) // green
];

// Mask to show only greenspace
var ugsMask = classified.eq(1);
var maskedClassification = classified.updateMask(ugsMask);
// Add UGS Classification Mask layer
Map.addLayer(maskedClassification, {palette: palette}, 'UGS');

// Perform accuracy assessment
var validated = validationSet.classify(classifier);
var accuracy = validated.errorMatrix('ugs', 'classification').accuracy();
var kappa = validated.errorMatrix('ugs', 'classification').kappa();
print('Overall classification accuracy', accuracy);
print('Kappa', kappa);



//////////////////////////////////////////////////////////
// TGDI Classification
//////////////////////////////////////////////////////////

// Mask canny and brightness layers and merge to create TGDI calculation layer
var maskedEdges = binaryEdges.updateMask(ugsMask);
var maskedBrightness = brightness.updateMask(ugsMask);
var tgdiLayer = maskedEdges.addBands(maskedBrightness);

// Apply the SNIC algorithm to the image to create clusters
var snic = ee.Algorithms.Image.Segmentation.SNIC({
  image: tgdiLayer,
  size: 5,
  compactness: 0.1,
  connectivity: 8,
});

// Display the clusters.
Map.addLayer(snic.randomVisualizer(), null, 'Clusters');

// Extract cluster means
var cannyMean = snic.select('N_mean');
var brightnessMean = snic.select('mean_mean');

// Apply TGDI formula at cluster level
var tgdiCluster = tgdi(cannyMean, brightnessMean)

// Stack TGDI with the cluster labels
var tgdiWithClusters = tgdiCluster.addBands(snic.select('clusters'));

// Reduce per cluster
var tgdiPerCluster = tgdiWithClusters.reduceConnectedComponents({
  reducer: ee.Reducer.mean(),
  labelBand: 'clusters'
});

// Fix the tgdi classification so that it doesn't resample with zoom
var tgdiFixed = tgdiPerCluster
  .reproject ({
    crs: merged.projection(),
    scale: 1
  });

// Create a binary classification: 0 = below threshold grass, 1 = above threshold trees
var threshold = 30; 
var tgdiClass = tgdiFixed.gt(threshold);

// Visualize: 0 = yellow, 1 = green
Map.addLayer(tgdiClass, {min:0, max:1, palette:['yellow','green']}, 'TGDI');

///////////////////////////////////////////////////////////
// Stats Calculations
//////////////////////////////////////////////////////////

// Canny stats
var treesCanny = mean(binaryEdges, trees);
var grassCanny = mean(binaryEdges, grass);
print(treesCanny, 'Canny Mean Trees');
print(grassCanny, 'Canny Mean Grass');

// Brightness stats
var treesBrightness = mean(brightness, trees);
var grassBrightness = mean(brightness, grass);
print(treesBrightness, 'Brightness Mean Trees');
print (grassBrightness, 'Brightness Mean Grass');

// Create collection of observation points for TGDI stats
var points = ee.FeatureCollection([
  memorialPark, // Feature 0
  uteValley, // Feature 1
  palmerBase, //Feature 2
  palmerTrail, // Feature 3
  austinBluffs, // Feature 4
  atb // Feature 5
]);

// Create buffers around each point
var buffers = points.map(function(f) {
  return f.buffer(50);  // buffer size in meters
});

// Count pixels of each class inside each buffer
var stats = tgdiClass.reduceRegions({
  collection: buffers,
  reducer: ee.Reducer.frequencyHistogram(), // Histogram will count number of tree and grass pixels
  scale: 1
});

var statsWithPercents = stats.map(function(f) {
  var hist = ee.Dictionary(f.get('histogram'));
  var grassCount = ee.Number(hist.get('0')); // Grass has value 0
  var treeCount = ee.Number(hist.get('1')); // Tree has value 1
  var total = grassCount.add(treeCount);
  var grassPct = grassCount.divide(total).multiply(100);
  var treePct = treeCount.divide(total).multiply(100);
  return f.set({
    grassPct: grassPct,
    treePct: treePct
  });
});

print(statsWithPercents, 'Percent grass vs tree per buffer');

// Export CSV to Drive
Export.table.toDrive({
  collection: statsWithPercents,
  description: 'TGDI_Classification_Stats',
  fileFormat: 'CSV'
});
