import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useAuth } from './contexts/AuthContext';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';

// Pages - Lazy loaded for better performance
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));

// Admin Pages
const AdminDashboard = React.lazy(() => import('./pages/admin/AdminDashboard'));
const UserManagement = React.lazy(() => import('./pages/admin/UserManagement'));
const DepartmentManagement = React.lazy(() => import('./pages/admin/DepartmentManagement'));
const SystemAnalytics = React.lazy(() => import('./pages/admin/SystemAnalytics'));

// HOD Pages
const HODDashboard = React.lazy(() => import('./pages/hod/HODDashboard'));
const SubjectManagement = React.lazy(() => import('./pages/hod/SubjectManagement'));
const TeacherManagement = React.lazy(() => import('./pages/hod/TeacherManagement'));
const DepartmentAnalytics = React.lazy(() => import('./pages/hod/DepartmentAnalytics'));

// Teacher Pages
const TeacherDashboard = React.lazy(() => import('./pages/teacher/TeacherDashboard'));
const GradeManagement = React.lazy(() => import('./pages/teacher/GradeManagement'));
const StudentAnalytics = React.lazy(() => import('./pages/teacher/StudentAnalytics'));
const MySubjects = React.lazy(() => import('./pages/teacher/MySubjects'));

// Student Pages
const StudentDashboard = React.lazy(() => import('./pages/student/StudentDashboard'));
const CGPAView = React.lazy(() => import('./pages/student/CGPAView'));
const GradesView = React.lazy(() => import('./pages/student/GradesView'));
const SubjectsView = React.lazy(() => import('./pages/student/SubjectsView'));

// Common Pages
const NotFoundPage = React.lazy(() => import('./pages/NotFoundPage'));

function App() {
  const { isAuthenticated, loading, user } = useAuth();

  // Show loading screen while checking authentication
  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <Suspense
        fallback={
          <Box
            display="flex"
            justifyContent="center"
            alignItems="center"
            minHeight="100vh"
          >
            <CircularProgress />
          </Box>
        }
      >
        <Routes>
          {/* Public Route */}
          <Route
            path="/login"
            element={
              !isAuthenticated ? <LoginPage /> : <Navigate to="/dashboard" replace />
            }
          />

          {/* Protected Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            {/* Common Routes */}
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="profile" element={<ProfilePage />} />

            {/* Role-based Routes */}
            {user?.role === 'admin' && (
              <>
                <Route path="admin">
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<UserManagement />} />
                  <Route path="departments" element={<DepartmentManagement />} />
                  <Route path="analytics" element={<SystemAnalytics />} />
                </Route>
              </>
            )}

            {user?.role === 'hod' && (
              <>
                <Route path="hod">
                  <Route index element={<HODDashboard />} />
                  <Route path="subjects" element={<SubjectManagement />} />
                  <Route path="teachers" element={<TeacherManagement />} />
                  <Route path="analytics" element={<DepartmentAnalytics />} />
                </Route>
              </>
            )}

            {user?.role === 'teacher' && (
              <>
                <Route path="teacher">
                  <Route index element={<TeacherDashboard />} />
                  <Route path="grades" element={<GradeManagement />} />
                  <Route path="subjects" element={<MySubjects />} />
                  <Route path="analytics" element={<StudentAnalytics />} />
                </Route>
              </>
            )}

            {user?.role === 'student' && (
              <>
                <Route path="student">
                  <Route index element={<StudentDashboard />} />
                  <Route path="cgpa" element={<CGPAView />} />
                  <Route path="grades" element={<GradesView />} />
                  <Route path="subjects" element={<SubjectsView />} />
                </Route>
              </>
            )}

            {/* 404 Route */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          {/* Redirect unauthenticated users */}
          <Route
            path="*"
            element={
              !isAuthenticated ? (
                <Navigate to="/login" replace />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
        </Routes>
      </Suspense>
    </Box>
  );
}

export default App;