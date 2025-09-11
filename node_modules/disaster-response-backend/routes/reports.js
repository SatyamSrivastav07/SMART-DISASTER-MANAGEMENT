const express = require('express');
const router = express.Router();
const { auth, adminOnly, adminOrResponder, optionalAuth } = require('../middleware/auth');
const { uploadReportImages, handleUploadError, getFileUrl, deleteFiles } = require('../middleware/upload');
const DisasterReport = require('../models/DisasterReport');
const User = require('../models/User');
const { body, validationResult, param } = require('express-validator');

// Validation middleware
const validateReport = [
  body('type').isIn([
    'earthquake', 'flood', 'fire', 'storm', 'landslide', 'accident', 
    'building_collapse', 'gas_leak', 'water_logging', 'tree_fall', 
    'power_outage', 'road_block', 'other'
  ]).withMessage('Invalid disaster type'),
  body('title').trim().isLength({ min: 5, max: 100 }).withMessage('Title must be between 5-100 characters'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10-1000 characters'),
  body('severity').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity level'),
  body('location.address').trim().isLength({ min: 5, max: 200 }).withMessage('Address must be between 5-200 characters'),
  body('location.coordinates.lat').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
  body('location.coordinates.lng').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
  body('contactInfo.phone').optional().isMobilePhone('en-IN').withMessage('Invalid phone number')
];

// Get all disaster reports (public + admin filters)
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      severity,
      status,
      location,
      radius = 50, // km
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    let query = {};
    
    // Public users only see public reports, admins see all
    if (!req.user || req.user.role === 'citizen') {
      query.isPublic = true;
    }

    // Filter by type
    if (type) query.type = type;
    
    // Filter by severity
    if (severity) query.severity = severity;
    
    // Filter by status
    if (status) {
      if (req.user && ['admin', 'responder'].includes(req.user.role)) {
        query.status = status;
      }
    } else {
      // Default: show active reports for public
      if (!req.user || req.user.role === 'citizen') {
        query.status = { $in: ['reported', 'verified', 'in_progress'] };
      }
    }

    // Location-based filtering
    if (location) {
      const [lat, lng] = location.split(',').map(Number);
      if (lat && lng) {
        const maxDistance = radius * 1000; // Convert to meters
        query['location.coordinates'] = {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxDistance
          }
        };
      }
    }

    const reports = await DisasterReport.find(query)
      .populate('reportedBy', 'name phone location.city')
      .populate('assignedTeams.teamId', 'name type status')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 });

    const total = await DisasterReport.countDocuments(query);

    // Remove sensitive info for non-admin users
    const sanitizedReports = reports.map(report => {
      const reportObj = report.toObject();
      
      if (!req.user || !['admin', 'responder'].includes(req.user.role)) {
        delete reportObj.reportedBy.phone;
        delete reportObj.contactInfo;
        delete reportObj.adminNotes;
        delete reportObj.metadata;
        
        if (!reportObj.contactInfo?.isContactPublic) {
          delete reportObj.contactInfo;
        }
      }
      
      return reportObj;
    });

    res.json({
      reports: sanitizedReports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ message: 'Failed to fetch disaster reports' });
  }
});

// Get single disaster report
router.get('/:id', optionalAuth, param('id').isMongoId(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: 'Invalid report ID' });
    }

    const report = await DisasterReport.findById(req.params.id)
      .populate('reportedBy', 'name phone location.city')
      .populate('assignedTeams.teamId', 'name type status contact')
      .populate('verifiedBy', 'name role')
      .populate('responses.responderId', 'name role');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check permissions
    if (!report.isPublic && (!req.user || req.user.role === 'citizen')) {
      if (!req.user || report.reportedBy._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Remove sensitive info for non-admin users
    const reportObj = report.toObject();
    if (!req.user || !['admin', 'responder'].includes(req.user.role)) {
      if (!reportObj.contactInfo?.isContactPublic) {
        delete reportObj.contactInfo;
      }
      delete reportObj.adminNotes;
      delete reportObj.metadata;
    }

    res.json(reportObj);

  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({ message: 'Failed to fetch report' });
  }
});

// Create new disaster report
router.post('/', auth, uploadReportImages, handleUploadError, validateReport, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Clean up uploaded files if validation fails
      if (req.files && req.files.length > 0) {
        const filePaths = req.files.map(file => file.path);
        await deleteFiles(filePaths);
      }
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const {
      type,
      title,
      description,
      severity,
      location,
      contactInfo,
      affectedPeople,
      isPublic,
      tags
    } = req.body;

    // Process uploaded images
    const images = req.files ? req.files.map(file => ({
      url: getFileUrl(req, file.filename, 'reports'),
      filename: file.filename,
      size: file.size,
      mimeType: file.mimetype
    })) : [];

    // Create report
    const report = new DisasterReport({
      reportedBy: req.user._id,
      type,
      title,
      description,
      severity: severity || 'medium',
      location,
      images,
      contactInfo: {
        ...contactInfo,
        phone: contactInfo?.phone || req.user.phone
      },
      affectedPeople,
      isPublic: isPublic !== false, // Default to true
      tags: tags || [],
      metadata: {
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip,
        reportingMethod: 'web'
      }
    });

    await report.save();
    await report.populate('reportedBy', 'name location.city');

    res.status(201).json({
      message: 'Disaster report submitted successfully',
      report: {
        id: report._id,
        reportId: report.reportId,
        type: report.type,
        title: report.title,
        severity: report.severity,
        status: report.status,
        location: report.location,
        createdAt: report.createdAt,
        priority: report.priority
      }
    });

  } catch (error) {
    console.error('Error creating report:', error);
    
    // Clean up uploaded files on error
    if (req.files && req.files.length > 0) {
      const filePaths = req.files.map(file => file.path);
      await deleteFiles(filePaths);
    }
    
    res.status(500).json({ message: 'Failed to create disaster report' });
  }
});

