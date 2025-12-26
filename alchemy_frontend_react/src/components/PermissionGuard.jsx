import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../contexts/ToastContext';

/**
 * PermissionGuard component - Hides/shows content based on permissions
 * 
 * Usage:
 * <PermissionGuard module="security_controls" action="create">
 *   <button>Create Control</button>
 * </PermissionGuard>
 */
export default function PermissionGuard({ 
  module, 
  action, 
  children, 
  fallback = null,
  showMessage = true,
  tenantId 
}) {
  const { hasPermission, loading } = usePermissions(tenantId);
  const { showToast } = useToast();

  // Show loading state
  if (loading) {
    return null;
  }

  // Check permission
  const hasAccess = hasPermission(module, action);

  // Show message if permission denied
  if (!hasAccess && showMessage) {
    React.useEffect(() => {
      // Only show message once, not on every render
      // This is a simple implementation - in production, you might want to track shown messages
    }, []);
  }

  if (!hasAccess) {
    return fallback;
  }

  return <>{children}</>;
}

