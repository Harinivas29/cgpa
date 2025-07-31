const express = require('express');
const mongoose = require('mongoose');
const Grade = require('../models/Grade');
const Subject = require('../models/Subject');
const User = require('../models/User');
const Department = require('../models/Department');
const { auth, authorize } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/analytics/dashboard
// @desc    Get dashboard analytics based on user role
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    let analytics = {};

    switch (req.user.role) {
      case 'admin':
        analytics = await getAdminDashboard();
        break;
      case 'hod':
        analytics = await getHODDashboard(req.user.department._id);
        break;
      case 'teacher':
        analytics = await getTeacherDashboard(req.user._id);
        break;
      case 'student':
        analytics = await getStudentDashboard(req.user._id);
        break;
      default:
        return res.status(403).json({ message: 'Access denied' });
    }

    res.json(analytics);
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Admin Dashboard
async function getAdminDashboard() {
  const [
    totalUsers,
    totalDepartments,
    totalSubjects,
    totalGrades,
    usersByRole,
    departmentStats,
    recentActivity
  ] = await Promise.all([
    User.countDocuments({ isActive: true }),
    Department.countDocuments({ isActive: true }),
    Subject.countDocuments({ isActive: true }),
    Grade.countDocuments({ isPublished: true }),
    User.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$role', count: { $sum: 1 } } }
    ]),
    Department.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: 'department',
          as: 'users'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          totalUsers: { $size: '$users' },
          students: {
            $size: {
              $filter: {
                input: '$users',
                cond: { $eq: ['$$this.role', 'student'] }
              }
            }
          },
          teachers: {
            $size: {
              $filter: {
                input: '$users',
                cond: { $eq: ['$$this.role', 'teacher'] }
              }
            }
          }
        }
      },
      { $sort: { name: 1 } }
    ]),
    Grade.find({ isPublished: true })
      .populate('student', 'firstName lastName')
      .populate('subject', 'name code')
      .sort({ publishedAt: -1 })
      .limit(10)
  ]);

  return {
    overview: {
      totalUsers,
      totalDepartments,
      totalSubjects,
      totalGrades
    },
    userDistribution: usersByRole.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {}),
    departmentStats,
    recentActivity
  };
}

