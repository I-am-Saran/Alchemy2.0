import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useSession } from './SessionContext';
import { get } from '../services/api';

const PermissionsContext = createContext(null);

const PERMISSIONS_STORAGE_KEY = 'user_permissions';
const PERMISSIONS_TIMESTAMP_KEY = 'user_permissions_timestamp';
const PERMISSIONS_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export function PermissionsProvider({ children }) {
  const { session } = useSession();
  const [userRoles, setUserRoles] = useState([]);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);

  // Load permissions from localStorage
  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(PERMISSIONS_STORAGE_KEY);
      const timestamp = localStorage.getItem(PERMISSIONS_TIMESTAMP_KEY);
      
      if (stored && timestamp) {
        const age = Date.now() - parseInt(timestamp, 10);
        if (age < PERMISSIONS_CACHE_DURATION) {
          const data = JSON.parse(stored);
          setUserRoles(data.user_roles || []);
          setPermissions(data.permissions || {});
          return true;
        } else {
          // Cache expired, clear it
          localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
          localStorage.removeItem(PERMISSIONS_TIMESTAMP_KEY);
        }
      }
    } catch (e) {
      console.error('Error loading permissions from storage:', e);
      localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
      localStorage.removeItem(PERMISSIONS_TIMESTAMP_KEY);
    }
    return false;
  }, []);

  // Save permissions to localStorage
  const saveToStorage = useCallback((data) => {
    try {
      localStorage.setItem(PERMISSIONS_STORAGE_KEY, JSON.stringify(data));
      localStorage.setItem(PERMISSIONS_TIMESTAMP_KEY, Date.now().toString());
    } catch (e) {
      console.error('Error saving permissions to storage:', e);
    }
  }, []);

  // Fetch permissions from API
  const fetchPermissions = useCallback(async (userId, tenantId) => {
    try {
      const permissionsJson = await get(`/api/users/${userId}/permissions?tenant_id=${tenantId}`);
      if (permissionsJson.error) {
        console.error('Error fetching user permissions:', permissionsJson.error);
        return null;
      }

      const data = permissionsJson.data || {};
      const roles = data.user_roles || [];
      const permsByModule = data.permissions || {};

      // Save to storage
      saveToStorage({ user_roles: roles, permissions: permsByModule });

      setUserRoles(roles);
      setPermissions(permsByModule);
      return { user_roles: roles, permissions: permsByModule };
    } catch (err) {
      if (err.status === 404 || err.message?.includes('404') || err.message?.includes('Not Found')) {
        console.warn('User permissions endpoint not found or user has no roles assigned:', err.message);
        const emptyData = { user_roles: [], permissions: {} };
        saveToStorage(emptyData);
        setUserRoles([]);
        setPermissions({});
        return emptyData;
      } else {
        console.error('Error fetching permissions:', err);
        return null;
      }
    }
  }, [saveToStorage]);

  // Initialize permissions from storage or fetch if needed
  useEffect(() => {
    if (!session) {
      // Clear permissions when session is cleared (logout)
      clearPermissions();
      setLoading(false);
      return;
    }

    const userId = session?.user_id || session?.user?.id || session?.id;
    const tenantId = session?.tenant_id || '00000000-0000-0000-0000-000000000001';

    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Try to load from storage first
    const loaded = loadFromStorage();
    
    if (!loaded) {
      // Not in storage or expired, fetch from API
      fetchPermissions(userId, tenantId).finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [session, loadFromStorage, fetchPermissions]);

  // Clear permissions on logout
  const clearPermissions = useCallback(() => {
    localStorage.removeItem(PERMISSIONS_STORAGE_KEY);
    localStorage.removeItem(PERMISSIONS_TIMESTAMP_KEY);
    setUserRoles([]);
    setPermissions({});
  }, []);

  // Refresh permissions (force fetch from API)
  const refreshPermissions = useCallback(async () => {
    if (!session) return;

    const userId = session?.user_id || session?.user?.id || session?.id;
    const tenantId = session?.tenant_id || '00000000-0000-0000-0000-000000000001';

    if (!userId) return;

    setLoading(true);
    await fetchPermissions(userId, tenantId);
    setLoading(false);
  }, [session, fetchPermissions]);

  const hasPermission = useCallback(
    (module, action) => {
      if (loading) {
        return false;
      }
      
      // Normalize module name to lowercase for consistent comparison
      const moduleKey = module.toLowerCase();
      
      if (!permissions[moduleKey]) {
        return false;
      }

      const actionMap = {
        create: 'can_create',
        retrieve: 'can_retrieve',
        update: 'can_update',
        delete: 'can_delete',
        comment: 'can_comment',
        create_task: 'can_create_task',
      };

      const permKey = actionMap[action.toLowerCase()];
      if (!permKey) {
        return false;
      }

      const modulePerms = permissions[moduleKey];
      if (!modulePerms) {
        return false;
      }
      
      const permValue = modulePerms[permKey];
      // Handle both boolean true and string "true" values
      return permValue === true || permValue === "true" || permValue === "True";
    },
    [permissions, loading]
  );

  const hasRole = useCallback(
    (roleName) => {
      if (loading) {
        return false;
      }
      
      return userRoles.some((userRole) => {
        const role = userRole.roles || userRole;
        const roleNameToCheck = role.role_name || role.roleName || role.name;
        return roleNameToCheck === roleName;
      });
    },
    [userRoles, loading]
  );

  const value = {
    hasPermission,
    hasRole,
    userRoles,
    permissions,
    loading,
    refreshPermissions,
    clearPermissions,
  };

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissionsContext() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissionsContext must be used within PermissionsProvider');
  }
  return context;
}

