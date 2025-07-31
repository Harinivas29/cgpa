const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, authorize, authorizeDepartment } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users
// @desc    Get all users with filters
// @access  Private (Admin, HOD)
router.get('/', [auth, authorize('admin', 'hod')], async (req, res) => {
  try {
    const { role, department, academicYear, semester, page = 1, limit = 10 } = req.query;
    
    let filter = { isActive: true };
    
    // If user is HOD, only show users from their department
    if (req.user.role === 'hod') {
      filter.department = req.user.department._id;
    }
    
    if (role) filter.role = role;
    if (department && req.user.role === 'admin') filter.department = department;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = semester;

    const users = await User.find(filter)
      .populate('department', 'name code')
      .select('-password')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await User.countDocuments(filter);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (Admin, HOD, Self)
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('department', 'name code')
      .select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    if (req.user.role === 'student' && req.user._id.toString() !== user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'hod' && user.department?._id.toString() !== req.user.department._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users
// @desc    Create new user
// @access  Private (Admin)
router.post('/', [
  auth,
  authorize('admin'),
  body('userId').notEmpty().withMessage('User ID is required'),
  body('email').isEmail().withMessage('Please include a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('firstName').notEmpty().withMessage('First name is required'),
  body('lastName').notEmpty().withMessage('Last name is required'),
  body('role').isIn(['admin', 'hod', 'teacher', 'student']).withMessage('Invalid role')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      userId,
      email,
      password,
      firstName,
      lastName,
      role,
      department,
      academicYear,
      semester,
      rollNumber,
      employeeId,
      phoneNumber,
      address,
      dateOfBirth
    } = req.body;

    // Check if user already exists
    let existingUser = await User.findOne({
      $or: [{ userId }, { email }]
    });

    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Validate department for non-admin roles
    if (role !== 'admin' && !department) {
      return res.status(400).json({ message: 'Department is required for this role' });
    }

    if (department) {
      const dept = await Department.findById(department);
      if (!dept) {
        return res.status(400).json({ message: 'Invalid department' });
      }
    }

    // Create user
    const user = new User({
      userId,
      email,
      password,
      firstName,
      lastName,
      role,
      department: role === 'admin' ? undefined : department,
      academicYear,
      semester,
      rollNumber,
      employeeId,
      phoneNumber,
      address,
      dateOfBirth
    });

    await user.save();

    const newUser = await User.findById(user._id)
      .populate('department', 'name code')
      .select('-password');

    res.status(201).json(newUser);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin, Self for profile updates)
router.put('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check permissions
    const isSelf = req.user._id.toString() === user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      address,
      dateOfBirth,
      profileImage,
      academicYear,
      semester,
      department,
      role,
      isActive
    } = req.body;

    // Students and teachers can only update their profile info
    if (!isAdmin) {
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (address) user.address = address;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;
      if (profileImage) user.profileImage = profileImage;
    } else {
      // Admin can update everything
      if (firstName) user.firstName = firstName;
      if (lastName) user.lastName = lastName;
      if (email) user.email = email;
      if (phoneNumber) user.phoneNumber = phoneNumber;
      if (address) user.address = address;
      if (dateOfBirth) user.dateOfBirth = dateOfBirth;
      if (profileImage) user.profileImage = profileImage;
      if (academicYear) user.academicYear = academicYear;
      if (semester) user.semester = semester;
      if (department) user.department = department;
      if (role) user.role = role;
      if (typeof isActive === 'boolean') user.isActive = isActive;
    }

    await user.save();

    const updatedUser = await User.findById(user._id)
      .populate('department', 'name code')
      .select('-password');

    res.json(updatedUser);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete/Deactivate user
// @access  Private (Admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Soft delete by setting isActive to false
    user.isActive = false;
    await user.save();

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/students/by-department/:departmentId
// @desc    Get students by department
// @access  Private (Admin, HOD, Teacher)
router.get('/students/by-department/:departmentId', [
  auth, 
  authorize('admin', 'hod', 'teacher'),
  authorizeDepartment
], async (req, res) => {
  try {
    const { academicYear, semester } = req.query;
    
    let filter = {
      role: 'student',
      department: req.params.departmentId,
      isActive: true
    };

    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = semester;

    const students = await User.find(filter)
      .populate('department', 'name code')
      .select('-password')
      .sort({ rollNumber: 1 });

    res.json(students);
  } catch (error) {
    console.error('Get students by department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/users/teachers/by-department/:departmentId
// @desc    Get teachers by department
// @access  Private (Admin, HOD)
router.get('/teachers/by-department/:departmentId', [
  auth, 
  authorize('admin', 'hod'),
  authorizeDepartment
], async (req, res) => {
  try {
    const teachers = await User.find({
      role: 'teacher',
      department: req.params.departmentId,
      isActive: true
    })
    .populate('department', 'name code')
    .select('-password')
    .sort({ firstName: 1 });

    res.json(teachers);
  } catch (error) {
    console.error('Get teachers by department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/users/bulk-create
// @desc    Bulk create users (CSV upload)
// @access  Private (Admin only)
router.post('/bulk-create', [auth, authorize('admin')], async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ message: 'Users array is required' });
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < users.length; i++) {
      try {
        const userData = users[i];
        
        // Check if user already exists
        const existingUser = await User.findOne({
          $or: [{ userId: userData.userId }, { email: userData.email }]
        });

        if (existingUser) {
          results.errors.push({
            row: i + 1,
            error: `User ${userData.userId} already exists`
          });
          continue;
        }

        const user = new User(userData);
        await user.save();
        
        results.success.push({
          row: i + 1,
          userId: userData.userId,
          name: `${userData.firstName} ${userData.lastName}`
        });
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message
        });
      }
    }

    res.json({
      message: `Bulk user creation completed. ${results.success.length} users created, ${results.errors.length} errors.`,
      results
    });
  } catch (error) {
    console.error('Bulk create users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;