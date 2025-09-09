const express = require('express');
const router = express.Router();

// Get training modules
router.get('/modules', (req, res) => {
  const modules = [
    {
      id: 'basic-safety',
      title: 'Basic Emergency Safety',
      description: 'Fundamental safety principles and emergency preparedness basics',
      duration: '2 hours',
      difficulty: 'Beginner',
      completed: false,
      progress: 0
    },
    {
      id: 'earthquake-response',
      title: 'Earthquake Response',
      description: 'Learn how to respond during and after earthquake events',
      duration: '3 hours',
      difficulty: 'Intermediate',
      completed: false,
      progress: 0
    },
    {
      id: 'fire-safety',
      title: 'Fire Safety & Prevention',
      description: 'Fire prevention, detection, and suppression techniques',
      duration: '2.5 hours',
      difficulty: 'Intermediate',
      completed: false,
      progress: 0
    }
  ];

  res.json(modules);
});

// Get specific training module
router.get('/modules/:id', (req, res) => {
  // In a real implementation, this would fetch from database
  res.json({
    message: `Training module ${req.params.id} details`,
    module: {
      id: req.params.id,
      content: 'Module content would be here',
      quiz: [],
      resources: []
    }
  });
});

// Update training progress
router.patch('/modules/:id/progress', (req, res) => {
  const { progress, completed } = req.body;
  
  res.json({
    message: 'Training progress updated',
    moduleId: req.params.id,
    progress,
    completed
  });
});

// Get user training statistics
router.get('/stats', (req, res) => {
  res.json({
    totalModules: 12,
    completedModules: 3,
    totalHours: 48,
    completedHours: 12,
    certificates: 1,
    overallProgress: 25
  });
});

module.exports = router;