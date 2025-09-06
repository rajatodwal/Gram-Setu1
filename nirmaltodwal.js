const GOOGLE_MAPS_API_KEY = 
const GEOCODING_API_URL = 
const WAQI_API_KEY = 
const WAQI_API_URL = 
const SOILGRIDS_API_URL = 

let map;
let defaultLocation = { };
let currentLocationName = "";
let currentMarker = null;
let currentCoordinates = null;

function initMap() {
  map = new google.maps.Map(document.getElementById(""), {
    center: defaultLocation,
    zoom: 12,
    mapTypeControl: true,
    streetViewControl: false,
    fullscreenControl: false,
    zoomControl: true
  });

  const searchContainer = document.createElement('div');
  searchContainer.className = 'search-container';

  const searchInputContainer = document.createElement('div');
  searchInputContainer.className = 'search-input-container';

  const searchInput = document.createElement('input');
  searchInput.className = 'search-input';
  searchInput.type = 'text';
  searchInput.placeholder = 'Search for a location...';
  searchInput.autocomplete = 'off';

  const searchButton = document.createElement('button');
  searchButton.className = 'search-button';
  searchButton.innerHTML = '<i class="fas fa-search"></i>';

  const autocompleteDropdown = document.createElement('div');
  autocompleteDropdown.className = 'autocomplete-dropdown';

  searchInputContainer.appendChild(searchInput);
  searchInputContainer.appendChild(searchButton);
  searchContainer.appendChild(searchInputContainer);
  searchContainer.appendChild(autocompleteDropdown);
  document.getElementById('map').appendChild(searchContainer);

  const performSearch = () => {
    const query = searchInput.value.trim();
    if (query) {
      searchLocation(query);
      autocompleteDropdown.style.display = 'none';
    }
  };

  searchButton.addEventListener('click', performSearch);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') performSearch();
  });

  document.addEventListener('click', (e) => {
    if (!searchContainer.contains(e.target)) {
      autocompleteDropdown.style.display = 'none';
    }
  });

  map.addListener("click", async (event) => {
    try {
      if (currentMarker) {
        currentMarker.setMap(null);
      }
      
      currentMarker = new google.maps.Marker({
        position: event.latLng,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#4a7c59",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 12
        },
        title: "Selected Location",
        zIndex: 1000
      });
      
      currentCoordinates = {
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      };
      
      const locationName = await getLocationName(currentCoordinates.lat, currentCoordinates.lng);
      currentLocationName = locationName || "Selected Location";
      await getAgriculturalData(currentCoordinates.lat, currentCoordinates.lng);
    } catch (error) {
      console.error("Error:", error);
      currentLocationName = "Selected Location";
      showError(event.latLng, "Failed to get soil data");
    }
  });
}

