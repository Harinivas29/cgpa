# CGPA Calculator - Educational Management System

A comprehensive web-based CGPA calculator with role-based access control, designed for educational institutions. This system provides different interfaces and functionalities for Admins, HODs, Teachers, and Students.

## 🌟 Features

### 🔐 Role-Based Access Control
- **Admin**: Complete system management, user creation, department oversight
- **HOD**: Department management, subject/credit configuration, teacher oversight
- **Teacher**: Grade entry, student analytics, subject management
- **Student**: CGPA viewing, grade access, academic progress tracking

### 📊 Modern Google Classroom-like Interface
- Clean, intuitive Material-UI design
- Responsive layout for all devices
- Real-time notifications and updates
- Professional dashboard for each role

### 🎯 Core Functionality
- **CGPA Calculation**: Automatic calculation with credit-weighted grades
- **Grade Management**: Comprehensive grade entry and publishing system
- **Subject Management**: Credit hours, prerequisites, department-wise organization
- **Analytics & Reporting**: Detailed performance analytics and trends
- **User Management**: Bulk user creation, profile management
- **Department System**: Multi-department support with HOD assignments

## 🏗️ System Architecture

### Backend (Node.js + Express + MongoDB)
```
├── server.js                 # Main server file
├── models/                   # MongoDB schemas
│   ├── User.js              # User model with roles
│   ├── Department.js        # Department management
│   ├── Subject.js           # Subject with credits
│   └── Grade.js             # Grade with auto-calculation
├── routes/                   # API endpoints
│   ├── auth.js              # Authentication routes
│   ├── users.js             # User management
│   ├── departments.js       # Department operations
│   ├── subjects.js          # Subject management
│   ├── grades.js            # Grade entry & CGPA
│   └── analytics.js         # Reports & analytics
├── middleware/              # Custom middleware
│   └── auth.js              # JWT & role verification
└── .env                     # Environment configuration
```

### Frontend (React + Material-UI)
```
├── client/
│   ├── src/
│   │   ├── components/       # Reusable components
│   │   ├── pages/           # Page components
│   │   │   ├── admin/       # Admin-specific pages
│   │   │   ├── hod/         # HOD-specific pages
│   │   │   ├── teacher/     # Teacher-specific pages
│   │   │   └── student/     # Student-specific pages
│   │   ├── contexts/        # React contexts
│   │   │   └── AuthContext.js # Global auth state
│   │   ├── utils/           # Utility functions
│   │   └── App.js           # Main app component
│   └── package.json         # Frontend dependencies
```

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+ recommended)
- MongoDB (v5+ recommended)
- npm or yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd cgpa-calculator
```

2. **Install backend dependencies**
```bash
npm install
```

3. **Install frontend dependencies**
```bash
cd client
npm install
cd ..
```

4. **Environment Setup**
Create a `.env` file in the root directory:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/cgpa_calculator
JWT_SECRET=your_super_secure_jwt_secret_key
JWT_EXPIRE=30d
NODE_ENV=development
```

5. **Start MongoDB**
Make sure MongoDB is running on your system.

6. **Run the application**

Development mode (both frontend and backend):
```bash
# Terminal 1 - Backend
npm run dev

# Terminal 2 - Frontend
npm run client
```

