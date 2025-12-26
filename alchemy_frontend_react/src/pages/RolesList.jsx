import React, { useEffect, useState, useMemo } from 'react';
import DataTable from "react-data-table-component";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { useSession } from '../contexts/SessionContext';
import { useToast } from '../contexts/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { get } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { MODULE_ICONS } from '../constants/moduleIcons';
import { THEME_COLORS } from '../constants/colors';
import { Search, Plus, Eye, FileEdit } from "lucide-react";
import ModernModal from "../components/ModernModal";
import Loader from "../components/Loader";

export default function RolesList() {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [viewRole, setViewRole] = useState(null);

  const tenantId = session?.tenant_id || '00000000-0000-0000-0000-000000000001';

  useEffect(() => {
    const fetchRoles = async () => {
      if (!session && !sessionLoading) return;
      try {
        setLoading(true);
        const json = await get(`/api/roles?tenant_id=${tenantId}`);
        if (json.error) throw new Error(json.error);
        setRoles(json.data || []);
      } catch (err) {
        showToast(`Failed to load roles: ${err.message}`, 'error');
        setRoles([]);
      } finally {
        setLoading(false);
      }
    };

    if (!sessionLoading && session) {
      fetchRoles();
    }
  }, [session, sessionLoading, tenantId, showToast]);

  // Export functions
  const exportToCSV = () => {
    if (!filteredRoles.length) return alert("No data to export!");
    const headers = Object.keys(filteredRoles[0]);
    const rows = filteredRoles.map((r) => headers.map((h) => JSON.stringify(r[h] || "")));
    const blob = new Blob(
      [headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv" }
    );
    saveAs(blob, "roles.csv");
  };

  const exportToExcel = async () => {
    if (!filteredRoles.length) return alert("No data to export!");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Roles");
    
    // Add headers from first object keys
    if (filteredRoles.length > 0) {
      const headers = Object.keys(filteredRoles[0]);
      worksheet.addRow(headers);
      
      // Add data rows
      filteredRoles.forEach(row => {
        worksheet.addRow(headers.map(key => row[key]));
      });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "roles.xlsx");
  };

  // Filtered data
  const filteredRoles = useMemo(() => {
    let filtered = roles;

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          (r.role_name && r.role_name.toLowerCase().includes(searchLower)) ||
          (r.role_description && r.role_description.toLowerCase().includes(searchLower))
        );
      });
    }

    // Apply type filter
    if (filterType) {
      if (filterType === "System") {
        filtered = filtered.filter((r) => r.is_system_role === true);
      } else if (filterType === "Custom") {
        filtered = filtered.filter((r) => r.is_system_role === false);
      }
    }

    // Apply status filter
    if (filterStatus) {
      if (filterStatus === "Active") {
        filtered = filtered.filter((r) => r.is_active === true);
      } else if (filterStatus === "Inactive") {
        filtered = filtered.filter((r) => r.is_active === false);
      }
    }

    return filtered;
  }, [roles, searchText, filterType, filterStatus]);

  // Columns
  const columns = [
    {
      name: "Role Name",
      selector: (r) => r.role_name || "",
      sortable: true,
      cell: (r) => (
        <button
          onClick={() => setViewRole(r)}
          className="text-purple-600 hover:underline font-medium"
        >
          {r.role_name}
        </button>
      ),
    },
    {
      name: "Description",
      selector: (r) => r.role_description || "",
      sortable: true,
    },
    {
      name: "Type",
      selector: (r) => (r.is_system_role ? "System" : "Custom"),
      sortable: true,
      cell: (r) => {
        const type = r.is_system_role ? "System" : "Custom";
        return (
          <span className={`px-2 py-1 text-xs rounded-full ${
            r.is_system_role ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
          }`}>
            {type}
          </span>
        );
      },
    },
    {
      name: "Status",
      selector: (r) => (r.is_active ? "Active" : "Inactive"),
      sortable: true,
      cell: (r) => {
        const status = r.is_active ? "Active" : "Inactive";
        const statusColors = {
          Active: "text-green-600",
          Inactive: "text-red-600",
        };
        return (
          <span className={`font-semibold ${statusColors[status] || "text-gray-700"}`}>
            {status}
          </span>
        );
      },
    },
    {
      name: "Actions",
      cell: (r) => (
        <div className="d-flex gap-2">
          {hasPermission('roles', 'retrieve') && (
            <button
              onClick={() => setViewRole(r)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.darkTeal }}
              title="View"
            >
              <Eye size={16} />
            </button>
          )}
          {hasPermission('roles', 'update') && (
            <>
              <button
                onClick={() => navigate(`/roles/${r.id}`)}
                className="btn btn-sm p-1"
                style={{ color: THEME_COLORS.mediumTeal }}
                title="Manage Permissions"
              >
                <span className="text-xs">Permissions</span>
              </button>
              <button
                onClick={() => navigate(`/roles/${r.id}/edit`)}
                className="btn btn-sm p-1"
                style={{ color: THEME_COLORS.mediumTeal }}
                title="Edit"
              >
                <FileEdit size={16} />
              </button>
            </>
          )}
        </div>
      ),
      ignoreRowClick: true,
    },
  ];

  if (sessionLoading || loading) {
    return <Loader message="Loading roles..." />;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.roles, { className: "w-6 h-6 text-gray-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">
            Roles
          </h1>
        </div>
        {hasPermission('roles', 'create') && (
          <button
            onClick={() => navigate("/roles/new")}
            className="btn d-flex align-items-center gap-2"
            style={{
              background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
              color: '#ffffff',
              border: 'none',
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
            }}
          >
            <Plus size={18} /> <span>Create Role</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div 
        className="mb-4"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%"
        }}
      >
        {/* Search Box */}
        <div style={{ 
          position: "relative", 
          maxWidth: "400px", 
          flex: "1 1 200px",
          minWidth: "200px"
        }}>
          <Search
            size={18}
            style={{ 
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              zIndex: 10,
              color: "#6b7280"
            }}
          />
          <input
            type="text"
            placeholder="Search roles..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem 0.5rem 2.5rem",
              border: `1px solid ${THEME_COLORS.lightBlue}`,
              borderRadius: "0.5rem",
              height: "38px",
              boxSizing: "border-box"
            }}
          />
        </div>

        {/* Filter Dropdowns */}
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            minWidth: "150px",
            padding: "0.5rem 0.75rem",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            height: "38px",
            boxSizing: "border-box"
          }}
        >
          <option value="">All Types</option>
          <option value="System">System</option>
          <option value="Custom">Custom</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{
            minWidth: "150px",
            padding: "0.5rem 0.75rem",
            border: `1px solid ${THEME_COLORS.lightBlue}`,
            borderRadius: "0.5rem",
            height: "38px",
            boxSizing: "border-box"
          }}
        >
          <option value="">All Statuses</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

        {/* Clear Filters Button */}
        {(filterType || filterStatus || searchText) && (
          <button
            onClick={() => {
              setFilterType("");
              setFilterStatus("");
              setSearchText("");
            }}
            style={{
              padding: "0.5rem 1rem",
              border: `1px solid ${THEME_COLORS.lightBlue}`,
              borderRadius: "0.5rem",
              background: THEME_COLORS.offWhite,
              color: THEME_COLORS.darkTeal,
              height: "38px",
              boxSizing: "border-box",
              cursor: "pointer"
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredRoles}
        pagination
        highlightOnHover
        striped
        dense
        responsive
        sortIcon={<span>⇅</span>}
      />

      {/* View Modal */}
      {viewRole && (
        <ModernModal
          open={!!viewRole}
          onClose={() => setViewRole(null)}
          title="Role Details"
          maxWidth="max-w-3xl"
          footer={
            <div className="flex justify-end gap-2">
              {hasPermission('roles', 'update') && (
                <>
                  <button
                    className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                    onClick={() => {
                      navigate(`/roles/${viewRole.id}`);
                      setViewRole(null);
                    }}
                  >
                    Manage Permissions
                  </button>
                  <button
                    className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                    onClick={() => {
                      navigate(`/roles/${viewRole.id}/edit`);
                      setViewRole(null);
                    }}
                  >
                    Edit
                  </button>
                </>
              )}
              <button
                className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => setViewRole(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-800">
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Role Name</div>
              <div className="font-medium">{viewRole.role_name || "—"}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Type</div>
              <div className="font-medium">
                <span className={`px-2 py-1 text-xs rounded-full ${
                  viewRole.is_system_role ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {viewRole.is_system_role ? 'System' : 'Custom'}
                </span>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600 mb-1">Status</div>
              <div className="font-medium">
                <span className={`font-semibold ${
                  viewRole.is_active ? 'text-green-600' : 'text-red-600'
                }`}>
                  {viewRole.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-sm font-medium text-gray-600 mb-1">Description</div>
              <div className="font-medium whitespace-pre-wrap">{viewRole.role_description || "—"}</div>
            </div>
            {viewRole.created_at && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Created At</div>
                <div className="font-medium">{String(viewRole.created_at).replace("T", " ")}</div>
              </div>
            )}
            {viewRole.updated_at && (
              <div>
                <div className="text-sm font-medium text-gray-600 mb-1">Updated At</div>
                <div className="font-medium">{String(viewRole.updated_at).replace("T", " ")}</div>
              </div>
            )}
          </div>
        </ModernModal>
      )}
    </div>
  );
}
