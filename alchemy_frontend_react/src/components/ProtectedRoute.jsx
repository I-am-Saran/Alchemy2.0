import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { usePermissions } from "../hooks/usePermissions";
import { useToast } from "../contexts/ToastContext";
import { get } from "../services/api";
import Loader from "./Loader";

// Map routes to modules for permission checking
const ROUTE_MODULE_MAP = {
  '/security-controls': 'security_controls',
  '/certifications': 'certifications',
  '/tasks': 'tasks',
  '/audits': 'audits',
  '/users': 'users',
  '/roles': 'roles', // Special case - might need admin permission
  '/dashboard': 'dashboard',
};

export default function ProtectedRoute({ children, requiredPermission = 'retrieve', requiredModule = null }) {
  const { session, loading, restored } = useSession();
  const location = useLocation();
  const { hasPermission, loading: permsLoading } = usePermissions();
  const { showToast } = useToast();
  const hasShownToastRef = useRef(false);
  const lastPathRef = useRef(location.pathname);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [passwordCheckComplete, setPasswordCheckComplete] = useState(false);

  // CRITICAL: Immediate session check - validate session exists in storage
  useEffect(() => {
    if (!restored) return; // Wait for session restoration
    
    // Double-check session exists in storage (defense in depth)
    const token = sessionStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    // If no session in storage, immediately redirect to login
    if (!token || !userStr) {
      // Clear any stale state
      try {
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('user');
      } catch {}
      // Redirect will happen via the check below
    }
  }, [restored, location.pathname]);

  // Reset toast ref when pathname changes
  useEffect(() => {
    if (lastPathRef.current !== location.pathname) {
      hasShownToastRef.current = false;
      lastPathRef.current = location.pathname;
      setPasswordCheckComplete(false); // Reset password check on route change
    }
  }, [location.pathname]);

  // Check if password change is required (skip for change-password route and login)
  useEffect(() => {
    // Skip check for change-password and login routes
    if (location.pathname === '/change-password' || location.pathname === '/login') {
      setPasswordCheckComplete(true);
      return;
    }

    // Only check if session is restored and user is authenticated
    if (!restored || !session || loading || checkingPassword || passwordCheckComplete) {
      return;
    }

    // Fast check: if password_changed flag exists in localStorage, skip API call
    const passwordChanged = localStorage.getItem('password_changed');
    if (passwordChanged === 'true') {
      setPasswordCheckComplete(true);
      return;
    }

    // Check with API if password change is required
    const checkPasswordChange = async () => {
      try {
        setCheckingPassword(true);
        const response = await get("/api/auth/check-password-change");
        
        if (response.data?.requires_password_change) {
          // Password change required - set flag and let redirect happen below
          setPasswordCheckComplete(true);
        } else {
          // Password is changed - set flag for future checks
          localStorage.setItem('password_changed', 'true');
          setPasswordCheckComplete(true);
        }
      } catch (error) {
        // If API call fails, allow access (don't block user)
        console.error('Failed to check password change status:', error);
        setPasswordCheckComplete(true);
      } finally {
        setCheckingPassword(false);
      }
    };

    checkPasswordChange();
  }, [session, restored, loading, location.pathname, checkingPassword, passwordCheckComplete]);

  // Check permissions and show toast if needed (only once)
  useEffect(() => {
    if (loading || permsLoading || !session || !restored) {
      return;
    }

    const pathSegments = location.pathname.split('/').filter(Boolean);
    let modulePath = '/' + (pathSegments[0] || '');
    if (modulePath === '/') modulePath = '/';

    // Use requiredModule if provided, otherwise use route module map
    const module = requiredModule || ROUTE_MODULE_MAP[modulePath];
    
    if (module && module !== '/') {
      const hasAccess = hasPermission(module, requiredPermission);
      
      if (!hasAccess && !hasShownToastRef.current) {
        hasShownToastRef.current = true;
        showToast(
          `You do not have permission to access this page`,
          'warning'
        );
      }
    }
  }, [session, restored, loading, permsLoading, location.pathname, hasPermission, requiredPermission, showToast]);

  if (loading || permsLoading || checkingPassword) {
    return <Loader />;
  }

  // CRITICAL: Check authentication FIRST - immediate redirect if no session
  // This check happens before any content rendering
  if (!session && restored) {
    // Double-check storage one more time before redirect
    const token = sessionStorage.getItem('auth_token');
    const userStr = localStorage.getItem('user');
    
    if (!token || !userStr) {
      // Clear any stale data
      try {
        sessionStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        localStorage.removeItem('password_changed');
      } catch {}
      // Immediate redirect to login - no content rendered
      return <Navigate to="/login" replace />;
    }
  }

  // Check if password change is required (only for authenticated users on non-change-password routes)
  if (session && restored && location.pathname !== '/change-password' && passwordCheckComplete && !checkingPassword) {
    const passwordChanged = localStorage.getItem('password_changed');
    // If password change is required (flag not set), redirect to change-password
    if (passwordChanged !== 'true') {
      // Redirect to change password page
      return <Navigate to="/change-password" replace />;
    }
  }

  // Check permissions for the current route
  // Skip permission check for change-password route (it's a special auth route)
  if (session && restored && location.pathname !== '/change-password') {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    let modulePath = '/' + (pathSegments[0] || '');
    if (modulePath === '/') modulePath = '/';

    // Use requiredModule if provided, otherwise use route module map
    const module = requiredModule || ROUTE_MODULE_MAP[modulePath];
    
    if (module && module !== '/') {
      const hasAccess = hasPermission(module, requiredPermission);
      
      if (!hasAccess) {
        return <Navigate to="/" replace />;
      }
    }
  }

  return children;
}