Production mode:
```bash
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 👥 User Roles & Permissions

### 🔧 Admin
- **User Management**: Create, update, deactivate users
- **Department Management**: Create departments, assign HODs
- **System Analytics**: View system-wide performance metrics
- **Bulk Operations**: CSV import for users and data
- **Global Access**: All departments and data

### 🏢 HOD (Head of Department)
- **Subject Management**: Add subjects with credit hours
- **Teacher Assignment**: Assign teachers to subjects
- **Department Analytics**: View department performance
- **User Oversight**: Manage department users
- **Department-Scoped**: Access limited to their department

### 👨‍🏫 Teacher
- **Grade Entry**: Input student marks and grades
- **Grade Publishing**: Control grade visibility to students
- **Student Analytics**: View performance of their students
- **Subject Management**: Manage assigned subjects
- **Subject-Scoped**: Access limited to assigned subjects

### 🎓 Student
- **CGPA Viewing**: Real-time CGPA calculation
- **Grade Access**: View published grades
- **Academic Progress**: Semester-wise performance tracking
- **Subject Information**: View enrolled subjects
- **Self-Scoped**: Access only to personal data

## 📐 CGPA Calculation System

### Grade Scale
| Grade | Grade Points | Marks Range |
|-------|-------------|-------------|
| O     | 10          | 90-100      |
| A+    | 9           | 80-89       |
| A     | 8           | 70-79       |
| B+    | 7           | 60-69       |
| B     | 6           | 55-59       |
| C     | 5           | 50-54       |
| P     | 4           | 40-49       |
| F     | 0           | Below 40    |

### Calculation Formula
```
SGPA = Σ(Grade Points × Credits) / Σ(Credits)
CGPA = Σ(SGPA × Total Credits in Semester) / Σ(Total Credits)
```

### Mark Components
- **Theory**: Written examination marks
- **Practical**: Lab/practical marks
- **Internal**: Continuous assessment
- **Total**: Sum of all components (auto-calculated)

## 🔗 API Endpoints

### Authentication
```
POST /api/auth/login           # User login
GET  /api/auth/me             # Get current user
PUT  /api/auth/profile        # Update profile
PUT  /api/auth/change-password # Change password
POST /api/auth/reset-password  # Reset password (Admin)
```

### User Management
```
GET  /api/users               # List users
POST /api/users               # Create user
GET  /api/users/:id           # Get user
PUT  /api/users/:id           # Update user
DELETE /api/users/:id         # Delete user
POST /api/users/bulk-create   # Bulk create users
```

### Department Management
```
GET  /api/departments         # List departments
POST /api/departments         # Create department
GET  /api/departments/:id     # Get department
PUT  /api/departments/:id     # Update department
GET  /api/departments/:id/users # Get department users
```

### Subject Management
```
GET  /api/subjects            # List subjects
POST /api/subjects            # Create subject
PUT  /api/subjects/:id        # Update subject
GET  /api/subjects/department/:id # Subjects by department
POST /api/subjects/bulk-create # Bulk create subjects
```

### Grade Management
```
GET  /api/grades              # List grades
POST /api/grades              # Create/update grade
PUT  /api/grades/:id          # Update grade
POST /api/grades/bulk-create  # Bulk grade entry
POST /api/grades/publish-bulk # Publish grades
GET  /api/grades/student/:id/cgpa # Calculate CGPA
```

### Analytics
```
GET /api/analytics/dashboard         # Role-based dashboard
GET /api/analytics/department/:id/performance # Department analytics
GET /api/analytics/subject/:id/detailed # Subject analytics
GET /api/analytics/trends           # System trends
```

## 🎨 UI/UX Features

### Google Classroom-Inspired Design
- **Clean Interface**: Minimalist, professional appearance
- **Card-Based Layout**: Organized information in cards
- **Color-Coded Roles**: Different themes for each user type
- **Responsive Design**: Mobile and tablet friendly
- **Material Design**: Following Google's design principles

### Interactive Elements
- **Real-time Notifications**: Toast messages for actions
- **Loading States**: Smooth loading animations
- **Form Validation**: Client and server-side validation
- **Data Tables**: Sortable, filterable data grids
- **Charts & Graphs**: Visual analytics with Recharts

### Accessibility
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Support**: ARIA labels and descriptions
- **High Contrast**: Good color contrast ratios
- **Responsive Text**: Scalable fonts and layouts

## 📊 Analytics & Reporting

### Dashboard Analytics
- **Role-specific Dashboards**: Customized for each user type
- **Key Metrics**: Important numbers at a glance
- **Recent Activity**: Latest actions and updates
- **Performance Indicators**: Visual progress indicators

### Detailed Reports
- **Department Performance**: Compare departments
- **Subject Analytics**: Subject-wise performance
- **Student Rankings**: Top performers and trends
- **Grade Distribution**: Visual grade breakdowns

### Data Export
- **CSV Export**: Download data for external analysis
- **Print Reports**: Printer-friendly layouts
- **Bulk Operations**: Import/export for administration

## 🔒 Security Features

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Role-based Access**: Granular permission system
- **Session Management**: Automatic token refresh
- **Password Security**: Bcrypt hashing with salt

### Data Protection
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Prevention**: MongoDB parameterized queries
- **XSS Protection**: Input sanitization and output encoding
- **Rate Limiting**: API endpoint protection

### Privacy
- **Department Isolation**: Users see only relevant data
- **Personal Data Protection**: Students see only their data
- **Audit Trails**: Activity logging for accountability

## 🛠️ Development Setup

### Backend Development
```bash
# Start MongoDB
mongod

# Run backend in development mode
npm run dev

# The server will restart automatically on file changes
```

### Frontend Development
```bash
# In client directory
cd client
npm start

# React app will open at http://localhost:3000
# Hot reload enabled for rapid development
```

### Database Setup
```bash
# Access MongoDB shell
mongo

# Create database and initial admin user
use cgpa_calculator

# Insert admin user (run after starting the server)
# Use the /api/auth/register endpoint with admin credentials
```

## 📱 Responsive Design

The application is fully responsive and works on:
- **Desktop**: Full-featured experience
- **Tablet**: Optimized layouts and touch interactions
- **Mobile**: Mobile-first design with drawer navigation
- **Print**: Print-friendly layouts for reports

## 🔄 Data Flow

### Grade Entry Process
1. Teacher logs in and selects subject
2. Enters marks for theory, practical, internal
3. System auto-calculates total marks and grade
4. Teacher reviews and publishes grades
5. Students can immediately view published grades
6. CGPA updates automatically in real-time

### User Management Flow
1. Admin creates user accounts with roles
2. Users receive login credentials
3. Role-based dashboard and features accessible
4. Department and subject assignments restrict access
5. Analytics and reports generated based on permissions

## 🚀 Deployment

### Production Environment
```bash
# Set environment to production
NODE_ENV=production

# Build frontend for production
cd client
npm run build
cd ..

# Start production server
npm start
```

### Environment Variables
```env
# Production settings
NODE_ENV=production
PORT=80
MONGODB_URI=mongodb://localhost:27017/cgpa_calculator_prod
JWT_SECRET=your_very_secure_production_secret
JWT_EXPIRE=7d
```

### Docker Deployment (Optional)
```dockerfile
# Dockerfile for containerized deployment
FROM node:16
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN cd client && npm install && npm run build
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new features
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation for common solutions
- Review the API documentation for integration help

## 🎯 Future Enhancements

- **Mobile App**: React Native mobile application
- **Advanced Analytics**: ML-powered insights and predictions
- **Integration APIs**: LMS and university system integration
- **Notification System**: Email and SMS notifications
- **Advanced Reporting**: Custom report builder
- **Attendance Integration**: Link attendance with performance
- **Parent Portal**: Parent access to student progress
- **Multi-language Support**: Internationalization

---

**Built with ❤️ for educational institutions**

This system provides a comprehensive solution for CGPA calculation and academic management, designed with modern web technologies and best practices for security, usability, and maintainability.