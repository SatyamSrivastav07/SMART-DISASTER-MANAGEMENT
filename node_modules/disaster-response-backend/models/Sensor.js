const mongoose = require('mongoose');

const sensorReadingSchema = new mongoose.Schema({
  value: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  quality: {
    type: String,
    enum: ['good', 'fair', 'poor'],
    default: 'good'
  }
});

const sensorSchema = new mongoose.Schema({
  sensorId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['seismic', 'weather', 'air_quality', 'water_level', 'temperature', 'humidity', 'pressure', 'wind_speed']
  },
  location: {
    name: {
      type: String,
      required: true
    },
    coordinates: {
      lat: {
        type: Number,
        required: true
      },
      lng: {
        type: Number,
        required: true
      }
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance', 'error'],
    default: 'active'
  },
  unit: {
    type: String,
    required: true
  },
  thresholds: {
    warning: {
      type: Number,
      required: true
    },
    critical: {
      type: Number,
      required: true
    }
  },
  currentReading: {
    value: Number,
    timestamp: Date,
    status: {
      type: String,
      enum: ['normal', 'warning', 'critical'],
      default: 'normal'
    }
  },
  readings: [sensorReadingSchema],
  calibration: {
    lastCalibrated: Date,
    calibrationFactor: {
      type: Number,
      default: 1.0
    }
  },
  metadata: {
    manufacturer: String,
    model: String,
    installationDate: Date,
    maintenanceSchedule: String,
    batteryLevel: Number
  }
}, {
  timestamps: true
});

// Indexes
sensorSchema.index({ type: 1, status: 1 });
sensorSchema.index({ 'location.coordinates': '2dsphere' });
sensorSchema.index({ 'readings.timestamp': -1 });

// Virtual for latest reading
sensorSchema.virtual('latestReading').get(function() {
  return this.readings.length > 0 ? this.readings[this.readings.length - 1] : null;
});

// Method to add new reading
sensorSchema.methods.addReading = function(value, quality = 'good') {
  const reading = { value, quality, timestamp: new Date() };
  this.readings.push(reading);
  
  // Keep only last 1000 readings to prevent document from growing too large
  if (this.readings.length > 1000) {
    this.readings = this.readings.slice(-1000);
  }
  
  // Update current reading
  this.currentReading = {
    value,
    timestamp: reading.timestamp,
    status: this.getAlertStatus(value)
  };
  
  return this.save();
};

// Method to determine alert status based on thresholds
sensorSchema.methods.getAlertStatus = function(value) {
  if (value >= this.thresholds.critical) {
    return 'critical';
  } else if (value >= this.thresholds.warning) {
    return 'warning';
  }
  return 'normal';
};

// Static method to find sensors by type
sensorSchema.statics.findByType = function(type) {
  return this.find({ type, status: 'active' });
};

// Static method to find sensors in critical state
sensorSchema.statics.findCritical = function() {
  return this.find({ 'currentReading.status': 'critical', status: 'active' });
};

module.exports = mongoose.model('Sensor', sensorSchema);