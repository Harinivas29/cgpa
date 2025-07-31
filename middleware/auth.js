const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Verify JWT token
const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No token, authorization denied' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('department');
    
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: 'Access denied. Insufficient permissions.' 
      });
    }

    next();
  };
};

// Department-based authorization middleware
const authorizeDepartment = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Admin has access to all departments
  if (req.user.role === 'admin') {
    return next();
  }

  // Check if user belongs to the same department
  const departmentId = req.params.departmentId || req.body.department;
  
  if (departmentId && req.user.department._id.toString() !== departmentId) {
    return res.status(403).json({ 
      message: 'Access denied. Department mismatch.' 
    });
  }

  next();
};

// HOD authorization for their department
const authorizeHOD = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.user.role !== 'hod' && req.user.role !== 'admin') {
    return res.status(403).json({ 
      message: 'Access denied. HOD access required.' 
    });
  }

  // For HOD, check department match (admin can access all)
  if (req.user.role === 'hod') {
    const departmentId = req.params.departmentId || req.body.department;
    if (departmentId && req.user.department._id.toString() !== departmentId) {
      return res.status(403).json({ 
        message: 'Access denied. Department mismatch.' 
      });
    }
  }

  next();
};

// Teacher authorization for their subjects
const authorizeTeacher = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (!['teacher', 'hod', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ 
      message: 'Access denied. Teacher access required.' 
    });
  }

  next();
};

// Student authorization (can only access their own data)
const authorizeStudent = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.user.role === 'admin' || req.user.role === 'hod') {
    return next();
  }

  if (req.user.role === 'teacher') {
    // Teachers can access students in their department
    const studentId = req.params.studentId || req.body.student;
    if (studentId) {
      // This will be validated in the route handler
      return next();
    }
  }

  if (req.user.role === 'student') {
    // Students can only access their own data
    const studentId = req.params.studentId || req.body.student;
    if (studentId && studentId !== req.user._id.toString()) {
      return res.status(403).json({ 
        message: 'Access denied. Can only access own data.' 
      });
    }
  }

  next();
};

module.exports = {
  auth,
  authorize,
  authorizeDepartment,
  authorizeHOD,
  authorizeTeacher,
  authorizeStudent
};