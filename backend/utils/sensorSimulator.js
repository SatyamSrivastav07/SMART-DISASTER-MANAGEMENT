const Sensor = require('../models/Sensor');
const Alert = require('../models/Alert');

// Simulate real-time sensor data
const simulateSensorData = async () => {
  try {
    const sensors = await Sensor.find({ status: 'active' });
    
    for (const sensor of sensors) {
      let newValue;
      
      // Generate realistic values based on sensor type
      switch (sensor.type) {
        case 'seismic':
          newValue = Math.random() * 5; // 0-5 magnitude
          break;
        case 'temperature':
          newValue = 20 + Math.sin(Date.now() / 3600000) * 10 + Math.random() * 5; // 15-35°C
          break;
        case 'humidity':
          newValue = 40 + Math.random() * 40; // 40-80%
          break;
        case 'wind_speed':
          newValue = Math.random() * 50; // 0-50 km/h
          break;
        case 'air_quality':
          newValue = 50 + Math.random() * 200; // 50-250 AQI
          break;
        case 'water_level':
          newValue = 2 + Math.sin(Date.now() / 3600000) * 3 + Math.random() * 2; // 0-7m
          break;
        case 'pressure':
          newValue = 1000 + Math.random() * 50; // 1000-1050 hPa
          break;
        default:
          newValue = Math.random() * 100;
      }
      
      // Add some noise and variations
      newValue = Math.max(0, newValue + (Math.random() - 0.5) * 2);
      
      // Update sensor reading
      await sensor.addReading(newValue);
      
      // Check if reading exceeds thresholds and create alert
      const alertStatus = sensor.getAlertStatus(newValue);
      
      if (alertStatus !== 'normal') {
        // Check if there's already a recent alert for this sensor
        const recentAlert = await Alert.findOne({
          'sensorData.sensorId': sensor.sensorId,
          type: getAlertType(sensor.type),
          severity: alertStatus === 'critical' ? 'critical' : 'warning',
          resolved: false,
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        });
        
        if (!recentAlert) {
          // Create new alert
          const alert = new Alert({
            id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: getAlertType(sensor.type),
            message: generateAlertMessage(sensor.type, newValue, sensor.unit),
            severity: alertStatus === 'critical' ? 'critical' : 'warning',
            location: sensor.location.name,
            coordinates: sensor.location.coordinates,
            estimatedImpact: calculateImpact(sensor.type, alertStatus),
            sensorData: {
              value: newValue,
              unit: sensor.unit,
              sensorId: sensor.sensorId
            }
          });
          
          await alert.save();
          console.log(`🚨 Alert created: ${alert.type} - ${alert.severity} - ${alert.message}`);
        }
      }
    }
  } catch (error) {
    console.error('Error simulating sensor data:', error);
  }
};

// Helper function to map sensor type to alert type
const getAlertType = (sensorType) => {
  const mapping = {
    seismic: 'earthquake',
    water_level: 'flood',
    wind_speed: 'storm',
    temperature: 'heatwave',
    air_quality: 'pollution'
  };
  return mapping[sensorType] || 'other';
};

// Helper function to generate alert messages
const generateAlertMessage = (sensorType, value, unit) => {
  const messages = {
    seismic: `Seismic activity detected: ${value.toFixed(1)} magnitude`,
    water_level: `Rising water levels detected: ${value.toFixed(1)}${unit}`,
    wind_speed: `High wind speeds detected: ${value.toFixed(1)} ${unit}`,
    temperature: `Extreme temperature detected: ${value.toFixed(1)}${unit}`,
    air_quality: `Poor air quality detected: AQI ${value.toFixed(0)}`,
    humidity: `Unusual humidity levels: ${value.toFixed(1)}${unit}`,
    pressure: `Atmospheric pressure anomaly: ${value.toFixed(1)} ${unit}`
  };
  
  return messages[sensorType] || `Sensor anomaly detected: ${value.toFixed(1)} ${unit}`;
};

// Helper function to calculate estimated impact
const calculateImpact = (sensorType, severity) => {
  const baseImpact = {
    seismic: { critical: 10000, warning: 5000 },
    water_level: { critical: 8000, warning: 4000 },
    wind_speed: { critical: 6000, warning: 3000 },
    temperature: { critical: 12000, warning: 6000 },
    air_quality: { critical: 15000, warning: 8000 }
  };
  
  return baseImpact[sensorType]?.[severity] || 1000;
};

// Initialize sensors if they don't exist
const initializeSensors = async () => {
  try {
    const existingSensors = await Sensor.countDocuments();
    
    if (existingSensors === 0) {
      const defaultSensors = [
        {
          sensorId: 'seismic-001',
          type: 'seismic',
          location: {
            name: 'Ghaziabad Central',
            coordinates: { lat: 28.6692, lng: 77.4538 }
          },
          unit: 'magnitude',
          thresholds: { warning: 3.0, critical: 4.0 },
          status: 'active'
        },
        {
          sensorId: 'weather-001',
          type: 'temperature',
          location: {
            name: 'Ghaziabad Weather Station',
            coordinates: { lat: 28.6700, lng: 77.4600 }
          },
          unit: '°C',
          thresholds: { warning: 35, critical: 40 },
          status: 'active'
        },
        {
          sensorId: 'air-001',
          type: 'air_quality',
          location: {
            name: 'Ghaziabad Air Quality Monitor',
            coordinates: { lat: 28.6650, lng: 77.4500 }
          },
          unit: 'AQI',
          thresholds: { warning: 150, critical: 200 },
          status: 'active'
        },
        {
          sensorId: 'water-001',
          type: 'water_level',
          location: {
            name: 'Hindon River Monitor',
            coordinates: { lat: 28.6800, lng: 77.4400 }
          },
          unit: 'm',
          thresholds: { warning: 6.0, critical: 8.0 },
          status: 'active'
        },
        {
          sensorId: 'wind-001',
          type: 'wind_speed',
          location: {
            name: 'Ghaziabad Wind Monitor',
            coordinates: { lat: 28.6600, lng: 77.4700 }
          },
          unit: 'km/h',
          thresholds: { warning: 30, critical: 50 },
          status: 'active'
        }
      ];

      for (const sensorData of defaultSensors) {
        const sensor = new Sensor(sensorData);
        await sensor.save();
        console.log(`✅ Initialized sensor: ${sensor.sensorId}`);
      }
      
      console.log(`🔧 Initialized ${defaultSensors.length} sensors`);
    }
  } catch (error) {
    console.error('Error initializing sensors:', error);
  }
};

module.exports = {
  simulateSensorData,
  initializeSensors
};