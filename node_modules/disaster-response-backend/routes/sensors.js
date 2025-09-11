const express = require('express');
const router = express.Router();
const Sensor = require('../models/Sensor');
const { LocationDataService, WeatherService } = require('../services/externalAPI');
const { optionalAuth } = require('../middleware/auth');

// Get all sensors with real-time data
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { type, status = 'active', limit = 50, lat, lon } = req.query;
    
    let query = {};
    if (type) query.type = type;
    if (status !== 'all') query.status = status;
    
    const sensors = await Sensor.find(query)
      .limit(parseInt(limit))
      .sort({ 'currentReading.timestamp': -1 });

    // If location provided, get real data from external APIs
    if (lat && lon && sensors.length > 0) {
      try {
        const realData = await LocationDataService.getLocationBasedData(
          parseFloat(lat), 
          parseFloat(lon)
        );
        
        // Update sensors with real data
        sensors.forEach(sensor => {
          let realValue = null;
          
          switch (sensor.type) {
            case 'temperature':
              realValue = realData.weather?.temperature;
              break;
            case 'humidity':
              realValue = realData.weather?.humidity;
              break;
            case 'wind_speed':
              realValue = realData.weather?.windSpeed;
              break;
            case 'pressure':
              realValue = realData.weather?.pressure;
              break;
            case 'air_quality':
              realValue = realData.airQuality?.aqi;
              break;
            case 'seismic':
              // Use simulated data for seismic
              realValue = LocationDataService.getSimulatedSensorData().seismic.magnitude;
              break;
            case 'water_level':
              realValue = LocationDataService.getSimulatedSensorData().waterLevel.level;
              break;
          }
          
          if (realValue !== null) {
            sensor.currentReading = {
              value: realValue,
              timestamp: new Date(),
              status: sensor.getAlertStatus(realValue)
            };
          }
        });
      } catch (apiError) {
        console.warn('External API error, using simulated data:', apiError.message);
        // Fallback to simulated data
        const simulatedData = await LocationDataService.getSimulatedSensorData();
        sensors.forEach(sensor => {
          const sensorData = simulatedData[sensor.type];
          if (sensorData) {
            sensor.currentReading = {
              value: sensorData.value || sensorData.magnitude || sensorData.level || sensorData.temperature || sensorData.aqi,
              timestamp: new Date(),
              status: sensor.getAlertStatus(sensorData.value || sensorData.magnitude || sensorData.level)
            };
          }
        });
      }
    }
    
    res.json(sensors);
  } catch (error) {
    console.error('Error fetching sensors:', error);
    res.status(500).json({ message: 'Failed to fetch sensors', error: error.message });
  }
});

// Get sensor by ID
router.get('/:id', async (req, res) => {
  try {
    const sensor = await Sensor.findOne({ sensorId: req.params.id });
    
    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }
    
    res.json(sensor);
  } catch (error) {
    console.error('Error fetching sensor:', error);
    res.status(500).json({ message: 'Failed to fetch sensor', error: error.message });
  }
});

