import React from 'react';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../contexts/ToastContext';

/**
 * PermissionButton - Button that is disabled/hidden if user doesn't have permission
 * 
 * Usage:
 * <PermissionButton 
 *   module="security_controls" 
 *   action="create"
 *   onClick={handleCreate}
 * >
 *   Create Control
 * </PermissionButton>
 */
export default function PermissionButton({
  module,
  action,
  children,
  onClick,
  disabled: externalDisabled = false,
  className = '',
  showTooltip = true,
  tenantId,
  ...props
}) {
  const { hasPermission, loading } = usePermissions(tenantId);
  const { showToast } = useToast();

  const handleClick = (e) => {
    if (loading) {
      e.preventDefault();
      return;
    }

    if (!hasPermission(module, action)) {
      e.preventDefault();
      if (showTooltip) {
        showToast(
          `You do not have permission to ${action} ${module.replace(/_/g, ' ')}`,
          'warning'
        );
      }
      return;
    }

    if (onClick) {
      onClick(e);
    }
  };

  const hasAccess = hasPermission(module, action);
  const isDisabled = externalDisabled || loading || !hasAccess;

  if (!hasAccess && !showTooltip) {
    return null; // Hide button if no permission
  }

  return (
    <button
      {...props}
      onClick={handleClick}
      disabled={isDisabled}
      className={`${className} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={
        isDisabled && !hasAccess
          ? `You do not have permission to ${action} ${module.replace(/_/g, ' ')}`
          : props.title
      }
    >
      {children}
    </button>
  );
}

