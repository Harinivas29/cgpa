const mongoose = require('mongoose');

const gradeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  marks: {
    theory: {
      type: Number,
      min: 0,
      max: 100
    },
    practical: {
      type: Number,
      min: 0,
      max: 100
    },
    internal: {
      type: Number,
      min: 0,
      max: 100
    },
    total: {
      type: Number,
      min: 0,
      max: 300
    }
  },
  grade: {
    type: String,
    enum: ['O', 'A+', 'A', 'B+', 'B', 'C', 'P', 'F', 'Ab'],
    required: true
  },
  gradePoints: {
    type: Number,
    min: 0,
    max: 10,
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
    required: true
  },
  examType: {
    type: String,
    enum: ['Regular', 'Supplementary', 'Improvement'],
    default: 'Regular'
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: {
    type: Date
  },
  remarks: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index for unique grade per student, subject, and exam type
gradeSchema.index({ 
  student: 1, 
  subject: 1, 
  examType: 1 
}, { unique: true });

// Index for better query performance
gradeSchema.index({ student: 1, semester: 1, academicYear: 1 });
gradeSchema.index({ teacher: 1, isPublished: 1 });
gradeSchema.index({ subject: 1, semester: 1 });

// Calculate grade and grade points based on marks
gradeSchema.methods.calculateGrade = function() {
  const total = this.marks.total;
  if (total >= 90) {
    this.grade = 'O';
    this.gradePoints = 10;
  } else if (total >= 80) {
    this.grade = 'A+';
    this.gradePoints = 9;
  } else if (total >= 70) {
    this.grade = 'A';
    this.gradePoints = 8;
  } else if (total >= 60) {
    this.grade = 'B+';
    this.gradePoints = 7;
  } else if (total >= 55) {
    this.grade = 'B';
    this.gradePoints = 6;
  } else if (total >= 50) {
    this.grade = 'C';
    this.gradePoints = 5;
  } else if (total >= 40) {
    this.grade = 'P';
    this.gradePoints = 4;
  } else {
    this.grade = 'F';
    this.gradePoints = 0;
  }
};

// Pre-save middleware to calculate total marks and grade
gradeSchema.pre('save', function(next) {
  // Calculate total marks
  this.marks.total = (this.marks.theory || 0) + (this.marks.practical || 0) + (this.marks.internal || 0);
  
  // Calculate grade and grade points
  this.calculateGrade();
  
  next();
});

module.exports = mongoose.model('Grade', gradeSchema);