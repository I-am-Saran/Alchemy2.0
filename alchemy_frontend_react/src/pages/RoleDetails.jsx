import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { get, post, put } from '../services/api';
import { THEME_COLORS } from '../constants/colors';
import { 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  MessageSquare, 
  CheckSquare 
} from 'lucide-react';
import Loader from '../components/Loader';

const MODULES = [
  'security_controls',
  'tasks',
  'audits',
  'users',
  'roles',
  'dashboard',
  'bugs',
  'certifications',
];

const ACTIONS = [
  { key: 'can_create', label: 'Create', icon: Plus },
  { key: 'can_retrieve', label: 'Retrieve', icon: Eye },
  { key: 'can_update', label: 'Update', icon: Edit },
  { key: 'can_delete', label: 'Delete', icon: Trash2 },
  { key: 'can_comment', label: 'Comment', icon: MessageSquare },
  { key: 'can_create_task', label: 'Create Task', icon: CheckSquare },
];

export default function RoleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { showToast } = useToast();
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenantId] = useState('00000000-0000-0000-0000-000000000001');

  useEffect(() => {
    const fetchRole = async () => {
      if (!session) return;
      try {
        setLoading(true);
        const json = await get(`/api/roles/${id}?tenant_id=${tenantId}`);
        if (json.error) throw new Error(json.error);
        
        setRole(json.data);
        
        // Organize permissions by module
        const permsByModule = {};
        (json.data.permissions || []).forEach((perm) => {
          permsByModule[perm.module_name] = {
            can_create: perm.can_create || false,
            can_retrieve: perm.can_retrieve || false,
            can_update: perm.can_update || false,
            can_delete: perm.can_delete || false,
            can_comment: perm.can_comment || false,
            can_create_task: perm.can_create_task || false,
          };
        });
        setPermissions(permsByModule);
      } catch (err) {
        showToast(`Failed to load role: ${err.message}`, 'error');
        navigate('/roles');
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [id, session, tenantId, navigate, showToast]);

  const handlePermissionChange = (module, action, value) => {
    setPermissions((prev) => ({
      ...prev,
      [module]: {
        ...(prev[module] || {}),
        [action]: value,
      },
    }));
  };

  // Select all permissions for a specific module (row)
  const handleSelectAllRow = (module) => {
    const modulePerms = permissions[module] || {};
    const allChecked = ACTIONS.every((action) => modulePerms[action.key] === true);
    
    setPermissions((prev) => ({
      ...prev,
      [module]: Object.fromEntries(
        ACTIONS.map((action) => [action.key, !allChecked])
      ),
    }));
  };

  // Select all permissions for a specific action (column)
  const handleSelectAllColumn = (actionKey) => {
    const allChecked = MODULES.every(
      (module) => permissions[module]?.[actionKey] === true
    );
    
    setPermissions((prev) => {
      const newPerms = { ...prev };
      MODULES.forEach((module) => {
        newPerms[module] = {
          ...(newPerms[module] || {}),
          [actionKey]: !allChecked,
        };
      });
      return newPerms;
    });
  };

  // Select all permissions (entire table)
  const handleSelectAllTable = () => {
    const allChecked = MODULES.every((module) =>
      ACTIONS.every((action) => permissions[module]?.[action.key] === true)
    );
    
    setPermissions((prev) => {
      const newPerms = {};
      MODULES.forEach((module) => {
        newPerms[module] = Object.fromEntries(
          ACTIONS.map((action) => [action.key, !allChecked])
        );
      });
      return newPerms;
    });
  };

  const handleSavePermissions = async () => {
    if (!role) return;
    
    setSaving(true);
    try {
      // Save permissions for each module
      for (const module of MODULES) {
        const modulePerms = permissions[module] || {};
        await put(`/api/roles/${id}/permissions`, {
          tenant_id: tenantId,
          module_name: module,
          permissions: modulePerms,
        });
      }
      
      showToast('Permissions updated successfully', 'success');
    } catch (err) {
      showToast(`Failed to save permissions: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader message="Loading role details..." />;
  }

  if (!role) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-red-600">Role not found</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{role.role_name}</h1>
            <p className="text-gray-600 mt-1">{role.role_description || 'No description'}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/roles')}
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: THEME_COLORS.lightBlueDark }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.mediumTealDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.lightBlueDark}
            >
              ← Back
            </button>
            <button
              onClick={handleSavePermissions}
              disabled={saving}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              style={{ background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})` }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`)}
              onMouseLeave={(e) => !saving && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`)}
            >
              {saving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Permissions</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={MODULES.every((module) =>
                          ACTIONS.every((action) => permissions[module]?.[action.key] === true)
                        )}
                        onChange={handleSelectAllTable}
                        className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                        title="Select All"
                      />
                      <span>Module</span>
                    </div>
                  </th>
                  {ACTIONS.map((action) => {
                    const allChecked = MODULES.every(
                      (module) => permissions[module]?.[action.key] === true
                    );
                    const IconComponent = action.icon;
                    return (
                      <th
                        key={action.key}
                        className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            onChange={() => handleSelectAllColumn(action.key)}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            title={`Select All ${action.label}`}
                          />
                          <div className="flex items-center gap-1">
                            <IconComponent size={14} className="text-gray-600" />
                            <span>{action.label}</span>
                          </div>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {MODULES.map((module) => {
                  const rowAllChecked = ACTIONS.every(
                    (action) => permissions[module]?.[action.key] === true
                  );
                  return (
                    <tr key={module} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={rowAllChecked}
                            onChange={() => handleSelectAllRow(module)}
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            title={`Select All ${module.replace(/_/g, ' ')}`}
                          />
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            {module.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </td>
                      {ACTIONS.map((action) => (
                        <td key={action.key} className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={permissions[module]?.[action.key] || false}
                            onChange={(e) =>
                              handlePermissionChange(module, action.key, e.target.checked)
                            }
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
  );
}

