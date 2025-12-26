import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { get, post, put } from '../services/api';
import { THEME_COLORS } from '../constants/colors';
import Loader from '../components/Loader';

export default function RoleForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useSession();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(!!id); // Load if editing
  const [saving, setSaving] = useState(false);
  const [tenantId] = useState('00000000-0000-0000-0000-000000000001');
  
  const [formData, setFormData] = useState({
    role_name: '',
    role_description: '',
    is_active: true,
  });

  useEffect(() => {
    if (id) {
      const fetchRole = async () => {
        try {
          setLoading(true);
          const json = await get(`/api/roles/${id}?tenant_id=${tenantId}`);
          if (json.error) throw new Error(json.error);
          
          setFormData({
            role_name: json.data.role_name || '',
            role_description: json.data.role_description || '',
            is_active: json.data.is_active !== false,
          });
        } catch (err) {
          showToast(`Failed to load role: ${err.message}`, 'error');
          navigate('/roles');
        } finally {
          setLoading(false);
        }
      };
      
      fetchRole();
    }
  }, [id, tenantId, navigate, showToast]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.role_name.trim()) {
      showToast('Role name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (id) {
        // Update existing role
        const json = await put(`/api/roles/${id}`, {
          tenant_id: tenantId,
          ...formData,
        });
        if (json.error) throw new Error(json.error);
        showToast('Role updated successfully', 'success');
      } else {
        // Create new role
        const json = await post('/api/roles', {
          tenant_id: tenantId,
          ...formData,
        });
        if (json.error) throw new Error(json.error);
        showToast('Role created successfully', 'success');
        // Navigate to role details to manage permissions
        navigate(`/roles/${json.data.id}`);
        return;
      }
      
      navigate('/roles');
    } catch (err) {
      showToast(`Failed to ${id ? 'update' : 'create'} role: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loader message="Loading role form..." />;
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {id ? 'Edit Role' : 'Create New Role'}
          </h1>
          <p className="text-gray-600 mt-1">
            {id ? 'Update role information' : 'Create a new role and assign permissions'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <div className="space-y-6">
            <div>
              <label htmlFor="role_name" className="block text-sm font-medium text-gray-700 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="role_name"
                name="role_name"
                value={formData.role_name}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="e.g., Manager, Developer, Viewer"
              />
            </div>

            <div>
              <label htmlFor="role_description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="role_description"
                name="role_description"
                value={formData.role_description}
                onChange={handleChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                placeholder="Describe the role and its responsibilities..."
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                />
                <span className="ml-2 text-sm text-gray-700">Active</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                Inactive roles cannot be assigned to users
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/roles')}
              className="px-4 py-2 text-white rounded-lg transition-colors"
              style={{ backgroundColor: THEME_COLORS.lightBlueDark }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.mediumTealDark}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = THEME_COLORS.lightBlueDark}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-white rounded-lg disabled:opacity-50 shadow-md hover:shadow-lg transition-all"
              style={{ background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})` }}
              onMouseEnter={(e) => !saving && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`)}
              onMouseLeave={(e) => !saving && (e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`)}
            >
              {saving ? 'Saving...' : id ? 'Update Role' : 'Create Role'}
            </button>
          </div>
        </form>

        {id && (
          <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            <p className="text-sm text-emerald-800">
              <strong>Next steps:</strong> After saving, you can manage permissions for this role by clicking "Manage Permissions" in the roles list.
            </p>
          </div>
        )}
      </div>
  );
}

