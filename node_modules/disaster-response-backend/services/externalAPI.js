const axios = require('axios');

// API Keys (Add these to your .env file)
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// OpenWeatherMap API for weather and air quality data
class WeatherService {
  static async getCurrentWeather(lat, lon) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric`
      );
      
      return {
        temperature: response.data.main.temp,
        humidity: response.data.main.humidity,
        pressure: response.data.main.pressure,
        windSpeed: response.data.wind?.speed ? response.data.wind.speed * 3.6 : 0, // Convert m/s to km/h
        windDirection: response.data.wind?.deg || 0,
        visibility: response.data.visibility ? response.data.visibility / 1000 : 10, // Convert to km
        description: response.data.weather[0].description,
        icon: response.data.weather[0].icon,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Weather API error:', error.message);
      throw new Error('Failed to fetch weather data');
    }
  }

  static async getAirQuality(lat, lon) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}`
      );
      
      const pollutionData = response.data.list[0];
      
      return {
        aqi: pollutionData.main.aqi * 50, // Convert to standard AQI scale
        pm25: pollutionData.components.pm2_5,
        pm10: pollutionData.components.pm10,
        co: pollutionData.components.co,
        no2: pollutionData.components.no2,
        o3: pollutionData.components.o3,
        so2: pollutionData.components.so2,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Air Quality API error:', error.message);
      throw new Error('Failed to fetch air quality data');
    }
  }

  static async getWeatherForecast(lat, lon, days = 5) {
    try {
      const response = await axios.get(
        `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPENWEATHER_API_KEY}&units=metric&cnt=${days * 8}` // 8 forecasts per day (3-hour intervals)
      );
      
      return response.data.list.map(item => ({
        datetime: new Date(item.dt * 1000),
        temperature: item.main.temp,
        humidity: item.main.humidity,
        windSpeed: item.wind?.speed ? item.wind.speed * 3.6 : 0,
        description: item.weather[0].description,
        precipitation: item.rain?.['3h'] || item.snow?.['3h'] || 0
      }));
    } catch (error) {
      console.error('Weather Forecast API error:', error.message);
      throw new Error('Failed to fetch weather forecast');
    }
  }
}

// Earthquake data from USGS
class EarthquakeService {
  static async getRecentEarthquakes(lat, lon, radiusKm = 500, minMagnitude = 2.5) {
    try {
      const startTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // Last 7 days
      const endTime = new Date().toISOString();
      
      const response = await axios.get(
        `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${startTime}&endtime=${endTime}&latitude=${lat}&longitude=${lon}&maxradiuskm=${radiusKm}&minmagnitude=${minMagnitude}`
      );
      
      return response.data.features.map(earthquake => ({
        id: earthquake.id,
        magnitude: earthquake.properties.mag,
        depth: earthquake.geometry.coordinates[2],
        location: earthquake.properties.place,
        coordinates: {
          lat: earthquake.geometry.coordinates[1],
          lng: earthquake.geometry.coordinates[0]
        },
        timestamp: new Date(earthquake.properties.time),
        tsunami: earthquake.properties.tsunami === 1
      }));
    } catch (error) {
      console.error('Earthquake API error:', error.message);
      return []; // Return empty array if service is down
    }
  }

  static generateSeismicReading() {
    // Generate realistic seismic data for simulation
    const baseValue = Math.random() * 0.5; // Usually low
    const spike = Math.random() < 0.01 ? Math.random() * 4 : 0; // 1% chance of higher activity
    return Math.min(baseValue + spike, 9.0);
  }
}