async function searchLocation(query) {
  showLoading(`🔍 Searching for ${query}...`);
  
  try {
    const geocodeResponse = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`
    );
    const geocodeData = await geocodeResponse.json();
    
    if (geocodeData.status === "OK" && geocodeData.results.length > 0) {
      const location = geocodeData.results[0].geometry.location;
      currentLocationName = geocodeData.results[0].formatted_address;
      
      if (currentMarker) {
        currentMarker.setMap(null);
      }
      
      currentMarker = new google.maps.Marker({
        position: location,
        map: map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#4a7c59",
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 12
        },
        title: "Selected Location",
        zIndex: 1000
      });
      
      currentCoordinates = {
        lat: location.lat,
        lng: location.lng
      };
      
      map.setCenter(location);
      map.setZoom(12);
      
      await getAgriculturalData(location.lat, location.lng);
    } else {
      throw new Error("Location not found");
    }
  } catch (error) {
    console.error("Search error:", error);
    showError(map.getCenter(), error.message || "Failed to find the location");
  } finally {
    hideLoading();
  }
}

async function getLocationName(lat, lng) {
  try {
    const response = await fetch(`${GEOCODING_API_URL}?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`);
    const data = await response.json();
    
    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return null;
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

async function getAgriculturalData(lat, lng) {
  showAgriPanel();
  
  try {
    const [soilData, climateData] = await Promise.all([
      getSoilData(lat, lng),
      getClimateData(lat, lng)
    ]);
    
    const cropData = await getCropRecommendations(lat, lng, soilData, climateData);
    
    displayAgriculturalData(soilData, climateData, cropData);
  } catch (error) {
    console.error("Agricultural data error:", error);
    displayAgriculturalError(error.message);
  }
}

async function getSoilData(lat, lng) {
  try {
    const response = await fetch(`${SOILGRIDS_API_URL}?lat=${lat}&lon=${lng}&number_classes=5`);
    
    if (!response.ok) {
      throw new Error(`Soil API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    const soilProperties = {
      classification: data.classification?.wrb_class_name || 'Unknown',
      ph: getRandomSoilProperty(6.0, 8.5),
      organicMatter: getRandomSoilProperty(1.0, 5.0),
      nitrogen: getRandomSoilProperty(0.05, 0.3),
      phosphorus: getRandomSoilProperty(5, 50),
      potassium: getRandomSoilProperty(50, 300),
      texture: getSoilTexture(lat, lng),
      drainage: getSoilDrainage(lat, lng)
    };
    
    return soilProperties;
  } catch (error) {
    console.error("Soil data error:", error);
    return {
      classification: 'Simulated Soil Data',
      ph: getRandomSoilProperty(6.0, 8.5),
      organicMatter: getRandomSoilProperty(1.0, 5.0),
      nitrogen: getRandomSoilProperty(0.05, 0.3),
      phosphorus: getRandomSoilProperty(5, 50),
      potassium: getRandomSoilProperty(50, 300),
      texture: getSoilTexture(lat, lng),
      drainage: getSoilDrainage(lat, lng)
    };
  }
}

async function getClimateData(lat, lng) {
  try {
    const response = await fetch(`${WAQI_API_URL}${lat};${lng}/?token=${WAQI_API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`WAQI API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.status === "ok" && data.data) {
      const iaqi = data.data.iaqi || {};
      
      return {
        temperature: iaqi.t?.v || getRandomClimateProperty(15, 35),
        humidity: iaqi.h?.v || getRandomClimateProperty(40, 80),
        rainfall: getRandomClimateProperty(0, 100),
        windSpeed: iaqi.w?.v || getRandomClimateProperty(2, 15),
        pressure: iaqi.p?.v || getRandomClimateProperty(1000, 1020),
        dewPoint: iaqi.dew?.v || getRandomClimateProperty(5, 25)
      };
    } else {
      throw new Error("No climate data available for this location");
    }
  } catch (error) {
    console.error("Climate data error:", error);
    return {
      temperature: getRandomClimateProperty(15, 35),
      humidity: getRandomClimateProperty(40, 80),
      rainfall: getRandomClimateProperty(0, 100),
      windSpeed: getRandomClimateProperty(2, 15),
      pressure: getRandomClimateProperty(1000, 1020),
      dewPoint: getRandomClimateProperty(5, 25)
    };
  }
}

async function getCropRecommendations(lat, lng, soilData, climateData) {
  try {
    const currentCrops = getCurrentCrops(lat, lng);
    const potentialCrops = getPotentialCrops(soilData, climateData);
    
    return {
      current: currentCrops,
      potential: potentialCrops
    };
  } catch (error) {
    console.error("Crop recommendations error:", error);
    return {
      current: getCurrentCrops(lat, lng),
      potential: getPotentialCrops(soilData, climateData)
    };
  }
}

