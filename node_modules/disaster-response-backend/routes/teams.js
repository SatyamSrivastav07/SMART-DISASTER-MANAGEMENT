const express = require('express');
const router = express.Router();
const Team = require('../models/Team');

// Get all teams
router.get('/', async (req, res) => {
  try {
    const { type, status, available } = req.query;
    
    let query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (available === 'true') query.status = 'available';
    
    const teams = await Team.find(query)
      .populate('currentAssignment.alertId', 'type severity location')
      .sort({ name: 1 });
    
    res.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ message: 'Failed to fetch teams', error: error.message });
  }
});

// Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.findOne({ teamId: req.params.id })
      .populate('currentAssignment.alertId');
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    res.json(team);
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ message: 'Failed to fetch team', error: error.message });
  }
});

// Get available teams by type
router.get('/available/:type', async (req, res) => {
  try {
    const teams = await Team.findAvailableByType(req.params.type);
    res.json(teams);
  } catch (error) {
    console.error('Error fetching available teams:', error);
    res.status(500).json({ message: 'Failed to fetch available teams', error: error.message });
  }
});

// Assign team to alert
router.patch('/:id/assign', async (req, res) => {
  try {
    const { alertId, priority = 'medium' } = req.body;
    
    const team = await Team.findOne({ teamId: req.params.id });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    if (!team.isAvailable) {
      return res.status(400).json({ message: 'Team is not available' });
    }
    
    await team.assignToAlert(alertId, priority);
    
    res.json({
      message: 'Team assigned successfully',
      team
    });
  } catch (error) {
    console.error('Error assigning team:', error);
    res.status(500).json({ message: 'Failed to assign team', error: error.message });
  }
});

// Complete team mission
router.patch('/:id/complete', async (req, res) => {
  try {
    const { successful = true, notes } = req.body;
    
    const team = await Team.findOne({ teamId: req.params.id });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    if (team.status !== 'deployed') {
      return res.status(400).json({ message: 'Team is not currently deployed' });
    }
    
    await team.completeMission(successful);
    
    res.json({
      message: 'Mission completed successfully',
      team,
      notes
    });
  } catch (error) {
    console.error('Error completing mission:', error);
    res.status(500).json({ message: 'Failed to complete mission', error: error.message });
  }
});

// Update team status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    
    const validStatuses = ['available', 'deployed', 'busy', 'maintenance'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status', 
        validStatuses 
      });
    }
    
    const team = await Team.findOne({ teamId: req.params.id });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    team.status = status;
    await team.save();
    
    res.json({
      message: 'Team status updated successfully',
      team
    });
  } catch (error) {
    console.error('Error updating team status:', error);
    res.status(500).json({ message: 'Failed to update team status', error: error.message });
  }
});

// Update team location
router.patch('/:id/location', async (req, res) => {
  try {
    const { address, coordinates } = req.body;
    
    const team = await Team.findOne({ teamId: req.params.id });
    
    if (!team) {
      return res.status(404).json({ message: 'Team not found' });
    }
    
    if (address) {
      team.location.current.address = address;
    }
    
    if (coordinates && coordinates.lat && coordinates.lng) {
      team.location.current.coordinates = coordinates;
    }
    
    await team.save();
    
    res.json({
      message: 'Team location updated successfully',
      team
    });
  } catch (error) {
    console.error('Error updating team location:', error);
    res.status(500).json({ message: 'Failed to update team location', error: error.message });
  }
});

// Get teams near location
router.post('/nearby', async (req, res) => {
  try {
    const { coordinates, maxDistance = 50000, type } = req.body;
    
    if (!coordinates || !coordinates.lat || !coordinates.lng) {
      return res.status(400).json({ message: 'Valid coordinates required' });
    }
    
    let teams = await Team.findNearLocation(coordinates, maxDistance);
    
    // Filter by type if specified
    if (type) {
      teams = teams.filter(team => team.type === type);
    }
    
    res.json(teams);
  } catch (error) {
    console.error('Error finding nearby teams:', error);
    res.status(500).json({ message: 'Failed to find nearby teams', error: error.message });
  }
});

// Get team statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalTeams,
      availableTeams,
      deployedTeams,
      teamsByType,
      teamPerformance
    ] = await Promise.all([
      Team.countDocuments(),
      Team.countDocuments({ status: 'available' }),
      Team.countDocuments({ status: 'deployed' }),
      Team.aggregate([
        { $group: { 
          _id: '$type', 
          total: { $sum: 1 },
          available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
          deployed: { $sum: { $cond: [{ $eq: ['$status', 'deployed'] }, 1, 0] } }
        }},
        { $sort: { total: -1 } }
      ]),
      Team.aggregate([
        { $group: {
          _id: null,
          totalMissions: { $sum: '$performance.totalMissions' },
          successfulMissions: { $sum: '$performance.successfulMissions' },
          avgResponseTime: { $avg: '$performance.averageResponseTime' }
        }}
      ])
    ]);

    const performance = teamPerformance[0] || {
      totalMissions: 0,
      successfulMissions: 0,
      avgResponseTime: 0
    };

    res.json({
      overview: {
        total: totalTeams,
        available: availableTeams,
        deployed: deployedTeams,
        busy: totalTeams - availableTeams - deployedTeams,
        availabilityRate: totalTeams > 0 ? ((availableTeams / totalTeams) * 100).toFixed(1) : 0
      },
      teamsByType,
      performance: {
        totalMissions: performance.totalMissions,
        successfulMissions: performance.successfulMissions,
        successRate: performance.totalMissions > 0 ? 
          ((performance.successfulMissions / performance.totalMissions) * 100).toFixed(1) : 0,
        averageResponseTime: Math.round(performance.avgResponseTime || 0)
      }
    });
  } catch (error) {
    console.error('Error fetching team statistics:', error);
    res.status(500).json({ message: 'Failed to fetch team statistics', error: error.message });
  }
});

module.exports = router;