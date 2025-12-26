// ✅ src/App.jsx
import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import TaskDetails from "./pages/TaskDetails";
import TaskForm from "./pages/TaskForm";
import MainLayout from "./layouts/MainLayout";
import SecurityControlDetails from "./pages/SecurityControlDetails";
import SecurityControlDetailPage from "./pages/SecurityControlDetailPage";
import ActionDetails from "./pages/ActionDetails";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import RoleDetails from "./pages/RoleDetails";
import RoleForm from "./pages/RoleForm";
import UserRoles from "./pages/UserRoles";
import Home from "./pages/Home";
import CertificationsPage from "./pages/CertificationsPage";
import CertificationForm from "./pages/CertificationForm";
import Dashboard from "./pages/Dashboard";
import AuditForm from "./pages/AuditForm";
import Loader from "./components/Loader";

// Lazy load the main list view pages for better performance
const TasksPage = lazy(() => import("./pages/TasksPage"));
const SecurityControlsPage = lazy(() => import("./pages/SecurityControlsPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const RolesList = lazy(() => import("./pages/RolesList"));
const AuditsPage = lazy(() => import("./pages/AuditsPage"));

function App() {
  return (
    <Routes>
      {/* -------------------- AUTH -------------------- */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* -------------------- HOME PAGE -------------------- */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />

      {/* -------------------- DASHBOARD -------------------- */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="dashboard">
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- TASKS MODULE -------------------- */}
      <Route
        path="/tasks"
        element={
          <ProtectedRoute requiredPermission="retrieve">
            <MainLayout>
              <Suspense fallback={<Loader message="Loading tasks..." />}>
                <TasksPage />
              </Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/new"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TaskForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/add"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TaskForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/edit/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TaskForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <TaskDetails />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- AUDITS MODULE -------------------- */}
      <Route
        path="/audits"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="audits">
            <MainLayout>
              <Suspense fallback={<Loader message="Loading audits..." />}>
                <AuditsPage />
              </Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audits/:id"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="audits">
            <MainLayout>
              <AuditForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audits/new"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AuditForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/audits/edit/:id"
        element={
          <ProtectedRoute>
            <MainLayout>
              <AuditForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- USERS -------------------- */}
      <Route
        path="/users"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="users">
            <MainLayout>
              <Suspense fallback={<Loader message="Loading users..." />}>
                <UsersPage />
              </Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- SECURITY CONTROLS -------------------- */}
      <Route
        path="/security-controls"
        element={
          <ProtectedRoute requiredPermission="retrieve">
            <MainLayout>
              <Suspense fallback={<Loader message="Loading security controls..." />}>
                <SecurityControlsPage />
              </Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/security-controls/:id"
        element={
          <ProtectedRoute requiredPermission="retrieve">
            <MainLayout>
              <SecurityControlDetails />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      {/* -------------------- ACTIONS -------------------- */}
      <Route
        path="/actions/:id"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="actions">
            <MainLayout>
              <ActionDetails />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/security-controls/:id/edit"
        element={
          <ProtectedRoute requiredPermission="update">
            <MainLayout>
              <SecurityControlDetailPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- CERTIFICATIONS -------------------- */}
      <Route
        path="/certifications"
        element={
          <ProtectedRoute requiredPermission="retrieve">
            <MainLayout>
              <CertificationsPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/certifications/new"
        element={
          <ProtectedRoute requiredPermission="create">
            <MainLayout>
              <CertificationForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/certifications/edit/:id"
        element={
          <ProtectedRoute requiredPermission="update">
            <MainLayout>
              <CertificationForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- ROLES (RBAC) -------------------- */}
      <Route
        path="/roles"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="roles">
            <MainLayout>
              <Suspense fallback={<Loader message="Loading roles..." />}>
                <RolesList />
              </Suspense>
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles/new"
        element={
          <ProtectedRoute requiredPermission="create" requiredModule="roles">
            <MainLayout>
              <RoleForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles/:id"
        element={
          <ProtectedRoute requiredPermission="retrieve" requiredModule="roles">
            <MainLayout>
              <RoleDetails />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/roles/:id/edit"
        element={
          <ProtectedRoute requiredPermission="update" requiredModule="roles">
            <MainLayout>
              <RoleForm />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/users/:userId/roles"
        element={
          <ProtectedRoute>
            <MainLayout>
              <UserRoles />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      {/* -------------------- FALLBACK -------------------- */}
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Navigate to="/security-controls" replace />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
