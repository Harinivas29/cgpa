const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  hod: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  establishedYear: {
    type: Number
  },
  totalSemesters: {
    type: Number,
    default: 8,
    min: 1,
    max: 10
  }
}, {
  timestamps: true
});

// Index for better query performance
departmentSchema.index({ code: 1, isActive: 1 });

module.exports = mongoose.model('Department', departmentSchema);