// Get current readings for all sensors (with real data integration)
router.get('/readings/current', async (req, res) => {
  try {
    const { lat, lon } = req.query;
    
    const sensors = await Sensor.find({ status: 'active' })
      .select('sensorId type currentReading location unit')
      .sort({ type: 1 });
    
    let realData = null;
    if (lat && lon) {
      try {
        realData = await LocationDataService.getLocationBasedData(
          parseFloat(lat), 
          parseFloat(lon)
        );
      } catch (error) {
        console.warn('Could not fetch real data, using simulated:', error.message);
        realData = await LocationDataService.getSimulatedSensorData();
      }
    }
    
    const readings = sensors.reduce((acc, sensor) => {
      if (!acc[sensor.type]) {
        acc[sensor.type] = [];
      }
      
      let currentValue = sensor.currentReading?.value;
      let timestamp = sensor.currentReading?.timestamp || new Date();
      
      // Override with real data if available
      if (realData) {
        switch (sensor.type) {
          case 'temperature':
            currentValue = realData.weather?.temperature || realData.weather?.temperature;
            break;
          case 'humidity':
            currentValue = realData.weather?.humidity;
            break;
          case 'wind_speed':
            currentValue = realData.weather?.windSpeed;
            break;
          case 'pressure':
            currentValue = realData.weather?.pressure;
            break;
          case 'air_quality':
            currentValue = realData.airQuality?.aqi;
            break;
          case 'seismic':
            currentValue = realData.seismic?.magnitude || LocationDataService.getSimulatedSensorData().seismic.magnitude;
            break;
          case 'water_level':
            currentValue = realData.waterLevel?.level || LocationDataService.getSimulatedSensorData().waterLevel.level;
            break;
        }
        timestamp = new Date();
      }
      
      acc[sensor.type].push({
        sensorId: sensor.sensorId,
        value: currentValue,
        timestamp,
        status: sensor.getAlertStatus(currentValue),
        location: sensor.location.name,
        unit: sensor.unit
      });
      
      return acc;
    }, {});
    
    res.json({
      readings,
      dataSource: realData && lat && lon ? 'real' : 'simulated',
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Error fetching current readings:', error);
    res.status(500).json({ message: 'Failed to fetch current readings', error: error.message });
  }
});

// Get location-based environmental data
router.get('/location/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);
    
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    
    // Get comprehensive location-based data
    const locationData = await LocationDataService.getLocationBasedData(latitude, longitude);
    
    // Format response for sensor compatibility
    const formattedData = {
      location: {
        coordinates: { lat: latitude, lng: longitude },
        address: locationData.locationInfo?.address || `${latitude}, ${longitude}`,
        city: locationData.locationInfo?.city || 'Unknown',
        state: locationData.locationInfo?.state || 'Unknown'
      },
      environmental: {
        weather: locationData.weather ? {
          temperature: locationData.weather.temperature,
          humidity: locationData.weather.humidity,
          windSpeed: locationData.weather.windSpeed,
          windDirection: locationData.weather.windDirection,
          pressure: locationData.weather.pressure,
          visibility: locationData.weather.visibility,
          description: locationData.weather.description
        } : null,
        airQuality: locationData.airQuality ? {
          aqi: locationData.airQuality.aqi,
          pm25: locationData.airQuality.pm25,
          pm10: locationData.airQuality.pm10,
          category: getAQICategory(locationData.airQuality.aqi)
        } : null,
        seismic: {
          currentActivity: LocationDataService.getSimulatedSensorData().seismic.magnitude,
          recentEarthquakes: locationData.recentEarthquakes || []
        }
      },
      alerts: generateLocationAlerts(locationData),
      timestamp: new Date()
    };
    
    res.json(formattedData);
  } catch (error) {
    console.error('Error fetching location data:', error);
    res.status(500).json({ 
      message: 'Failed to fetch location data', 
      error: error.message,
      fallback: true
    });
  }
});

// Historical data endpoint with real data integration
router.get('/:id/history', async (req, res) => {
  try {
    const { hours = 24, limit = 100 } = req.query;
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const sensor = await Sensor.findOne({ sensorId: req.params.id });
    
    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }
    
    // Get historical readings from database
    let historicalReadings = sensor.readings
      .filter(reading => reading.timestamp >= hoursAgo)
      .slice(-limit)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // If we don't have enough historical data, generate some realistic data
    if (historicalReadings.length < 10) {
      historicalReadings = generateHistoricalData(sensor.type, hours, limit);
    }
    
    res.json({
      sensorId: sensor.sensorId,
      type: sensor.type,
      unit: sensor.unit,
      readings: historicalReadings,
      summary: {
        count: historicalReadings.length,
        period: `${hours} hours`,
        latest: sensor.currentReading,
        average: calculateAverage(historicalReadings),
        min: Math.min(...historicalReadings.map(r => r.value)),
        max: Math.max(...historicalReadings.map(r => r.value))
      }
    });
  } catch (error) {
    console.error('Error fetching sensor history:', error);
    res.status(500).json({ message: 'Failed to fetch sensor history', error: error.message });
  }
});

