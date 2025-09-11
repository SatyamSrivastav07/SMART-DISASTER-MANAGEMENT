const express = require('express');
const router = express.Router();
const Alert = require('../models/Alert');
const { validateAlert } = require('../utils/validation');

// Get all alerts
router.get('/', async (req, res) => {
  try {
    const { 
      status = 'all', 
      severity, 
      type, 
      limit = 50, 
      page = 1,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};
    
    // Filter by status
    if (status === 'active') {
      query.resolved = false;
    } else if (status === 'resolved') {
      query.resolved = true;
    }
    
    // Filter by severity
    if (severity) {
      query.severity = severity;
    }
    
    // Filter by type
    if (type) {
      query.type = type;
    }

    const alerts = await Alert.find(query)
      .populate('responseTeams.teamId', 'name type status')
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const total = await Alert.countDocuments(query);

    res.json({
      alerts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts', error: error.message });
  }
});

// Get alert by ID
router.get('/:id', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate('responseTeams.teamId')
      .populate('acknowledgedBy', 'name email')
      .populate('resolvedBy', 'name email');
    
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    console.error('Error fetching alert:', error);
    res.status(500).json({ message: 'Failed to fetch alert', error: error.message });
  }
});

// Create new alert
router.post('/', async (req, res) => {
  try {
    const { error, value } = validateAlert(req.body);
    if (error) {
      return res.status(400).json({ message: 'Validation error', details: error.details });
    }

    // Generate unique alert ID
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const alertData = {
      ...value,
      id: alertId,
      coordinates: value.coordinates || { lat: 28.6692, lng: 77.4538 }, // Default to Ghaziabad
      estimatedImpact: value.estimatedImpact || calculateEstimatedImpact(value.type, value.severity)
    };

    const alert = new Alert(alertData);
    await alert.save();

    // TODO: Trigger notifications and team assignments here
    
    res.status(201).json({
      message: 'Alert created successfully',
      alert
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({ message: 'Failed to create alert', error: error.message });
  }
});

// Acknowledge alert
router.patch('/:id/acknowledge', async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    if (alert.acknowledged) {
      return res.status(400).json({ message: 'Alert already acknowledged' });
    }
    
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date();
    // alert.acknowledgedBy = req.user?.id; // TODO: Add when authentication is implemented
    
    await alert.save();
    
    res.json({
      message: 'Alert acknowledged successfully',
      alert
    });
  } catch (error) {
    console.error('Error acknowledging alert:', error);
    res.status(500).json({ message: 'Failed to acknowledge alert', error: error.message });
  }
});

// Resolve alert
router.patch('/:id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    if (alert.resolved) {
      return res.status(400).json({ message: 'Alert already resolved' });
    }
    
    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolution = resolution || 'Resolved by system';
    // alert.resolvedBy = req.user?.id; // TODO: Add when authentication is implemented
    
    await alert.save();
    
    res.json({
      message: 'Alert resolved successfully',
      alert
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    res.status(500).json({ message: 'Failed to resolve alert', error: error.message });
  }
});

// Assign team to alert
router.patch('/:id/assign-team', async (req, res) => {
  try {
    const { teamId } = req.body;
    const alert = await Alert.findById(req.params.id);
    
    if (!alert) {
      return res.status(404).json({ message: 'Alert not found' });
    }
    
    // Check if team is already assigned
    const isAlreadyAssigned = alert.responseTeams.some(
      team => team.teamId.toString() === teamId
    );
    
    if (isAlreadyAssigned) {
      return res.status(400).json({ message: 'Team already assigned to this alert' });
    }
    
    alert.responseTeams.push({
      teamId,
      assignedAt: new Date(),
      status: 'dispatched'
    });
    
    await alert.save();
    
    res.json({
      message: 'Team assigned successfully',
      alert
    });
  } catch (error) {
    console.error('Error assigning team:', error);
    res.status(500).json({ message: 'Failed to assign team', error: error.message });
  }
});

// Get alert statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalAlerts,
      activeAlerts,
      criticalAlerts,
      resolvedAlerts,
      alertsByType,
      recentAlerts
    ] = await Promise.all([
      Alert.countDocuments(),
      Alert.countDocuments({ resolved: false }),
      Alert.countDocuments({ severity: 'critical', resolved: false }),
      Alert.countDocuments({ resolved: true }),
      Alert.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      Alert.find({ resolved: false })
        .sort({ createdAt: -1 })
        .limit(10)
        .select('type severity message location createdAt')
    ]);

    res.json({
      overview: {
        total: totalAlerts,
        active: activeAlerts,
        critical: criticalAlerts,
        resolved: resolvedAlerts,
        resolutionRate: totalAlerts > 0 ? ((resolvedAlerts / totalAlerts) * 100).toFixed(1) : 0
      },
      alertsByType,
      recentAlerts
    });
  } catch (error) {
    console.error('Error fetching alert statistics:', error);
    res.status(500).json({ message: 'Failed to fetch alert statistics', error: error.message });
  }
});

// Helper function to calculate estimated impact
function calculateEstimatedImpact(type, severity) {
  const baseImpact = {
    earthquake: { critical: 10000, warning: 5000, moderate: 1000 },
    flood: { critical: 8000, warning: 4000, moderate: 800 },
    storm: { critical: 6000, warning: 3000, moderate: 600 },
    fire: { critical: 5000, warning: 2000, moderate: 500 },
    pollution: { critical: 15000, warning: 8000, moderate: 2000 }
  };
  
  return baseImpact[type]?.[severity] || 1000;
}

module.exports = router;