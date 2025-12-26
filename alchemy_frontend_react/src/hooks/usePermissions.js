import { usePermissionsContext } from '../contexts/PermissionsContext';

/**
 * Hook to check user permissions
 * Returns permission checking functions and user roles
 * 
 * This hook now uses PermissionsContext which stores permissions in localStorage
 * and only fetches them once on login, not on every module navigation.
 */
export function usePermissions(tenantId = '00000000-0000-0000-0000-000000000001') {
  const context = usePermissionsContext();
  return context;
}

