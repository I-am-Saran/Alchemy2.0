import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { get, post, del } from '../services/api';
import { THEME_COLORS } from '../constants/colors';
import Loader from '../components/Loader';

export default function UserRoles() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { showToast } = useToast();
  const [user, setUser] = useState(null);
  const [userRoles, setUserRoles] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tenantId] = useState('00000000-0000-0000-0000-000000000001');

  useEffect(() => {
    const fetchData = async () => {
      if (!session) return;
      try {
        setLoading(true);
        
        // Fetch user roles
        const rolesJson = await get(`/api/users/${userId}/roles?tenant_id=${tenantId}`);
        if (rolesJson.error) throw new Error(rolesJson.error);
        setUserRoles(rolesJson.data || []);
        
        // Fetch all available roles
        const allRolesJson = await get(`/api/roles?tenant_id=${tenantId}`);
        if (allRolesJson.error) throw new Error(allRolesJson.error);
        setAvailableRoles(allRolesJson.data || []);
        
        // Fetch user details (if endpoint exists)
        // For now, we'll just use userId
        setUser({ id: userId });
      } catch (err) {
        showToast(`Failed to load data: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [userId, session, tenantId, showToast]);

  const handleAssignRole = async (roleId) => {
    try {
      const json = await post(`/api/users/${userId}/roles`, {
        role_id: roleId,
        tenant_id: tenantId,
      });
      if (json.error) throw new Error(json.error);
      
      showToast('Role assigned successfully', 'success');
      
      // Reload user roles
      const rolesJson = await get(`/api/users/${userId}/roles?tenant_id=${tenantId}`);
      if (!rolesJson.error) {
        setUserRoles(rolesJson.data || []);
      }
    } catch (err) {
      showToast(`Failed to assign role: ${err.message}`, 'error');
    }
  };

  const handleRemoveRole = async (roleId, roleName) => {
    if (!confirm(`Remove role "${roleName}" from user?`)) return;

    try {
      const json = await del(`/api/users/${userId}/roles/${roleId}?tenant_id=${tenantId}`);
      if (json.error) throw new Error(json.error);
      
      showToast('Role removed successfully', 'success');
      setUserRoles((prev) => prev.filter((ur) => ur.role_id !== roleId));
    } catch (err) {
      showToast(`Failed to remove role: ${err.message}`, 'error');
    }
  };

  const assignedRoleIds = userRoles.map((ur) => ur.role_id);
  const unassignedRoles = availableRoles.filter((r) => !assignedRoleIds.includes(r.id));

  if (loading) {
    return <Loader message="Loading user roles..." />;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Roles</h1>
            <p className="text-gray-600 mt-1">User ID: {userId}</p>
          </div>
          <button
            onClick={() => navigate('/users')}
            className="px-4 py-2 text-white rounded-lg transition-colors"
            style={{ backgroundColor: THEME_COLORS.lightBlueDark }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.mediumTealDark}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.lightBlueDark}
          >
            ← Back to Users
          </button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Assigned Roles */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Assigned Roles</h2>
            {userRoles.length === 0 ? (
              <p className="text-gray-500 text-sm">No roles assigned</p>
            ) : (
              <div className="space-y-2">
                {userRoles.map((userRole) => {
                  const role = availableRoles.find((r) => r.id === userRole.role_id);
                  return (
                    <div
                      key={userRole.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-gray-900">
                          {role?.role_name || 'Unknown Role'}
                        </div>
                        {role?.role_description && (
                          <div className="text-sm text-gray-500">{role.role_description}</div>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveRole(userRole.role_id, role?.role_name)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Available Roles */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Available Roles</h2>
            {unassignedRoles.length === 0 ? (
              <p className="text-gray-500 text-sm">All roles are assigned</p>
            ) : (
              <div className="space-y-2">
                {unassignedRoles.map((role) => (
                  <div
                    key={role.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-gray-900">{role.role_name}</div>
                      {role.role_description && (
                        <div className="text-sm text-gray-500">{role.role_description}</div>
                      )}
                    </div>
                    <button
                      onClick={() => handleAssignRole(role.id)}
                      className="px-3 py-1 text-white text-sm rounded shadow-sm hover:shadow transition-all"
                      style={{ background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})` }}
                      onMouseEnter={(e) => e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`}
                      onMouseLeave={(e) => e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`}
                    >
                      Assign
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
  );
}

