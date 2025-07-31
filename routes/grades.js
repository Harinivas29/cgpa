const express = require('express');
const { body, validationResult } = require('express-validator');
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const User = require('../models/User');
const { auth, authorize, authorizeTeacher, authorizeStudent } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/grades
// @desc    Get grades with filters
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { 
      student, 
      subject, 
      teacher, 
      semester, 
      academicYear, 
      examType,
      isPublished,
      page = 1, 
      limit = 20 
    } = req.query;
    
    let filter = {};

    // Apply role-based filtering
    if (req.user.role === 'student') {
      filter.student = req.user._id;
      filter.isPublished = true;
    } else if (req.user.role === 'teacher') {
      filter.teacher = req.user._id;
    } else if (req.user.role === 'hod') {
      // HOD can see all grades in their department
      const subjects = await Subject.find({ 
        department: req.user.department._id 
      }).select('_id');
      filter.subject = { $in: subjects.map(s => s._id) };
    }

    // Apply query filters
    if (student && ['admin', 'hod', 'teacher'].includes(req.user.role)) {
      filter.student = student;
    }
    if (subject) filter.subject = subject;
    if (teacher && ['admin', 'hod'].includes(req.user.role)) filter.teacher = teacher;
    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;
    if (examType) filter.examType = examType;
    if (isPublished !== undefined && req.user.role !== 'student') {
      filter.isPublished = isPublished === 'true';
    }

    const grades = await Grade.find(filter)
      .populate('student', 'firstName lastName rollNumber academicYear semester')
      .populate('subject', 'name code credits department')
      .populate('teacher', 'firstName lastName employeeId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Grade.countDocuments(filter);

    res.json({
      grades,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get grades error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/grades/:id
// @desc    Get grade by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id)
      .populate('student', 'firstName lastName rollNumber academicYear semester')
      .populate('subject', 'name code credits department')
      .populate('teacher', 'firstName lastName employeeId');

    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    // Check permissions
    if (req.user.role === 'student') {
      if (grade.student._id.toString() !== req.user._id.toString() || !grade.isPublished) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'teacher') {
      if (grade.teacher._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'hod') {
      if (grade.subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    res.json(grade);
  } catch (error) {
    console.error('Get grade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/grades
// @desc    Create/Update grade
// @access  Private (Teacher, HOD, Admin)
router.post('/', [
  auth,
  authorize('admin', 'hod', 'teacher'),
  body('student').notEmpty().withMessage('Student ID is required'),
  body('subject').notEmpty().withMessage('Subject ID is required'),
  body('semester').isInt({ min: 1, max: 8 }).withMessage('Valid semester is required'),
  body('academicYear').notEmpty().withMessage('Academic year is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      student,
      subject,
      marks,
      semester,
      academicYear,
      examType = 'Regular',
      remarks
    } = req.body;

    // Validate subject and get department
    const subjectDoc = await Subject.findById(subject);
    if (!subjectDoc) {
      return res.status(400).json({ message: 'Invalid subject' });
    }

    // Check if teacher is authorized for this subject
    if (req.user.role === 'teacher') {
      if (subjectDoc.teacher?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You are not assigned to this subject' });
      }
    } else if (req.user.role === 'hod') {
      if (subjectDoc.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Subject not in your department' });
      }
    }

    // Validate student
    const studentDoc = await User.findById(student);
    if (!studentDoc || studentDoc.role !== 'student') {
      return res.status(400).json({ message: 'Invalid student' });
    }

    // Check if student belongs to the subject's department
    if (studentDoc.department.toString() !== subjectDoc.department.toString()) {
      return res.status(400).json({ message: 'Student not in subject department' });
    }

    // Validate marks
    if (!marks || typeof marks !== 'object') {
      return res.status(400).json({ message: 'Valid marks object is required' });
    }

    const { theory, practical, internal } = marks;
    
    if (theory !== undefined && (theory < 0 || theory > 100)) {
      return res.status(400).json({ message: 'Theory marks must be between 0 and 100' });
    }
    if (practical !== undefined && (practical < 0 || practical > 100)) {
      return res.status(400).json({ message: 'Practical marks must be between 0 and 100' });
    }
    if (internal !== undefined && (internal < 0 || internal > 100)) {
      return res.status(400).json({ message: 'Internal marks must be between 0 and 100' });
    }

    // Check if grade already exists
    let existingGrade = await Grade.findOne({
      student,
      subject,
      examType
    });

    if (existingGrade) {
      // Update existing grade
      existingGrade.marks = marks;
      existingGrade.semester = semester;
      existingGrade.academicYear = academicYear;
      existingGrade.teacher = req.user._id;
      existingGrade.remarks = remarks;
      existingGrade.isPublished = false; // Reset publication status
      
      await existingGrade.save();

      const updatedGrade = await Grade.findById(existingGrade._id)
        .populate('student', 'firstName lastName rollNumber')
        .populate('subject', 'name code credits')
        .populate('teacher', 'firstName lastName');

      res.json(updatedGrade);
    } else {
      // Create new grade
      const grade = new Grade({
        student,
        subject,
        teacher: req.user._id,
        marks,
        semester,
        academicYear,
        examType,
        remarks
      });

      await grade.save();

      const newGrade = await Grade.findById(grade._id)
        .populate('student', 'firstName lastName rollNumber')
        .populate('subject', 'name code credits')
        .populate('teacher', 'firstName lastName');

      res.status(201).json(newGrade);
    }
  } catch (error) {
    console.error('Create/Update grade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/grades/:id
// @desc    Update grade
// @access  Private (Teacher, HOD, Admin)
router.put('/:id', [
  auth,
  authorize('admin', 'hod', 'teacher')
], async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id);
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    // Check permissions
    if (req.user.role === 'teacher') {
      if (grade.teacher.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'hod') {
      const subject = await Subject.findById(grade.subject);
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { marks, remarks, isPublished } = req.body;

    if (marks) {
      const { theory, practical, internal } = marks;
      
      if (theory !== undefined && (theory < 0 || theory > 100)) {
        return res.status(400).json({ message: 'Theory marks must be between 0 and 100' });
      }
      if (practical !== undefined && (practical < 0 || practical > 100)) {
        return res.status(400).json({ message: 'Practical marks must be between 0 and 100' });
      }
      if (internal !== undefined && (internal < 0 || internal > 100)) {
        return res.status(400).json({ message: 'Internal marks must be between 0 and 100' });
      }

      grade.marks = marks;
    }

    if (remarks !== undefined) grade.remarks = remarks;
    if (typeof isPublished === 'boolean') {
      grade.isPublished = isPublished;
      if (isPublished) {
        grade.publishedAt = new Date();
      }
    }

    await grade.save();

    const updatedGrade = await Grade.findById(grade._id)
      .populate('student', 'firstName lastName rollNumber')
      .populate('subject', 'name code credits')
      .populate('teacher', 'firstName lastName');

    res.json(updatedGrade);
  } catch (error) {
    console.error('Update grade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/grades/:id
// @desc    Delete grade
// @access  Private (Admin, HOD)
router.delete('/:id', [auth, authorize('admin', 'hod')], async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id);
    if (!grade) {
      return res.status(404).json({ message: 'Grade not found' });
    }

    // Check permissions for HOD
    if (req.user.role === 'hod') {
      const subject = await Subject.findById(grade.subject);
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    await Grade.findByIdAndDelete(req.params.id);
    res.json({ message: 'Grade deleted successfully' });
  } catch (error) {
    console.error('Delete grade error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/grades/bulk-create
// @desc    Bulk create/update grades
// @access  Private (Teacher, HOD, Admin)
router.post('/bulk-create', [auth, authorize('admin', 'hod', 'teacher')], async (req, res) => {
  try {
    const { grades } = req.body;

    if (!Array.isArray(grades) || grades.length === 0) {
      return res.status(400).json({ message: 'Grades array is required' });
    }

    const results = {
      success: [],
      errors: []
    };

    for (let i = 0; i < grades.length; i++) {
      try {
        const gradeData = grades[i];
        
        // Validate required fields
        if (!gradeData.student || !gradeData.subject) {
          results.errors.push({
            row: i + 1,
            error: 'Student and subject are required'
          });
          continue;
        }

        // Check if grade already exists
        let existingGrade = await Grade.findOne({
          student: gradeData.student,
          subject: gradeData.subject,
          examType: gradeData.examType || 'Regular'
        });

        if (existingGrade) {
          // Update existing grade
          existingGrade.marks = gradeData.marks;
          existingGrade.teacher = req.user._id;
          await existingGrade.save();
          
          results.success.push({
            row: i + 1,
            action: 'updated',
            gradeId: existingGrade._id
          });
        } else {
          // Create new grade
          const grade = new Grade({
            ...gradeData,
            teacher: req.user._id
          });
          await grade.save();
          
          results.success.push({
            row: i + 1,
            action: 'created',
            gradeId: grade._id
          });
        }
      } catch (error) {
        results.errors.push({
          row: i + 1,
          error: error.message
        });
      }
    }

    res.json({
      message: `Bulk grade operation completed. ${results.success.length} grades processed, ${results.errors.length} errors.`,
      results
    });
  } catch (error) {
    console.error('Bulk create grades error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/grades/publish-bulk
// @desc    Publish multiple grades
// @access  Private (Teacher, HOD, Admin)
router.post('/publish-bulk', [
  auth,
  authorize('admin', 'hod', 'teacher'),
  body('gradeIds').isArray().withMessage('Grade IDs array is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { gradeIds } = req.body;

    // Validate grades and permissions
    const grades = await Grade.find({ 
      _id: { $in: gradeIds } 
    }).populate('subject', 'department teacher');

    if (grades.length !== gradeIds.length) {
      return res.status(400).json({ message: 'Some grades not found' });
    }

    // Check permissions
    for (const grade of grades) {
      if (req.user.role === 'teacher') {
        if (grade.teacher.toString() !== req.user._id.toString()) {
          return res.status(403).json({ message: 'Access denied for some grades' });
        }
      } else if (req.user.role === 'hod') {
        if (grade.subject.department.toString() !== req.user.department._id.toString()) {
          return res.status(403).json({ message: 'Access denied for some grades' });
        }
      }
    }

    // Publish grades
    await Grade.updateMany(
      { _id: { $in: gradeIds } },
      { 
        isPublished: true, 
        publishedAt: new Date() 
      }
    );

    res.json({ message: `${gradeIds.length} grades published successfully` });
  } catch (error) {
    console.error('Publish bulk grades error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/grades/student/:studentId/cgpa
// @desc    Calculate and get student CGPA
// @access  Private
router.get('/student/:studentId/cgpa', auth, async (req, res) => {
  try {
    // Check permissions
    if (req.user.role === 'student' && req.user._id.toString() !== req.params.studentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { semester, academicYear } = req.query;

    let filter = {
      student: req.params.studentId,
      isPublished: true
    };

    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;

    const grades = await Grade.find(filter)
      .populate('subject', 'name code credits semester academicYear')
      .sort({ semester: 1, 'subject.name': 1 });

    if (grades.length === 0) {
      return res.json({
        cgpa: 0,
        sgpa: {},
        totalCredits: 0,
        gradesCount: 0,
        semesterWise: [],
        overallGrades: []
      });
    }

    // Calculate SGPA for each semester
    const semesterData = {};
    let totalGradePoints = 0;
    let totalCredits = 0;

    grades.forEach(grade => {
      const sem = grade.semester;
      const credits = grade.subject.credits;
      const gradePoints = grade.gradePoints * credits;

      if (!semesterData[sem]) {
        semesterData[sem] = {
          semester: sem,
          totalGradePoints: 0,
          totalCredits: 0,
          grades: []
        };
      }

      semesterData[sem].totalGradePoints += gradePoints;
      semesterData[sem].totalCredits += credits;
      semesterData[sem].grades.push({
        subject: grade.subject,
        marks: grade.marks,
        grade: grade.grade,
        gradePoints: grade.gradePoints,
        credits: credits
      });

      totalGradePoints += gradePoints;
      totalCredits += credits;
    });

    // Calculate SGPA for each semester
    const semesterWise = Object.values(semesterData).map(sem => ({
      ...sem,
      sgpa: sem.totalCredits > 0 ? (sem.totalGradePoints / sem.totalCredits).toFixed(2) : 0
    }));

    // Calculate overall CGPA
    const cgpa = totalCredits > 0 ? (totalGradePoints / totalCredits).toFixed(2) : 0;

    res.json({
      cgpa: parseFloat(cgpa),
      totalCredits,
      gradesCount: grades.length,
      semesterWise,
      overallGrades: grades.map(grade => ({
        subject: grade.subject,
        marks: grade.marks,
        grade: grade.grade,
        gradePoints: grade.gradePoints,
        semester: grade.semester,
        academicYear: grade.academicYear
      }))
    });
  } catch (error) {
    console.error('Calculate CGPA error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/grades/subject/:subjectId/statistics
// @desc    Get grade statistics for a subject
// @access  Private (Teacher, HOD, Admin)
router.get('/subject/:subjectId/statistics', [
  auth,
  authorize('admin', 'hod', 'teacher')
], async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions
    if (req.user.role === 'teacher') {
      if (subject.teacher?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    } else if (req.user.role === 'hod') {
      if (subject.department.toString() !== req.user.department._id.toString()) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { semester, academicYear, examType } = req.query;
    
    let filter = {
      subject: req.params.subjectId,
      isPublished: true
    };

    if (semester) filter.semester = semester;
    if (academicYear) filter.academicYear = academicYear;
    if (examType) filter.examType = examType;

    const grades = await Grade.find(filter)
      .populate('student', 'firstName lastName rollNumber');

    if (grades.length === 0) {
      return res.json({
        totalStudents: 0,
        averageMarks: 0,
        averageGrade: 'N/A',
        passPercentage: 0,
        gradeDistribution: {},
        topPerformers: []
      });
    }

    // Calculate statistics
    const totalStudents = grades.length;
    const totalMarks = grades.reduce((sum, grade) => sum + grade.marks.total, 0);
    const averageMarks = (totalMarks / totalStudents).toFixed(2);

    const passedStudents = grades.filter(grade => grade.gradePoints >= 4).length;
    const passPercentage = ((passedStudents / totalStudents) * 100).toFixed(2);

    // Grade distribution
    const gradeDistribution = {};
    grades.forEach(grade => {
      gradeDistribution[grade.grade] = (gradeDistribution[grade.grade] || 0) + 1;
    });

    // Top performers (top 5)
    const topPerformers = grades
      .sort((a, b) => b.marks.total - a.marks.total)
      .slice(0, 5)
      .map(grade => ({
        student: grade.student,
        marks: grade.marks,
        grade: grade.grade,
        gradePoints: grade.gradePoints
      }));

    res.json({
      subject: {
        name: subject.name,
        code: subject.code,
        credits: subject.credits
      },
      totalStudents,
      averageMarks: parseFloat(averageMarks),
      passPercentage: parseFloat(passPercentage),
      gradeDistribution,
      topPerformers
    });
  } catch (error) {
    console.error('Get subject statistics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;