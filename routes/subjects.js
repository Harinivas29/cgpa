const express = require('express');
const { body, validationResult } = require('express-validator');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, authorize, authorizeHOD, authorizeDepartment } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/subjects
// @desc    Get all subjects with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      department, 
      semester, 
      academicYear, 
      teacher, 
      subjectType,
      page = 1, 
      limit = 10 
    } = req.query;
    
    let filter = { isActive: true };

    // Apply role-based filtering
    if (req.user.role === 'hod' || req.user.role === 'teacher') {
      filter.department = req.user.department._id;
    }

    if (req.user.role === 'student') {
      filter.department = req.user.department._id;
      filter.academicYear = req.user.academicYear;
      filter.semester = req.user.semester;
    }

    // Apply query filters
    if (department && req.user.role === 'admin') filter.department = department;
    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;
    if (teacher) filter.teacher = teacher;
    if (subjectType) filter.subjectType = subjectType;

    const subjects = await Subject.find(filter)
      .populate('department', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('prerequisites', 'name code')
      .sort({ semester: 1, name: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Subject.countDocuments(filter);

    res.json({
      subjects,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/subjects/:id
// @desc    Get subject by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id)
      .populate('department', 'name code')
      .populate('teacher', 'firstName lastName employeeId email')
      .populate('prerequisites', 'name code credits');

    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions
    if (req.user.role === 'student' || req.user.role === 'teacher' || req.user.role === 'hod') {
      if (subject.department._id.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(subject);
  } catch (error) {
    console.error('Get subject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/subjects
// @desc    Create new subject
// @access  Private (Admin, HOD)
router.post('/', [
  auth,
  authorize('admin', 'hod'),
  body('name').notEmpty().withMessage('Subject name is required'),
  body('code').notEmpty().withMessage('Subject code is required'),
  body('credits').isInt({ min: 1, max: 10 }).withMessage('Credits must be between 1 and 10'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Semester must be between 1 and 8'),
  body('academicYear').isIn(['1st Year', '2nd Year', '3rd Year', '4th Year']).withMessage('Invalid academic year')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      name,
      code,
      credits,
      department,
      semester,
      academicYear,
      subjectType,
      description,
      teacher,
      prerequisites,
      maxMarks,
      passingMarks
    } = req.body;

    // Set department based on user role
    let targetDepartment = department;
    if (req.user.role === 'hod') {
      targetDepartment = req.user.department._id;
    }

    // Validate department
    if (!targetDepartment) {
      return res.status(400).json({ message: 'Department is required' });
    }

    const dept = await Department.findById(targetDepartment);
    if (!dept) {
      return res.status(400).json({ message: 'Invalid department' });
    }

    // Check if subject code already exists in the department
    const existingSubject = await Subject.findOne({
      code: code.toUpperCase(),
      department: targetDepartment
    });

    if (existingSubject) {
      return res.status(400).json({ message: 'Subject code already exists in this department' });
    }

    // Validate teacher if provided
    if (teacher) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || !['teacher', 'hod'].includes(teacherUser.role)) {
        return res.status(400).json({ message: 'Invalid teacher selection' });
      }
      
      if (teacherUser.department.toString() !== targetDepartment.toString()) {
        return res.status(400).json({ message: 'Teacher must belong to the same department' });
      }
    }

    // Validate prerequisites
    if (prerequisites && prerequisites.length > 0) {
      const prereqSubjects = await Subject.find({
        _id: { $in: prerequisites },
        department: targetDepartment
      });

      if (prereqSubjects.length !== prerequisites.length) {
        return res.status(400).json({ message: 'Some prerequisite subjects are invalid' });
      }
    }

    // Create subject
    const subject = new Subject({
      name,
      code: code.toUpperCase(),
      credits,
      department: targetDepartment,
      semester,
      academicYear,
      subjectType,
      description,
      teacher,
      prerequisites,
      maxMarks,
      passingMarks
    });

    await subject.save();

    const newSubject = await Subject.findById(subject._id)
      .populate('department', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('prerequisites', 'name code');

    res.status(201).json(newSubject);
  } catch (error) {
    console.error('Create subject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/subjects/:id
// @desc    Update subject
// @access  Private (Admin, HOD)
router.put('/:id', [
  auth,
  authorize('admin', 'hod')
], async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions for HOD
    if (req.user.role === 'hod') {
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const {
      name,
      code,
      credits,
      semester,
      academicYear,
      subjectType,
      description,
      teacher,
      prerequisites,
      maxMarks,
      passingMarks,
      isActive
    } = req.body;

    // Check for duplicate code if being updated
    if (code && code.toUpperCase() !== subject.code) {
      const existingSubject = await Subject.findOne({
        code: code.toUpperCase(),
        department: subject.department,
        _id: { $ne: req.params.id }
      });

      if (existingSubject) {
        return res.status(400).json({ message: 'Subject code already exists in this department' });
      }
    }

    // Validate teacher if provided
    if (teacher && teacher !== subject.teacher?.toString()) {
      const teacherUser = await User.findById(teacher);
      if (!teacherUser || !['teacher', 'hod'].includes(teacherUser.role)) {
        return res.status(400).json({ message: 'Invalid teacher selection' });
      }
      
      if (teacherUser.department.toString() !== subject.department.toString()) {
        return res.status(400).json({ message: 'Teacher must belong to the same department' });
      }
    }

    // Update subject fields
    if (name) subject.name = name;
    if (code) subject.code = code.toUpperCase();
    if (credits !== undefined) subject.credits = credits;
    if (semester !== undefined) subject.semester = semester;
    if (academicYear) subject.academicYear = academicYear;
    if (subjectType) subject.subjectType = subjectType;
    if (description !== undefined) subject.description = description;
    if (teacher !== undefined) subject.teacher = teacher || undefined;
    if (prerequisites !== undefined) subject.prerequisites = prerequisites;
    if (maxMarks !== undefined) subject.maxMarks = maxMarks;
    if (passingMarks !== undefined) subject.passingMarks = passingMarks;
    if (typeof isActive === 'boolean') subject.isActive = isActive;

    await subject.save();

    const updatedSubject = await Subject.findById(subject._id)
      .populate('department', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('prerequisites', 'name code');

    res.json(updatedSubject);
  } catch (error) {
    console.error('Update subject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete/Deactivate subject
// @access  Private (Admin, HOD)
router.delete('/:id', [auth, authorize('admin', 'hod')], async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions for HOD
    if (req.user.role === 'hod') {
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    // Check if subject has grades
    const Grade = require('../models/Grade');
    const hasGrades = await Grade.countDocuments({ subject: req.params.id });

    if (hasGrades > 0) {
      return res.status(400).json({ 
        message: 'Cannot delete subject. It has associated grades. Deactivate instead.' 
      });
    }

    // Soft delete by setting isActive to false
    subject.isActive = false;
    await subject.save();

    res.json({ message: 'Subject deactivated successfully' });
  } catch (error) {
    console.error('Delete subject error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/subjects/department/:departmentId
// @desc    Get subjects by department
// @access  Private
router.get('/department/:departmentId', [
  auth,
  authorizeDepartment
], async (req, res) => {
  try {
    const { semester, academicYear, teacher } = req.query;
    
    let filter = {
      department: req.params.departmentId,
      isActive: true
    };

    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;
    if (teacher) filter.teacher = teacher;

    const subjects = await Subject.find(filter)
      .populate('teacher', 'firstName lastName employeeId')
      .populate('prerequisites', 'name code')
      .sort({ semester: 1, name: 1 });

    res.json(subjects);
  } catch (error) {
    console.error('Get subjects by department error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/subjects/teacher/:teacherId
// @desc    Get subjects by teacher
// @access  Private (Admin, HOD, Teacher themselves)
router.get('/teacher/:teacherId', auth, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role === 'teacher' && req.user._id.toString() !== req.params.teacherId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (req.user.role === 'hod') {
      const teacher = await User.findById(req.params.teacherId);
      if (!teacher || teacher.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { semester, academicYear } = req.query;
    
    let filter = {
      teacher: req.params.teacherId,
      isActive: true
    };

    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;

    const subjects = await Subject.find(filter)
      .populate('department', 'name code')
      .populate('prerequisites', 'name code')
      .sort({ semester: 1, name: 1 });

    res.json(subjects);
  } catch (error) {
    console.error('Get subjects by teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/subjects/:id/assign-teacher
// @desc    Assign teacher to subject
// @access  Private (Admin, HOD)
router.put('/:id/assign-teacher', [
  auth,
  authorize('admin', 'hod'),
  body('teacherId').notEmpty().withMessage('Teacher ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { teacherId } = req.body;

    const subject = await Subject.findById(req.params.id);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions for HOD
    if (req.user.role === 'hod') {
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const teacher = await User.findById(teacherId);
    if (!teacher || !['teacher', 'hod'].includes(teacher.role)) {
      return res.status(400).json({ message: 'Invalid teacher selection' });
    }

    if (teacher.department.toString() !== subject.department.toString()) {
      return res.status(400).json({ message: 'Teacher must belong to the same department' });
    }

    subject.teacher = teacherId;
    await subject.save();

    const updatedSubject = await Subject.findById(subject._id)
      .populate('department', 'name code')
      .populate('teacher', 'firstName lastName employeeId')
      .populate('prerequisites', 'name code');

    res.json(updatedSubject);
  } catch (error) {
    console.error('Assign teacher error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/subjects/bulk-create
// @desc    Bulk create subjects
// @access  Private (Admin, HOD)
router.post('/bulk-create', [auth, authorize('admin', 'hod')], async (req, res) => {
  try {
    const { subjects } = req.body;

    if (!Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ message: 'Subjects array is required' });
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < subjects.length; i++) {
      try {
        const subjectData = subjects[i];
        
        // Set department for HOD
        if (req.user.role === 'hod') {
          subjectData.department = req.user.department._id;
        }

        // Check if subject already exists
        const existingSubject = await Subject.findOne({
          code: subjectData.code?.toUpperCase(),
          department: subjectData.department
        });

        if (existingSubject) {
          results.errors.push({
            row: i + 1,
            error: `Subject ${subjectData.code} already exists in this department`
          });
          continue;
        }

        const subject = new Subject({
          ...subjectData,
          code: subjectData.code?.toUpperCase()
        });
        await subject.save();
        
        results.success.push({
          row: i + 1,
          code: subjectData.code,
          name: subjectData.name
        });
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message
        });
      }
    }

    res.json({
      message: `Bulk subject creation completed. ${results.success.length} subjects created, ${results.errors.length} errors.`,
      results
    });
  } catch (error) {
    console.error('Bulk create subjects error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;