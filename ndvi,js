// Center map on Colorado Springs
Map.setCenter(-104.79, 38.83, 13);

////////////////////////////////////////////////////////////////////
// Imagery
////////////////////////////////////////////////////////////////////

// Import imagery
var sent2 = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")

// Filter image dates and cloud cover for summer
var summer = ee.Image(sent2.filterDate("2025-05-01", "2025-08-31")
.filterBounds(geometry)
.sort("CLOUD_COVERAGE_ASSESSMENT").first());

print(summer);

// Filter image dates and cloud cover for winter
var winter = ee.Image(sent2.filterDate("2024-12-05", "2025-03-31")
.filterBounds(geometry)
.sort("CLOUD_COVERAGE_ASSESSMENT").first());

print(winter)

////////////////////////////////////////////////////////////////////
// Constants
////////////////////////////////////////////////////////////////////

// Create a feature collections of 'forest' and 'grass' areas
var forest = ee.FeatureCollection(
  [uteValley, 
  palmerTrail,
  austinBluffs
  ]);
  
var grass = ee.FeatureCollection(
  [memorialPark,
  palmerBase,
  atb
    ]);

// RGB bands
var trueColor = {
  bands: ["B4", "B3", "B2"],
  min: 0,
  max: 3000
};

// Select bands from summer imagery for NDVI
var nir = summer.select('B8');
var red = summer.select('B4');

// Select bands from winter imagery for NDVI
var nir2 = winter.select('B8');
var red2 = winter.select('B4');

// NDVI Color Palette
var ndviParams = {min:-1, max:1, palette: ['blue','white','green']};

///////////////////////////////////////////////////////////////////
// Functions
///////////////////////////////////////////////////////////////////

// Input the equation for NDVI
function ndvi(nir, red) {
  return nir.subtract(red).divide(nir.add(red));
}

//////////////////////////////////////////////////////////////////
// Calculations
////////////////////////////////////////////////////////////////

// Calculate NDVI for each season
var ndvi_summer = ndvi(nir, red);
var ndvi_winter = ndvi(nir2, red2);

// Perform image differencing between two images
// Calculate the difference for each corresponding band
var difference = ndvi_summer.subtract(ndvi_winter);
// Define visualization parameters for the difference image
var visParams = {
  min: -2.0, // Negative values for decrease
  max: 2.0, // Positive values for increase
  palette: ['red','white','green'] // red for decrease, green for increase
};

//////////////////////////////////////////////////////////////////////////
// Map Layers
/////////////////////////////////////////////////////////////////////////

// Add true color layers to map
Map.addLayer(summer, trueColor, 'Summer');
Map.addLayer(winter, trueColor, 'Winter');

// Add NDVI layers to map
Map.addLayer(ndvi_summer, ndviParams, 'Summer NDVI');
print('Summer NDVI', ndvi_summer);
Map.addLayer(ndvi_winter, ndviParams, 'Winter NDVI');
print('Winter NDVI', ndvi_winter);

// Add difference image to map
Map.addLayer(difference, visParams, 'Difference');


///////////////////////////////////////////////////////////////////////////
//Histograms
//////////////////////////////////////////////////////////////////////////

// Create histograms for NDVI difference values
var histGrass = 
  ui.Chart.image.histogram({
    image: difference,
    region: grass,
    scale: 30,
    maxPixels: 1e10,
    maxBuckets: 20
  })
        .setSeriesNames([])
        .setOptions({
          title: 'NDVI Difference Histogram, Grass',
          hAxis: {
            title: 'Difference NDVI',
            titleTextStyle: {italic: false, bold: true},
          },
          vAxis:
              {title: 'Pixel Count', titleTextStyle: {italic: false, bold: true}},
          colors: ['0000ff']
        });
print(histGrass);

var histForest = 
  ui.Chart.image.histogram({
    image: difference,
    region: forest,
    scale: 30,
    maxPixels: 1e10,
    maxBuckets: 20
  })
        .setSeriesNames([])
        .setOptions({
          title: 'NDVI Difference Histogram, Forest',
          hAxis: {
            title: 'Difference NDVI',
            titleTextStyle: {italic: false, bold: true},
          },
          vAxis:
              {title: 'Pixel Count', titleTextStyle: {italic: false, bold: true}},
          colors: ['0000ff']
        });
print(histForest);

//////////////////////////////////////////////////
// Statistics
/////////////////////////////////////////////////

// Compute statistics for the 'difference' image over the grass sample regions
var statsGrass = difference.reduceRegion({
  reducer: ee.Reducer.mean()
              .combine(ee.Reducer.median(), '', true)
              .combine(ee.Reducer.stdDev(), '', true)
              .combine(ee.Reducer.minMax(), '', true),
              
  geometry: grass,
  scale: 30, 
  bestEffort: true
});

// Compute statistics for the 'difference' image over the forest sample regions
  reducer: ee.Reducer.mean()
              .combine(ee.Reducer.median(), '', true)
              .combine(ee.Reducer.stdDev(), '', true)
              .combine(ee.Reducer.minMax(), '', true),
  geometry: forest,
  scale: 30,        
  bestEffort: true  
});

// Print results
print('Grass stats:', statsGrass);
print('Forest stats:', statsForest);