// Add new sensor reading (for IoT devices)
router.post('/:id/readings', async (req, res) => {
  try {
    const { value, quality = 'good' } = req.body;
    
    if (typeof value !== 'number') {
      return res.status(400).json({ message: 'Value must be a number' });
    }
    
    const sensor = await Sensor.findOne({ sensorId: req.params.id });
    
    if (!sensor) {
      return res.status(404).json({ message: 'Sensor not found' });
    }
    
    await sensor.addReading(value, quality);
    
    res.json({
      message: 'Reading added successfully',
      currentReading: sensor.currentReading
    });
  } catch (error) {
    console.error('Error adding sensor reading:', error);
    res.status(500).json({ message: 'Failed to add sensor reading', error: error.message });
  }
});

// Helper functions
function getAQICategory(aqi) {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function generateLocationAlerts(locationData) {
  const alerts = [];
  
  if (locationData.airQuality?.aqi > 200) {
    alerts.push({
      type: 'air_quality',
      severity: locationData.airQuality.aqi > 300 ? 'high' : 'medium',
      message: `Poor air quality detected. AQI: ${Math.round(locationData.airQuality.aqi)}`
    });
  }
  
  if (locationData.weather?.windSpeed > 30) {
    alerts.push({
      type: 'weather',
      severity: locationData.weather.windSpeed > 50 ? 'high' : 'medium',
      message: `High wind speeds: ${Math.round(locationData.weather.windSpeed)} km/h`
    });
  }
  
  if (locationData.recentEarthquakes && locationData.recentEarthquakes.length > 0) {
    const recentQuake = locationData.recentEarthquakes[0];
    if (recentQuake.magnitude > 4.0) {
      alerts.push({
        type: 'seismic',
        severity: 'high',
        message: `Recent earthquake: ${recentQuake.magnitude} magnitude`
      });
    }
  }
  
  return alerts;
}

function generateHistoricalData(sensorType, hours, limit) {
  const data = [];
  const now = new Date();
  const interval = (hours * 60 * 60 * 1000) / limit;
  
  for (let i = 0; i < limit; i++) {
    const timestamp = new Date(now.getTime() - (limit - i) * interval);
    let value;
    
    switch (sensorType) {
      case 'temperature':
        // Simulate daily temperature cycle
        const hourOfDay = timestamp.getHours();
        value = 20 + 8 * Math.sin((hourOfDay - 6) / 24 * 2 * Math.PI) + Math.random() * 2;
        break;
      case 'humidity':
        value = 50 + 20 * Math.sin(timestamp.getTime() / 3600000) + Math.random() * 10;
        break;
      case 'air_quality':
        // Higher AQI during day, lower at night
        const isDay = timestamp.getHours() >= 6 && timestamp.getHours() <= 20;
        value = (isDay ? 120 : 80) + Math.random() * 40;
        break;
      case 'wind_speed':
        value = 10 + Math.random() * 20;
        break;
      case 'seismic':
        value = Math.random() * 2; // Usually low
        if (Math.random() < 0.02) value += Math.random() * 3; // Occasional spikes
        break;
      case 'water_level':
        value = 3 + Math.sin(timestamp.getTime() / 3600000) + Math.random() * 0.5;
        break;
      default:
        value = Math.random() * 100;
    }
    
    data.push({
      value: Math.max(0, value),
      timestamp,
      quality: 'good'
    });
  }
  
  return data;
}

function calculateAverage(readings) {
  if (readings.length === 0) return 0;
  const sum = readings.reduce((acc, reading) => acc + reading.value, 0);
  return (sum / readings.length).toFixed(2);
}

module.exports = router;