// Update report status (admin/responder only)
router.patch('/:id/status', auth, adminOrResponder, [
  param('id').isMongoId(),
  body('status').isIn(['reported', 'verified', 'in_progress', 'resolved', 'false_alarm']),
  body('adminNotes').optional().trim().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { status, adminNotes } = req.body;
    const updates = { status };

    if (adminNotes) updates.adminNotes = adminNotes;
    
    if (status === 'verified') {
      updates.verifiedBy = req.user._id;
      updates.verifiedAt = new Date();
    }

    const report = await DisasterReport.findByIdAndUpdate(
      req.params.id,
      updates,
      { new: true }
    ).populate('reportedBy', 'name');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({
      message: 'Report status updated successfully',
      report
    });

  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ message: 'Failed to update report status' });
  }
});

// Add response to report
router.post('/:id/responses', auth, adminOrResponder, [
  param('id').isMongoId(),
  body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Response message is required'),
  body('type').optional().isIn(['update', 'question', 'resolution'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { message, type } = req.body;
    
    const report = await DisasterReport.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          responses: {
            responderId: req.user._id,
            message,
            type: type || 'update'
          }
        }
      },
      { new: true }
    ).populate('responses.responderId', 'name role');

    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    res.json({
      message: 'Response added successfully',
      response: report.responses[report.responses.length - 1]
    });

  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({ message: 'Failed to add response' });
  }
});

// Get user's own reports
router.get('/my/reports', auth, async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    
    let query = { reportedBy: req.user._id };
    if (status) query.status = status;

    const reports = await DisasterReport.find(query)
      .populate('assignedTeams.teamId', 'name type')
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });

    const total = await DisasterReport.countDocuments(query);

    res.json({
      reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching user reports:', error);
    res.status(500).json({ message: 'Failed to fetch your reports' });
  }
});

// Get reports statistics
router.get('/stats/overview', optionalAuth, async (req, res) => {
  try {
    let baseQuery = {};
    
    // Limit stats for non-admin users
    if (!req.user || req.user.role === 'citizen') {
      baseQuery.isPublic = true;
    }

    const [
      totalReports,
      activeReports,
      resolvedReports,
      reportsByType,
      reportsBySeverity,
      recentReports
    ] = await Promise.all([
      DisasterReport.countDocuments(baseQuery),
      DisasterReport.countDocuments({ ...baseQuery, status: { $in: ['reported', 'verified', 'in_progress'] } }),
      DisasterReport.countDocuments({ ...baseQuery, status: 'resolved' }),
      DisasterReport.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      DisasterReport.aggregate([
        { $match: baseQuery },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      DisasterReport.find({ ...baseQuery, status: { $in: ['reported', 'verified', 'in_progress'] } })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('type severity title location.address createdAt priority')
    ]);

    res.json({
      overview: {
        total: totalReports,
        active: activeReports,
        resolved: resolvedReports,
        resolutionRate: totalReports > 0 ? ((resolvedReports / totalReports) * 100).toFixed(1) : 0
      },
      reportsByType,
      reportsBySeverity,
      recentReports
    });

  } catch (error) {
    console.error('Error fetching report statistics:', error);
    res.status(500).json({ message: 'Failed to fetch report statistics' });
  }
});

// Admin: Assign team to report
router.patch('/:id/assign-team', auth, adminOrResponder, [
  param('id').isMongoId(),
  body('teamId').isMongoId().withMessage('Valid team ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const { teamId } = req.body;
    const report = await DisasterReport.findById(req.params.id);
    
    if (!report) {
      return res.status(404).json({ message: 'Report not found' });
    }

    // Check if team is already assigned
    const isAlreadyAssigned = report.assignedTeams.some(
      team => team.teamId.toString() === teamId
    );

    if (isAlreadyAssigned) {
      return res.status(400).json({ message: 'Team already assigned to this report' });
    }

    report.assignedTeams.push({
      teamId,
      assignedAt: new Date(),
      status: 'assigned'
    });

    // Update report status if it was just reported
    if (report.status === 'reported') {
      report.status = 'in_progress';
    }

    await report.save();

    res.json({
      message: 'Team assigned successfully',
      report
    });

  } catch (error) {
    console.error('Error assigning team:', error);
    res.status(500).json({ message: 'Failed to assign team' });
  }
});

module.exports = router;