const Joi = require('joi');

// Alert validation schema
const alertSchema = Joi.object({
  type: Joi.string()
    .valid('earthquake', 'flood', 'storm', 'fire', 'pollution', 'heatwave', 'other')
    .required(),
  message: Joi.string()
    .min(10)
    .max(500)
    .required(),
  severity: Joi.string()
    .valid('critical', 'warning', 'moderate', 'info')
    .required(),
  location: Joi.string()
    .min(3)
    .max(100)
    .required(),
  coordinates: Joi.object({
    lat: Joi.number()
      .min(-90)
      .max(90)
      .required(),
    lng: Joi.number()
      .min(-180)
      .max(180)
      .required()
  }).optional(),
  estimatedImpact: Joi.number()
    .min(0)
    .optional(),
  sensorData: Joi.object({
    value: Joi.number().required(),
    unit: Joi.string().required(),
    sensorId: Joi.string().required()
  }).optional()
});

// Sensor validation schema
const sensorSchema = Joi.object({
  sensorId: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),
  type: Joi.string()
    .valid('seismic', 'weather', 'air_quality', 'water_level', 'temperature', 'humidity', 'pressure', 'wind_speed')
    .required(),
  location: Joi.object({
    name: Joi.string().min(3).max(100).required(),
    coordinates: Joi.object({
      lat: Joi.number().min(-90).max(90).required(),
      lng: Joi.number().min(-180).max(180).required()
    }).required()
  }).required(),
  unit: Joi.string()
    .min(1)
    .max(20)
    .required(),
  thresholds: Joi.object({
    warning: Joi.number().required(),
    critical: Joi.number().required()
  }).required()
});

// Team validation schema
const teamSchema = Joi.object({
  teamId: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),
  name: Joi.string()
    .min(3)
    .max(100)
    .required(),
  type: Joi.string()
    .valid('fire', 'medical', 'rescue', 'police', 'hazmat', 'coordination')
    .required(),
  location: Joi.object({
    base: Joi.string().min(3).max(100).required()
  }).required(),
  members: Joi.array().items(
    Joi.object({
      name: Joi.string().min(2).max(50).required(),
      role: Joi.string().min(2).max(50).required(),
      contactNumber: Joi.string().optional(),
      certification: Joi.array().items(Joi.string()).optional(),
      isLeader: Joi.boolean().optional()
    })
  ).optional()
});

// Validation functions
const validateAlert = (data) => {
  return alertSchema.validate(data);
};

const validateSensor = (data) => {
  return sensorSchema.validate(data);
};

const validateTeam = (data) => {
  return teamSchema.validate(data);
};

const validateSensorReading = (data) => {
  const schema = Joi.object({
    value: Joi.number().required(),
    quality: Joi.string().valid('good', 'fair', 'poor').optional()
  });
  return schema.validate(data);
};

module.exports = {
  validateAlert,
  validateSensor,
  validateTeam,
  validateSensorReading
};