const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/departments
// @desc    Get all departments
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { isActive = true } = req.query;
    
    const departments = await Department.find({ isActive })
      .populate('hod', 'firstName lastName employeeId')
      .sort({ name: 1 });

    res.json(departments);
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/departments/:id
// @desc    Get department by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('hod', 'firstName lastName employeeId email phoneNumber');

    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Get department statistics
    const stats = await Promise.all([
      User.countDocuments({ department: req.params.id, role: 'student', isActive: true }),
      User.countDocuments({ department: req.params.id, role: 'teacher', isActive: true }),
      User.countDocuments({ department: req.params.id, role: 'hod', isActive: true })
    ]);

    res.json({
      ...department.toObject(),
      stats: {
        totalStudents: stats[0],
        totalTeachers: stats[1],
        totalHODs: stats[2]
      }
    });
  } catch (error) {
    console.error('Get department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/departments
// @desc    Create new department
// @access  Private (Admin only)
router.post('/', [
  auth,
  authorize('admin'),
  body('name').notEmpty().withMessage('Department name is required'),
  body('code').notEmpty().withMessage('Department code is required'),
  body('code').isLength({ min: 2, max: 10 }).withMessage('Department code must be 2-10 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      code,
      description,
      hod,
      establishedYear,
      totalSemesters
    } = req.body;

    // Check if department already exists
    let existingDept = await Department.findOne({
      $or: [
        { name: { $regex: new RegExp(name, 'i') } },
        { code: code.toUpperCase() }
      ]
    });

    if (existingDept) {
      return res.status(400).json({ message: 'Department with this name or code already exists' });
    }

    // Validate HOD if provided
    if (hod) {
      const hodUser = await User.findById(hod);
      if (!hodUser || hodUser.role !== 'hod') {
        return res.status(400).json({ message: 'Invalid HOD selection' });
      }
    }

    // Create department
    const department = new Department({
      name,
      code: code.toUpperCase(),
      description,
      hod,
      establishedYear,
      totalSemesters
    });

    await department.save();

    // Update HOD's department if provided
    if (hod) {
      await User.findByIdAndUpdate(hod, { department: department._id });
    }

    const newDepartment = await Department.findById(department._id)
      .populate('hod', 'firstName lastName employeeId');

    res.status(201).json(newDepartment);
  } catch (error) {
    console.error('Create department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/departments/:id
// @desc    Update department
// @access  Private (Admin only)
router.put('/:id', [
  auth,
  authorize('admin')
], async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const {
      name,
      code,
      description,
      hod,
      establishedYear,
      totalSemesters,
      isActive
    } = req.body;

    // Check for duplicate name/code if being updated
    if (name || code) {
      const duplicateQuery = {
        _id: { $ne: req.params.id }
      };

      if (name) {
        duplicateQuery.name = { $regex: new RegExp(name, 'i') };
      }
      
      if (code) {
        duplicateQuery.code = code.toUpperCase();
      }

      const existingDept = await Department.findOne(duplicateQuery);
      if (existingDept) {
        return res.status(400).json({ message: 'Department with this name or code already exists' });
      }
    }

    // Validate new HOD if provided
    if (hod && hod !== department.hod?.toString()) {
      const hodUser = await User.findById(hod);
      if (!hodUser || hodUser.role !== 'hod') {
        return res.status(400).json({ message: 'Invalid HOD selection' });
      }

      // Remove old HOD's department reference
      if (department.hod) {
        await User.findByIdAndUpdate(department.hod, { $unset: { department: 1 } });
      }

      // Update new HOD's department
      await User.findByIdAndUpdate(hod, { department: req.params.id });
    }

    // Update department fields
    if (name) department.name = name;
    if (code) department.code = code.toUpperCase();
    if (description !== undefined) department.description = description;
    if (hod !== undefined) department.hod = hod || undefined;
    if (establishedYear) department.establishedYear = establishedYear;
    if (totalSemesters) department.totalSemesters = totalSemesters;
    if (typeof isActive === 'boolean') department.isActive = isActive;

    await department.save();

    const updatedDepartment = await Department.findById(department._id)
      .populate('hod', 'firstName lastName employeeId');

    res.json(updatedDepartment);
  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/departments/:id
// @desc    Delete/Deactivate department
// @access  Private (Admin only)
router.delete('/:id', [auth, authorize('admin')], async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Check if department has active users
    const activeUsers = await User.countDocuments({
      department: req.params.id,
      isActive: true
    });

    if (activeUsers > 0) {
      return res.status(400).json({ 
        message: `Cannot delete department. It has ${activeUsers} active users. Please deactivate or transfer users first.` 
      });
    }

    // Soft delete by setting isActive to false
    department.isActive = false;
    await department.save();

    res.json({ message: 'Department deactivated successfully' });
  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/departments/:id/users
// @desc    Get all users in a department
// @access  Private (Admin, HOD of that department)
router.get('/:id/users', auth, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'hod' || req.user.department._id.toString() !== req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { role, academicYear, semester, page = 1, limit = 20 } = req.query;
    
    let filter = {
      department: req.params.id,
      isActive: true
    };

    if (role) filter.role = role;
    if (academicYear) filter.academicYear = academicYear;
    if (semester) filter.semester = semester;

    const users = await User.find(filter)
      .select('-password')
      .sort({ role: 1, firstName: 1 })
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
    console.error('Get department users error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/departments/:id/hod
// @desc    Assign HOD to department
// @access  Private (Admin only)
router.put('/:id/hod', [
  auth,
  authorize('admin'),
  body('hodId').notEmpty().withMessage('HOD ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { hodId } = req.body;

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    const hodUser = await User.findById(hodId);
    if (!hodUser || hodUser.role !== 'hod') {
      return res.status(400).json({ message: 'Invalid HOD selection' });
    }

    // Remove old HOD's department reference
    if (department.hod) {
      await User.findByIdAndUpdate(department.hod, { $unset: { department: 1 } });
    }

    // Update department HOD
    department.hod = hodId;
    await department.save();

    // Update HOD's department
    await User.findByIdAndUpdate(hodId, { department: req.params.id });

    const updatedDepartment = await Department.findById(department._id)
      .populate('hod', 'firstName lastName employeeId');

    res.json(updatedDepartment);
  } catch (error) {
    console.error('Assign HOD error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/departments/:id/statistics
// @desc    Get department statistics
// @access  Private (Admin, HOD of that department)
router.get('/:id/statistics', auth, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role !== 'admin') {
      if (req.user.role !== 'hod' || req.user.department._id.toString() !== req.params.id) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ message: 'Department not found' });
    }

    // Get comprehensive statistics
    const [
      totalStudents,
      totalTeachers,
      studentsByYear,
      studentsBySemester,
      activeSubjects
    ] = await Promise.all([
      User.countDocuments({ department: req.params.id, role: 'student', isActive: true }),
      User.countDocuments({ department: req.params.id, role: 'teacher', isActive: true }),
      User.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(req.params.id), role: 'student', isActive: true } },
        { $group: { _id: '$academicYear', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      User.aggregate([
        { $match: { department: new mongoose.Types.ObjectId(req.params.id), role: 'student', isActive: true } },
        { $group: { _id: '$semester', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      require('../models/Subject').countDocuments({ department: req.params.id, isActive: true })
    ]);

    res.json({
      department: {
        name: department.name,
        code: department.code
      },
      totalStudents,
      totalTeachers,
      activeSubjects,
      distribution: {
        byAcademicYear: studentsByYear,
        bySemester: studentsBySemester
      }
    });
  } catch (error) {
    console.error('Get department statistics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;