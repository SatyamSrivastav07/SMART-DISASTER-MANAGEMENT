const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
const reportsDir = path.join(uploadsDir, 'reports');
const avatarsDir = path.join(uploadsDir, 'avatars');

[uploadsDir, reportsDir, avatarsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadsDir;
    
    if (req.route.path.includes('reports')) {
      uploadPath = reportsDir;
    } else if (req.route.path.includes('avatar')) {
      uploadPath = avatarsDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

// File filter for images
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extName = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimeType = allowedTypes.test(file.mimetype);
  
  if (mimeType && extName) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'), false);
  }
};

// File size limits
const limits = {
  fileSize: 10 * 1024 * 1024, // 10MB
  files: 5 // Maximum 5 files
};

// Upload configurations
const uploadReportImages = multer({
  storage,
  fileFilter: imageFilter,
  limits
}).array('images', 5);

const uploadAvatar = multer({
  storage,
  fileFilter: imageFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB for avatars
  }
}).single('avatar');

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File too large. Maximum size is 10MB for reports and 5MB for avatars.'
      });
    } else if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        message: 'Too many files. Maximum 5 images allowed per report.'
      });
    } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        message: 'Unexpected file field.'
      });
    }
  }
  
  if (error.message.includes('Only image files')) {
    return res.status(400).json({
      message: error.message
    });
  }
  
  next(error);
};

// Helper function to delete files
const deleteFile = (filePath) => {
  return new Promise((resolve) => {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file:', err);
      }
      resolve();
    });
  });
};

// Helper function to delete multiple files
const deleteFiles = async (filePaths) => {
  const deletePromises = filePaths.map(filePath => deleteFile(filePath));
  await Promise.all(deletePromises);
};

// Helper function to get file URL
const getFileUrl = (req, filename, type = 'reports') => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  return `${baseUrl}/uploads/${type}/${filename}`;
};

module.exports = {
  uploadReportImages,
  uploadAvatar,
  handleUploadError,
  deleteFile,
  deleteFiles,
  getFileUrl
};