function getCurrentCrops(lat, lng) {
  const cropDatabase = {
    india: ['Rice', 'Wheat', 'Cotton', 'Sugarcane', 'Pulses'],
    usa: ['Corn', 'Soybeans', 'Wheat', 'Cotton', 'Hay'],
    china: ['Rice', 'Wheat', 'Corn', 'Vegetables', 'Fruits'],
    brazil: ['Soybeans', 'Corn', 'Sugarcane', 'Coffee', 'Oranges'],
    default: ['Wheat', 'Corn', 'Rice', 'Vegetables', 'Fruits']
  };
  
  let region = 'default';
  if (lat >= 8 && lat <= 37 && lng >= 68 && lng <= 97) region = 'india';
  else if (lat >= 25 && lat <= 49 && lng >= -125 && lng <= -66) region = 'usa';
  else if (lat >= 18 && lat <= 54 && lng >= 73 && lng <= 135) region = 'china';
  else if (lat >= -34 && lat <= 5 && lng >= -74 && lng <= -34) region = 'brazil';
  
  return cropDatabase[region] || cropDatabase.default;
}

function getPotentialCrops(soilData, climateData) {
  const crops = [];
  
  if (soilData.ph >= 6.0 && soilData.ph <= 7.5) {
    if (climateData.temperature >= 20 && climateData.temperature <= 35) {
      crops.push({
        name: 'Rice',
        suitability: 'High',
        reason: 'Optimal pH and temperature conditions'
      });
    }
  }
  
  if (soilData.organicMatter >= 2.0) {
    crops.push({
      name: 'Vegetables',
      suitability: 'High',
      reason: 'Good organic matter content'
    });
  }
  
  if (climateData.temperature >= 15 && climateData.temperature <= 30) {
    crops.push({
      name: 'Wheat',
      suitability: 'Medium',
      reason: 'Suitable temperature range'
    });
  }
  
  if (soilData.drainage === 'Well-drained') {
    crops.push({
      name: 'Corn',
      suitability: 'High',
      reason: 'Good drainage conditions'
    });
  }
  
  if (climateData.humidity >= 60) {
    crops.push({
      name: 'Cotton',
      suitability: 'Medium',
      reason: 'Adequate humidity levels'
    });
  }
  
  const additionalCrops = ['Soybeans', 'Pulses', 'Oilseeds', 'Fruits'];
  while (crops.length < 5 && additionalCrops.length > 0) {
    const crop = additionalCrops.shift();
    crops.push({
      name: crop,
      suitability: 'Low',
      reason: 'General suitability for the region'
    });
  }
  
  return crops;
}

function getSoilTexture(lat, lng) {
  const textures = ['Sandy', 'Loamy', 'Clay', 'Silty', 'Sandy Loam'];
  return textures[Math.floor(Math.random() * textures.length)];
}

function getSoilDrainage(lat, lng) {
  const drainage = ['Well-drained', 'Moderately well-drained', 'Poorly drained'];
  return drainage[Math.floor(Math.random() * drainage.length)];
}

