const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['earthquake', 'flood', 'storm', 'fire', 'pollution', 'heatwave', 'other']
  },
  message: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['critical', 'warning', 'moderate', 'info']
  },
  location: {
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
  },
  estimatedImpact: {
    type: Number,
    default: 0
  },
  acknowledged: {
    type: Boolean,
    default: false
  },
  acknowledgedAt: {
    type: Date
  },
  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolved: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  resolution: {
    type: String
  },
  responseTeams: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    assignedAt: {
      type: Date,
      default: Date.now
    },
    status: {
      type: String,
      enum: ['dispatched', 'enroute', 'onscene', 'completed'],
      default: 'dispatched'
    }
  }],
  sensorData: {
    value: Number,
    unit: String,
    sensorId: String
  },
  notificationsSent: [{
    type: {
      type: String,
      enum: ['email', 'sms', 'push', 'broadcast']
    },
    sentAt: {
      type: Date,
      default: Date.now
    },
    recipients: Number,
    status: {
      type: String,
      enum: ['sent', 'failed', 'pending']
    }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
alertSchema.index({ type: 1, severity: 1 });
alertSchema.index({ location: 1 });
alertSchema.index({ createdAt: -1 });
alertSchema.index({ resolved: 1 });

// Virtual for alert age
alertSchema.virtual('age').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Static method to find active alerts
alertSchema.statics.findActive = function() {
  return this.find({ resolved: false }).sort({ createdAt: -1 });
};

// Static method to find by severity
alertSchema.statics.findBySeverity = function(severity) {
  return this.find({ severity, resolved: false });
};

module.exports = mongoose.model('Alert', alertSchema);