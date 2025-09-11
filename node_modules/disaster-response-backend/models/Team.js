const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    required: true
  },
  contactNumber: String,
  certification: [String],
  isLeader: {
    type: Boolean,
    default: false
  }
});

const teamSchema = new mongoose.Schema({
  teamId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['fire', 'medical', 'rescue', 'police', 'hazmat', 'coordination']
  },
  status: {
    type: String,
    enum: ['available', 'deployed', 'busy', 'maintenance'],
    default: 'available'
  },
  location: {
    base: {
      type: String,
      required: true
    },
    current: {
      address: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    }
  },
  members: [memberSchema],
  equipment: [{
    item: String,
    quantity: Number,
    status: {
      type: String,
      enum: ['operational', 'maintenance', 'damaged'],
      default: 'operational'
    }
  }],
  specializations: [String],
  currentAssignment: {
    alertId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Alert'
    },
    assignedAt: Date,
    estimatedDuration: Number,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium'
    }
  },
  performance: {
    totalMissions: {
      type: Number,
      default: 0
    },
    successfulMissions: {
      type: Number,
      default: 0
    },
    averageResponseTime: Number,
    lastMissionDate: Date
  },
  contact: {
    primaryPhone: String,
    secondaryPhone: String,
    radio: String,
    email: String
  }
}, {
  timestamps: true
});

// Indexes
teamSchema.index({ type: 1, status: 1 });
teamSchema.index({ 'location.current.coordinates': '2dsphere' });

// Virtual for team size
teamSchema.virtual('teamSize').get(function() {
  return this.members.length;
});

// Virtual for availability
teamSchema.virtual('isAvailable').get(function() {
  return this.status === 'available';
});

// Method to assign team to alert
teamSchema.methods.assignToAlert = function(alertId, priority = 'medium') {
  this.status = 'deployed';
  this.currentAssignment = {
    alertId,
    assignedAt: new Date(),
    priority
  };
  this.performance.totalMissions += 1;
  return this.save();
};

// Method to complete mission
teamSchema.methods.completeMission = function(successful = true) {
  if (successful) {
    this.performance.successfulMissions += 1;
  }
  
  this.status = 'available';
  this.performance.lastMissionDate = new Date();
  this.currentAssignment = undefined;
  
  return this.save();
};

// Static method to find available teams by type
teamSchema.statics.findAvailableByType = function(type) {
  return this.find({ type, status: 'available' });
};

// Static method to find teams near location
teamSchema.statics.findNearLocation = function(coordinates, maxDistance = 50000) {
  return this.find({
    'location.current.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat]
        },
        $maxDistance: maxDistance
      }
    },
    status: 'available'
  });
};

module.exports = mongoose.model('Team', teamSchema);