// HOD Dashboard
async function getHODDashboard(departmentId) {
  const [
    totalStudents,
    totalTeachers,
    totalSubjects,
    totalGrades,
    studentsByYear,
    subjectsByYear,
    gradeDistribution,
    topPerformers
  ] = await Promise.all([
    User.countDocuments({ department: departmentId, role: 'student', isActive: true }),
    User.countDocuments({ department: departmentId, role: 'teacher', isActive: true }),
    Subject.countDocuments({ department: departmentId, isActive: true }),
    Grade.aggregate([
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo'
        }
      },
      { $unwind: '$subjectInfo' },
      { $match: { 'subjectInfo.department': new mongoose.Types.ObjectId(departmentId), isPublished: true } },
      { $count: 'total' }
    ]).then(result => result[0]?.total || 0),
    User.aggregate([
      { $match: { department: new mongoose.Types.ObjectId(departmentId), role: 'student', isActive: true } },
      { $group: { _id: '$academicYear', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Subject.aggregate([
      { $match: { department: new mongoose.Types.ObjectId(departmentId), isActive: true } },
      { $group: { _id: '$academicYear', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Grade.aggregate([
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo'
        }
      },
      { $unwind: '$subjectInfo' },
      { $match: { 'subjectInfo.department': new mongoose.Types.ObjectId(departmentId), isPublished: true } },
      { $group: { _id: '$grade', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]),
    Grade.aggregate([
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo'
        }
      },
      { $unwind: '$subjectInfo' },
      { $match: { 'subjectInfo.department': new mongoose.Types.ObjectId(departmentId), isPublished: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'studentInfo'
        }
      },
      { $unwind: '$studentInfo' },
      {
        $group: {
          _id: '$student',
          student: { $first: '$studentInfo' },
          totalGradePoints: { $sum: { $multiply: ['$gradePoints', '$subjectInfo.credits'] } },
          totalCredits: { $sum: '$subjectInfo.credits' },
          avgGradePoints: { $avg: '$gradePoints' }
        }
      },
      {
        $project: {
          student: 1,
          cgpa: { $divide: ['$totalGradePoints', '$totalCredits'] },
          avgGradePoints: 1
        }
      },
      { $sort: { cgpa: -1 } },
      { $limit: 10 }
    ])
  ]);

  return {
    overview: {
      totalStudents,
      totalTeachers,
      totalSubjects,
      totalGrades
    },
    distribution: {
      studentsByYear,
      subjectsByYear
    },
    performance: {
      gradeDistribution,
      topPerformers
    }
  };
}

// Teacher Dashboard
async function getTeacherDashboard(teacherId) {
  const [
    totalSubjects,
    totalStudents,
    totalGrades,
    publishedGrades,
    subjectStats,
    recentGrades
  ] = await Promise.all([
    Subject.countDocuments({ teacher: teacherId, isActive: true }),
    Grade.aggregate([
      { $match: { teacher: new mongoose.Types.ObjectId(teacherId) } },
      { $group: { _id: '$student' } },
      { $count: 'total' }
    ]).then(result => result[0]?.total || 0),
    Grade.countDocuments({ teacher: teacherId }),
    Grade.countDocuments({ teacher: teacherId, isPublished: true }),
    Subject.aggregate([
      { $match: { teacher: new mongoose.Types.ObjectId(teacherId), isActive: true } },
      {
        $lookup: {
          from: 'grades',
          localField: '_id',
          foreignField: 'subject',
          as: 'grades'
        }
      },
      {
        $project: {
          name: 1,
          code: 1,
          credits: 1,
          semester: 1,
          totalGrades: { $size: '$grades' },
          publishedGrades: {
            $size: {
              $filter: {
                input: '$grades',
                cond: { $eq: ['$$this.isPublished', true] }
              }
            }
          },
          averageMarks: {
            $avg: {
              $map: {
                input: {
                  $filter: {
                    input: '$grades',
                    cond: { $eq: ['$$this.isPublished', true] }
                  }
                },
                as: 'grade',
                in: '$$grade.marks.total'
              }
            }
          }
        }
      }
    ]),
    Grade.find({ teacher: teacherId })
      .populate('student', 'firstName lastName rollNumber')
      .populate('subject', 'name code')
      .sort({ updatedAt: -1 })
      .limit(10)
  ]);

  return {
    overview: {
      totalSubjects,
      totalStudents,
      totalGrades,
      publishedGrades,
      pendingGrades: totalGrades - publishedGrades
    },
    subjectStats,
    recentGrades
  };
}

// Student Dashboard
async function getStudentDashboard(studentId) {
  const [
    totalSubjects,
    completedSubjects,
    cgpaData,
    recentGrades,
    semesterProgress
  ] = await Promise.all([
    Grade.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId) } },
      { $group: { _id: '$subject' } },
      { $count: 'total' }
    ]).then(result => result[0]?.total || 0),
    Grade.countDocuments({ student: studentId, isPublished: true }),
    Grade.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId), isPublished: true } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo'
        }
      },
      { $unwind: '$subjectInfo' },
      {
        $group: {
          _id: null,
          totalGradePoints: { $sum: { $multiply: ['$gradePoints', '$subjectInfo.credits'] } },
          totalCredits: { $sum: '$subjectInfo.credits' }
        }
      },
      {
        $project: {
          cgpa: { $divide: ['$totalGradePoints', '$totalCredits'] }
        }
      }
    ]).then(result => result[0]?.cgpa || 0),
    Grade.find({ student: studentId, isPublished: true })
      .populate('subject', 'name code credits')
      .sort({ publishedAt: -1 })
      .limit(5),
    Grade.aggregate([
      { $match: { student: new mongoose.Types.ObjectId(studentId), isPublished: true } },
      {
        $lookup: {
          from: 'subjects',
          localField: 'subject',
          foreignField: '_id',
          as: 'subjectInfo'
        }
      },
      { $unwind: '$subjectInfo' },
      {
        $group: {
          _id: '$semester',
          totalGradePoints: { $sum: { $multiply: ['$gradePoints', '$subjectInfo.credits'] } },
          totalCredits: { $sum: '$subjectInfo.credits' },
          subjectCount: { $sum: 1 }
        }
      },
      {
        $project: {
          semester: '$_id',
          sgpa: { $divide: ['$totalGradePoints', '$totalCredits'] },
          totalCredits: 1,
          subjectCount: 1
        }
      },
      { $sort: { semester: 1 } }
    ])
  ]);

  return {
    overview: {
      totalSubjects,
      completedSubjects,
      cgpa: parseFloat(cgpaData.toFixed(2)),
      pendingSubjects: totalSubjects - completedSubjects
    },
    recentGrades,
    semesterProgress
  };
}

