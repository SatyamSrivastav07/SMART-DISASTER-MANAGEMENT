const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['citizen', 'admin', 'responder'],
    default: 'citizen'
  },
  phone: {
    type: String,
    required: true
  },
  location: {
    address: String,
    coordinates: {
      lat: Number,
      lng: Number
    },
    city: String,
    state: String,
    country: String,
    pincode: String
  },
  profile: {
    avatar: String,
    dateOfBirth: Date,
    occupation: String,
    emergencyContact: {
      name: String,
      phone: String,
      relation: String
    }
  },
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    alertRadius: { type: Number, default: 10 }, // km
    language: { type: String, default: 'en' }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  verificationToken: String,
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  lastLogin: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: Date
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'location.coordinates': '2dsphere' });
userSchema.index({ role: 1 });

// Virtual for account locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (this.isLocked) {
    throw new Error('Account is locked. Try again later.');
  }
  
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  
  if (!isMatch) {
    this.loginAttempts += 1;
    
    // Lock account after 5 failed attempts for 2 hours
    if (this.loginAttempts >= 5) {
      this.lockUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
    }
    
    await this.save();
    throw new Error('Invalid password');
  }
  
  // Reset login attempts on successful login
  if (this.loginAttempts > 0) {
    this.loginAttempts = 0;
    this.lockUntil = undefined;
  }
  
  this.lastLogin = new Date();
  await this.save();
  
  return true;
};

// Generate auth token method
userSchema.methods.generateAuthToken = function() {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { 
      userId: this._id, 
      email: this.email, 
      role: this.role,
      name: this.name
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// Static method to find users near location
userSchema.statics.findNearLocation = function(coordinates, maxDistance = 10000) {
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

module.exports = mongoose.model('User', userSchema);