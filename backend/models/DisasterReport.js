const mongoose = require('mongoose');

const disasterReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    required: true,
    unique: true
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'earthquake',
      'flood',
      'fire',
      'storm',
      'landslide',
      'accident',
      'building_collapse',
      'gas_leak',
      'water_logging',
      'tree_fall',
      'power_outage',
      'road_block',
      'other'
    ]
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 1000
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  location: {
    address: {
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
    landmark: String,
    city: String,
    state: String,
    pincode: String
  },
  images: [{
    url: String,
    filename: String,
    uploadedAt: { type: Date, default: Date.now },
    size: Number,
    mimeType: String
  }],
  contactInfo: {
    phone: String,
    alternatePhone: String,
    isContactPublic: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['reported', 'verified', 'in_progress', 'resolved', 'false_alarm'],
    default: 'reported'
  },
  adminNotes: String,
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verifiedAt: Date,
  assignedTeams: [{
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    assignedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['assigned', 'dispatched', 'on_site', 'completed'],
      default: 'assigned'
    }
  }],
  priority: {
    type: Number,
    min: 1,
    max: 10,
    default: 5
  },
  affectedPeople: {
    estimated: Number,
    confirmed: Number
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: true
  },
  responses: [{
    responderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: { type: Date, default: Date.now },
    type: {
      type: String,
      enum: ['update', 'question', 'resolution'],
      default: 'update'
    }
  }],
  metadata: {
    deviceInfo: String,
    userAgent: String,
    ipAddress: String,
    reportingMethod: {
      type: String,
      enum: ['web', 'mobile', 'api', 'phone'],
      default: 'web'
    }
  }
}, {
  timestamps: true
});

// Indexes
disasterReportSchema.index({ 'location.coordinates': '2dsphere' });
disasterReportSchema.index({ type: 1, status: 1 });
disasterReportSchema.index({ reportedBy: 1 });
disasterReportSchema.index({ createdAt: -1 });
disasterReportSchema.index({ priority: -1 });
disasterReportSchema.index({ severity: 1 });

// Virtual for time since reported
disasterReportSchema.virtual('timeSinceReported').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Static method to find reports near location
disasterReportSchema.statics.findNearLocation = function(coordinates, maxDistance = 5000) {
  return this.find({
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.lng, coordinates.lat]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

// Static method to find active reports
disasterReportSchema.statics.findActive = function() {
  return this.find({
    status: { $in: ['reported', 'verified', 'in_progress'] }
  }).sort({ priority: -1, createdAt: -1 });
};

// Method to calculate priority based on severity and other factors
disasterReportSchema.methods.calculatePriority = function() {
  let priority = 5; // Default
  
  // Severity impact
  const severityMultiplier = {
    'low': 0.5,
    'medium': 1,
    'high': 1.5,
    'critical': 2
  };
  priority *= severityMultiplier[this.severity] || 1;
  
  // Type impact
  const highPriorityTypes = ['earthquake', 'fire', 'building_collapse', 'gas_leak'];
  if (highPriorityTypes.includes(this.type)) {
    priority *= 1.5;
  }
  
  // Time factor (older reports get higher priority if unresolved)
  const hoursOld = (Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursOld > 24) priority *= 1.2;
  if (hoursOld > 48) priority *= 1.5;
  
  // Affected people factor
  if (this.affectedPeople?.estimated > 10) {
    priority *= 1.3;
  }
  
  this.priority = Math.min(Math.round(priority), 10);
  return this.priority;
};

// Pre-save middleware to generate report ID and calculate priority
disasterReportSchema.pre('save', function(next) {
  if (!this.reportId) {
    this.reportId = `DR-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  }
  
  this.calculatePriority();
  next();
});

module.exports = mongoose.model('DisasterReport', disasterReportSchema);