// Google Maps Geocoding Service
class GeocodingService {
  static async reverseGeocode(lat, lon) {
    try {
      if (!GOOGLE_MAPS_API_KEY) {
        return {
          address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
          city: 'Unknown',
          state: 'Unknown',
          country: 'Unknown'
        };
      }

      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_MAPS_API_KEY}`
      );
      
      if (response.data.results.length === 0) {
        throw new Error('No results found');
      }
      
      const result = response.data.results[0];
      const components = result.address_components;
      
      return {
        address: result.formatted_address,
        city: this.getComponent(components, 'locality') || this.getComponent(components, 'administrative_area_level_2'),
        state: this.getComponent(components, 'administrative_area_level_1'),
        country: this.getComponent(components, 'country'),
        pincode: this.getComponent(components, 'postal_code')
      };
    } catch (error) {
      console.error('Geocoding API error:', error.message);
      return {
        address: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        city: 'Unknown',
        state: 'Unknown',
        country: 'Unknown'
      };
    }
  }

  static getComponent(components, type) {
    const component = components.find(comp => comp.types.includes(type));
    return component ? component.long_name : null;
  }
}

// Indian Government APIs (fallback data)
class IndianGovService {
  static async getAQIFromCPCB(city = 'Delhi') {
    try {
      // This is a simulated response since CPCB API requires special access
      // In production, you would integrate with official CPCB APIs
      const simulatedData = {
        Delhi: 180,
        Mumbai: 120,
        Bangalore: 95,
        Chennai: 110,
        Kolkata: 160,
        Ghaziabad: 200
      };
      
      return {
        aqi: simulatedData[city] || 150,
        category: this.getAQICategory(simulatedData[city] || 150),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Indian AQI API error:', error.message);
      return { aqi: 150, category: 'Moderate', timestamp: new Date() };
    }
  }

  static getAQICategory(aqi) {
    if (aqi <= 50) return 'Good';
    if (aqi <= 100) return 'Satisfactory';
    if (aqi <= 200) return 'Moderate';
    if (aqi <= 300) return 'Poor';
    if (aqi <= 400) return 'Very Poor';
    return 'Severe';
  }
}

// Location-specific data aggregator
class LocationDataService {
  static async getLocationBasedData(lat, lon) {
    try {
      const [weather, airQuality, earthquakes, locationInfo] = await Promise.allSettled([
        WeatherService.getCurrentWeather(lat, lon),
        WeatherService.getAirQuality(lat, lon),
        EarthquakeService.getRecentEarthquakes(lat, lon, 200, 2.0),
        GeocodingService.reverseGeocode(lat, lon)
      ]);

      return {
        weather: weather.status === 'fulfilled' ? weather.value : null,
        airQuality: airQuality.status === 'fulfilled' ? airQuality.value : null,
        recentEarthquakes: earthquakes.status === 'fulfilled' ? earthquakes.value : [],
        locationInfo: locationInfo.status === 'fulfilled' ? locationInfo.value : null,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Location data aggregation error:', error.message);
      throw error;
    }
  }

  static async getSimulatedSensorData(location) {
    // Generate realistic sensor data based on location and time
    const now = new Date();
    const hour = now.getHours();
    
    return {
      seismic: {
        magnitude: EarthquakeService.generateSeismicReading(),
        depth: 5 + Math.random() * 45,
        timestamp: now
      },
      weather: {
        temperature: this.getTemperatureForTime(hour, location),
        humidity: 40 + Math.random() * 40,
        windSpeed: Math.random() * 30,
        pressure: 1010 + (Math.random() - 0.5) * 20,
        timestamp: now
      },
      airQuality: {
        aqi: this.getAQIForLocation(location),
        pm25: 20 + Math.random() * 80,
        pm10: 30 + Math.random() * 120,
        timestamp: now
      },
      waterLevel: {
        level: 2 + Math.sin(Date.now() / 3600000) * 2 + Math.random() * 1,
        flowRate: 20 + Math.random() * 30,
        timestamp: now
      }
    };
  }

  static getTemperatureForTime(hour, location = 'Ghaziabad') {
    // Simulate temperature variation based on time of day
    const baseTemp = location.includes('Delhi') || location.includes('Ghaziabad') ? 25 : 22;
    const dailyVariation = 8 * Math.sin(((hour - 6) / 24) * 2 * Math.PI);
    const randomVariation = (Math.random() - 0.5) * 4;
    
    return baseTemp + dailyVariation + randomVariation;
  }

  static getAQIForLocation(location = 'Ghaziabad') {
    // Simulate AQI based on location and add some randomness
    const baseAQI = {
      'Ghaziabad': 180,
      'Delhi': 170,
      'Noida': 160,
      'Mumbai': 120,
      'Bangalore': 95
    };
    
    const base = baseAQI[location] || 140;
    const variation = (Math.random() - 0.5) * 40;
    return Math.max(20, Math.min(400, base + variation));
  }
}

module.exports = {
  WeatherService,
  EarthquakeService,
  GeocodingService,
  IndianGovService,
  LocationDataService
};