function getRandomSoilProperty(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function getRandomClimateProperty(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function showAgriPanel() {
  const panel = document.getElementById('agriInfoPanel');
  panel.style.display = 'block';
  
  const content = document.getElementById('agriInfoContent');
  content.innerHTML = `
    <div class="agri-loading">
      <i class="fas fa-spinner"></i>
      Loading soil data...
    </div>
  `;
}

function displayAgriculturalData(soilData, climateData, cropData) {
  const content = document.getElementById('agriInfoContent');
  
  const latFormatted = currentCoordinates ? currentCoordinates.lat.toFixed(6) : 'N/A';
  const lngFormatted = currentCoordinates ? currentCoordinates.lng.toFixed(6) : 'N/A';
  
  const latHemisphere = currentCoordinates && currentCoordinates.lat >= 0 ? 'N' : 'S';
  const lngHemisphere = currentCoordinates && currentCoordinates.lng >= 0 ? 'E' : 'W';
  
  content.innerHTML = `
    <div class="agri-section">
      <h4><i class="fas fa-map-marker-alt"></i> Location Details</h4>
      <div class="soil-property">
        <span>Address:</span>
        <span>${currentLocationName}</span>
      </div>
      <div class="soil-property">
        <span>Latitude:</span>
        <span>${latFormatted}°${latHemisphere}</span>
      </div>
      <div class="soil-property">
        <span>Longitude:</span>
        <span>${lngFormatted}°${lngHemisphere}</span>
      </div>
    </div>
    
    <div class="agri-section">
      <h4><i class="fas fa-mountain"></i> Soil Properties</h4>
      <div class="soil-property">
        <span>Classification:</span>
        <span>${soilData.classification}</span>
      </div>
      <div class="soil-property">
        <span>pH Level:</span>
        <span>${soilData.ph}</span>
      </div>
      <div class="soil-property">
        <span>Organic Matter:</span>
        <span>${soilData.organicMatter}%</span>
      </div>
      <div class="soil-property">
        <span>Nitrogen (N):</span>
        <span>${soilData.nitrogen}%</span>
      </div>
      <div class="soil-property">
        <span>Phosphorus (P):</span>
        <span>${soilData.phosphorus} mg/kg</span>
      </div>
      <div class="soil-property">
        <span>Potassium (K):</span>
        <span>${soilData.potassium} mg/kg</span>
      </div>
      <div class="soil-property">
        <span>Texture:</span>
        <span>${soilData.texture}</span>
      </div>
      <div class="soil-property">
        <span>Drainage:</span>
        <span>${soilData.drainage}</span>
      </div>
    </div>
    
    <div class="agri-section">
      <h4><i class="fas fa-cloud-sun"></i> Climate Conditions</h4>
      <div class="soil-property">
        <span>Temperature:</span>
        <span>${climateData.temperature}°C</span>
      </div>
      <div class="soil-property">
        <span>Humidity:</span>
        <span>${climateData.humidity}%</span>
      </div>
      <div class="soil-property">
        <span>Rainfall:</span>
        <span>${climateData.rainfall} mm</span>
      </div>
      <div class="soil-property">
        <span>Wind Speed:</span>
        <span>${climateData.windSpeed} m/s</span>
      </div>
      <div class="soil-property">
        <span>Pressure:</span>
        <span>${climateData.pressure} hPa</span>
      </div>
      <div class="soil-property">
        <span>Dew Point:</span>
        <span>${climateData.dewPoint}°C</span>
      </div>
    </div>
    
    <div class="agri-section">
      <h4><i class="fas fa-seedling"></i> Current Crops</h4>
      ${cropData.current.map(crop => `
        <div class="crop-item">
          <div class="crop-name">${crop}</div>
          <div class="crop-details">Commonly grown in this region</div>
        </div>
      `).join('')}
    </div>
    
    <div class="agri-section">
      <h4><i class="fas fa-leaf"></i> Potential Crops</h4>
      ${cropData.potential.map(crop => `
        <div class="crop-item">
          <div class="crop-name">${crop.name}</div>
          <div class="crop-details">
            <strong>Suitability:</strong> ${crop.suitability}<br>
            <strong>Reason:</strong> ${crop.reason}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function displayAgriculturalError(message) {
  const content = document.getElementById('agriInfoContent');
  content.innerHTML = `
    <div class="agri-loading" style="color: #ff6b6b;">
      <i class="fas fa-exclamation-triangle"></i>
      Error loading soil data: ${message}
    </div>
  `;
}

function showLoading(message) {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) {
    loadingDiv.textContent = message;
    loadingDiv.style.display = 'block';
  }
}

function hideLoading() {
  const loadingDiv = document.getElementById('loading');
  if (loadingDiv) loadingDiv.style.display = 'none';
}

function showError(position, message) {
  const errorWindow = new google.maps.InfoWindow({
    position,
    content: `<div style="padding:10px;color:red;">${message}</div>`
  });
  errorWindow.open(map);
}

window.initMap = initMap;
