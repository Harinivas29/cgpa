const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  credits: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  academicYear: {
    type: String,
    required: true,
    enum: ['1st Year', '2nd Year', '3rd Year', '4th Year']
  },
  subjectType: {
    type: String,
    enum: ['Theory', 'Practical', 'Project', 'Elective'],
    default: 'Theory'
  },
  description: {
    type: String,
    trim: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  prerequisites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  maxMarks: {
    type: Number,
    default: 100,
    min: 50,
    max: 200
  },
  passingMarks: {
    type: Number,
    default: 40,
    min: 30,
    max: 100
  }
}, {
  timestamps: true
});

// Compound index for unique subject per department, semester, and academic year
subjectSchema.index({ 
  code: 1, 
  department: 1, 
  semester: 1, 
  academicYear: 1 
}, { unique: true });

// Index for better query performance
subjectSchema.index({ department: 1, semester: 1, academicYear: 1 });
subjectSchema.index({ teacher: 1, isActive: 1 });

module.exports = mongoose.model('Subject', subjectSchema);