// @route   GET /api/analytics/department/:departmentId/performance
// @desc    Get department performance analytics
// @access  Private (Admin, HOD)
router.get('/department/:departmentId/performance', [
  auth,
  authorize('admin', 'hod')
], async (req, res) => {
  try {
    // Check HOD permissions
    if (req.user.role === 'hod' && req.user.department._id.toString() !== req.params.departmentId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const departmentId = req.params.departmentId;
    const { academicYear, semester } = req.query;

    let matchCondition = {
      'subjectInfo.department': new mongoose.Types.ObjectId(departmentId),
      isPublished: true
    };

    if (academicYear) matchCondition.academicYear = academicYear;
    if (semester) matchCondition.semester = parseInt(semester);

    const [
      overallStats,
      gradeDistribution,
      subjectWisePerformance,
      studentRankings
    ] = await Promise.all([
      Grade.aggregate([
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectInfo'
          }
        },
        { $unwind: '$subjectInfo' },
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalGrades: { $sum: 1 },
            averageMarks: { $avg: '$marks.total' },
            averageGradePoints: { $avg: '$gradePoints' },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$gradePoints', 4] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            totalGrades: 1,
            averageMarks: { $round: ['$averageMarks', 2] },
            averageGradePoints: { $round: ['$averageGradePoints', 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passCount', '$totalGrades'] }, 100] }, 2]
            }
          }
        }
      ]),
      Grade.aggregate([
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectInfo'
          }
        },
        { $unwind: '$subjectInfo' },
        { $match: matchCondition },
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Grade.aggregate([
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectInfo'
          }
        },
        { $unwind: '$subjectInfo' },
        { $match: matchCondition },
        {
          $group: {
            _id: '$subject',
            subject: { $first: '$subjectInfo' },
            totalStudents: { $sum: 1 },
            averageMarks: { $avg: '$marks.total' },
            averageGradePoints: { $avg: '$gradePoints' },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$gradePoints', 4] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            subject: { name: 1, code: 1, credits: 1 },
            totalStudents: 1,
            averageMarks: { $round: ['$averageMarks', 2] },
            averageGradePoints: { $round: ['$averageGradePoints', 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passCount', '$totalStudents'] }, 100] }, 2]
            }
          }
        },
        { $sort: { 'subject.name': 1 } }
      ]),
      Grade.aggregate([
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectInfo'
          }
        },
        { $unwind: '$subjectInfo' },
        { $match: matchCondition },
        {
          $lookup: {
            from: 'users',
            localField: 'student',
            foreignField: '_id',
            as: 'studentInfo'
          }
        },
        { $unwind: '$studentInfo' },
        {
          $group: {
            _id: '$student',
            student: { $first: '$studentInfo' },
            totalGradePoints: { $sum: { $multiply: ['$gradePoints', '$subjectInfo.credits'] } },
            totalCredits: { $sum: '$subjectInfo.credits' },
            subjectCount: { $sum: 1 }
          }
        },
        {
          $project: {
            student: { firstName: 1, lastName: 1, rollNumber: 1 },
            cgpa: { $round: [{ $divide: ['$totalGradePoints', '$totalCredits'] }, 2] },
            totalCredits: 1,
            subjectCount: 1
          }
        },
        { $sort: { cgpa: -1 } },
        { $limit: 20 }
      ])
    ]);

    res.json({
      overallStats: overallStats[0] || {
        totalGrades: 0,
        averageMarks: 0,
        averageGradePoints: 0,
        passPercentage: 0
      },
      gradeDistribution,
      subjectWisePerformance,
      studentRankings
    });
  } catch (error) {
    console.error('Department performance analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/subject/:subjectId/detailed
// @desc    Get detailed subject analytics
// @access  Private (Admin, HOD, Teacher)
router.get('/subject/:subjectId/detailed', [
  auth,
  authorize('admin', 'hod', 'teacher')
], async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.subjectId);
    if (!subject) {
      return res.status(404).json({ message: 'Subject not found' });
    }

    // Check permissions
    if (req.user.role === 'teacher' && subject.teacher?.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }
    if (req.user.role === 'hod' && subject.department.toString() !== req.user.department._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { academicYear, examType } = req.query;
    
    let matchCondition = {
      subject: new mongoose.Types.ObjectId(req.params.subjectId),
      isPublished: true
    };

    if (academicYear) matchCondition.academicYear = academicYear;
    if (examType) matchCondition.examType = examType;

    const [
      basicStats,
      marksDistribution,
      gradeDistribution,
      studentPerformance,
      trendsData
    ] = await Promise.all([
      Grade.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: null,
            totalStudents: { $sum: 1 },
            averageMarks: { $avg: '$marks.total' },
            maxMarks: { $max: '$marks.total' },
            minMarks: { $min: '$marks.total' },
            averageTheory: { $avg: '$marks.theory' },
            averagePractical: { $avg: '$marks.practical' },
            averageInternal: { $avg: '$marks.internal' },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$gradePoints', 4] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            totalStudents: 1,
            averageMarks: { $round: ['$averageMarks', 2] },
            maxMarks: 1,
            minMarks: 1,
            averageTheory: { $round: ['$averageTheory', 2] },
            averagePractical: { $round: ['$averagePractical', 2] },
            averageInternal: { $round: ['$averageInternal', 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passCount', '$totalStudents'] }, 100] }, 2]
            }
          }
        }
      ]),
      Grade.aggregate([
        { $match: matchCondition },
        {
          $bucket: {
            groupBy: '$marks.total',
            boundaries: [0, 40, 50, 60, 70, 80, 90, 100],
            default: 'Other',
            output: {
              count: { $sum: 1 },
              students: {
                $push: {
                  student: '$student',
                  marks: '$marks.total',
                  grade: '$grade'
                }
              }
            }
          }
        }
      ]),
      Grade.aggregate([
        { $match: matchCondition },
        { $group: { _id: '$grade', count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ]),
      Grade.find(matchCondition)
        .populate('student', 'firstName lastName rollNumber academicYear')
        .select('student marks grade gradePoints examType')
        .sort({ 'marks.total': -1 }),
      Grade.aggregate([
        { $match: { subject: new mongoose.Types.ObjectId(req.params.subjectId), isPublished: true } },
        {
          $group: {
            _id: { academicYear: '$academicYear', examType: '$examType' },
            averageMarks: { $avg: '$marks.total' },
            totalStudents: { $sum: 1 },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$gradePoints', 4] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            academicYear: '$_id.academicYear',
            examType: '$_id.examType',
            averageMarks: { $round: ['$averageMarks', 2] },
            totalStudents: 1,
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passCount', '$totalStudents'] }, 100] }, 2]
            }
          }
        },
        { $sort: { academicYear: 1, examType: 1 } }
      ])
    ]);

    res.json({
      subject: {
        name: subject.name,
        code: subject.code,
        credits: subject.credits,
        semester: subject.semester,
        academicYear: subject.academicYear
      },
      basicStats: basicStats[0] || {
        totalStudents: 0,
        averageMarks: 0,
        maxMarks: 0,
        minMarks: 0,
        passPercentage: 0
      },
      marksDistribution,
      gradeDistribution,
      studentPerformance,
      trendsData
    });
  } catch (error) {
    console.error('Subject detailed analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/analytics/trends
// @desc    Get system-wide trends and comparisons
// @access  Private (Admin)
router.get('/trends', [auth, authorize('admin')], async (req, res) => {
  try {
    const { period = '6months' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case '1month':
        dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()) };
        break;
      case '3months':
        dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()) };
        break;
      case '6months':
        dateFilter = { $gte: new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()) };
        break;
      case '1year':
        dateFilter = { $gte: new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()) };
        break;
    }

    const [
      gradeTrends,
      departmentComparison,
      userGrowth,
      performanceTrends
    ] = await Promise.all([
      Grade.aggregate([
        { $match: { publishedAt: dateFilter, isPublished: true } },
        {
          $group: {
            _id: {
              year: { $year: '$publishedAt' },
              month: { $month: '$publishedAt' }
            },
            totalGrades: { $sum: 1 },
            averageMarks: { $avg: '$marks.total' },
            averageGradePoints: { $avg: '$gradePoints' }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Grade.aggregate([
        { $match: { isPublished: true } },
        {
          $lookup: {
            from: 'subjects',
            localField: 'subject',
            foreignField: '_id',
            as: 'subjectInfo'
          }
        },
        { $unwind: '$subjectInfo' },
        {
          $lookup: {
            from: 'departments',
            localField: 'subjectInfo.department',
            foreignField: '_id',
            as: 'departmentInfo'
          }
        },
        { $unwind: '$departmentInfo' },
        {
          $group: {
            _id: '$subjectInfo.department',
            department: { $first: '$departmentInfo' },
            totalGrades: { $sum: 1 },
            averageMarks: { $avg: '$marks.total' },
            averageGradePoints: { $avg: '$gradePoints' },
            passCount: {
              $sum: {
                $cond: [{ $gte: ['$gradePoints', 4] }, 1, 0]
              }
            }
          }
        },
        {
          $project: {
            department: { name: 1, code: 1 },
            totalGrades: 1,
            averageMarks: { $round: ['$averageMarks', 2] },
            averageGradePoints: { $round: ['$averageGradePoints', 2] },
            passPercentage: {
              $round: [{ $multiply: [{ $divide: ['$passCount', '$totalGrades'] }, 100] }, 2]
            }
          }
        },
        { $sort: { averageGradePoints: -1 } }
      ]),
      User.aggregate([
        { $match: { createdAt: dateFilter } },
        {
          $group: {
            _id: {
              year: { $year: '$createdAt' },
              month: { $month: '$createdAt' },
              role: '$role'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ]),
      Grade.aggregate([
        { $match: { publishedAt: dateFilter, isPublished: true } },
        {
          $group: {
            _id: {
              year: { $year: '$publishedAt' },
              month: { $month: '$publishedAt' },
              grade: '$grade'
            },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

    res.json({
      gradeTrends,
      departmentComparison,
      userGrowth,
      performanceTrends
    });
  } catch (error) {
    console.error('Trends analytics error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;