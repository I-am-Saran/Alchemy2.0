import React, { useEffect, useMemo, useState } from "react";
import DataTable from "react-data-table-component";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Search, FileEdit, Trash } from "lucide-react";
import { THEME_COLORS } from "../constants/colors";
import { get, del } from "../services/api";
import { MODULE_ICONS } from "../constants/moduleIcons";
import ModernModal from "../components/ModernModal";
import Loader from "../components/Loader";

export default function AuditsPage() {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, loading: permissionsLoading, permissions } = usePermissions();
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const navigate = useNavigate();

  const loadAudits = async () => {
    if (!session) return;
    try {
      const url = `/api/audits?tenant_id=${encodeURIComponent(session.tenant_id || '00000000-0000-0000-0000-000000000001')}`;
      const json = await get(url);
      if (json.error) {
        const errorMsg = typeof json.error === 'string' 
          ? json.error 
          : json.error?.message || json.error?.detail || JSON.stringify(json.error);
        throw new Error(errorMsg);
      }
      setAudits(Array.isArray(json.data) ? json.data : []);
    } catch (e) {
      // Handle missing table gracefully - don't show error if table doesn't exist
      const errorMsg = e.message || (typeof e === 'string' ? e : '');
      if (errorMsg.includes('does not exist') || errorMsg.includes('relation') || errorMsg.includes('audits')) {
        // Table doesn't exist yet - this is expected in some deployments
        setAudits([]);
        return;
      }
      console.error("Load audits failed", e);
      showToast(`Failed to load audits: ${errorMsg}`, 'error');
      setAudits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading) {
      if (!session) {
        setLoading(false);
        return;
      }
      setLoading(true);
      loadAudits();
    }
  }, [sessionLoading, session]);

  const deleteAudit = async (id) => {
    const auditsPerms = permissions['audits'];
    if (!auditsPerms || auditsPerms.can_delete !== true) {
      showToast('You do not have permission to delete audits', 'error');
      setConfirmDeleteId(null);
      return;
    }
    
    try {
      const json = await del(`/api/audits/${id}`);
      if (json.error) {
        if (json.error.includes('permission') || json.error.includes('403')) {
          showToast('You do not have permission to delete audits', 'error');
        } else {
          throw new Error(json.error);
        }
      } else {
        showToast('Audit deleted successfully', 'success');
        await loadAudits();
      }
    } catch (e) {
      if (e.message && (e.message.includes('permission') || e.message.includes('403'))) {
        showToast('You do not have permission to delete audits', 'error');
      } else {
        showToast(`Failed to delete audit: ${e.message}`, 'error');
      }
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const columns = useMemo(
    () => [
      { 
        name: "Audit Name", 
        selector: (a) => a.audit_name, 
        sortable: true,
        wrap: false,
        width: "200px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px'
            }}
            title={a.audit_name || ''}
          >
            {a.audit_name || '—'}
          </div>
        )
      },
      { 
        name: "Priority", 
        selector: (a) => a.audit_priority, 
        sortable: true,
        width: "100px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100px'
            }}
            title={a.audit_priority || ''}
          >
            {a.audit_priority || '—'}
          </div>
        )
      },
      { 
        name: "Type", 
        selector: (a) => a.audit_type, 
        sortable: true,
        width: "120px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '120px'
            }}
            title={a.audit_type || ''}
          >
            {a.audit_type || '—'}
          </div>
        )
      },
      { 
        name: "Control Stage", 
        selector: (a) => a.control_stage, 
        sortable: true,
        wrap: false,
        width: "130px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '130px'
            }}
            title={a.control_stage || ''}
          >
            {a.control_stage || '—'}
          </div>
        )
      },
      { 
        name: "Status", 
        selector: (a) => a.audit_status, 
        sortable: true,
        width: "100px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100px'
            }}
            title={a.audit_status || ''}
          >
            {a.audit_status || '—'}
          </div>
        )
      },
      { 
        name: "Audit Owner", 
        selector: (a) => a.audit_owner, 
        sortable: true,
        wrap: false,
        width: "180px",
        cell: (a) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px'
            }}
            title={a.audit_owner || ''}
          >
            {a.audit_owner || '—'}
          </div>
        )
      },
      { 
        name: "Department", 
        selector: (a) => a.department || "", 
        sortable: true,
        width: "150px",
      },
      {
        name: "Created At",
        selector: (a) => (a.created_at ? String(a.created_at).replace("T", " ") : ""),
        sortable: true,
        width: "140px",
        cell: (a) => {
          if (!a.created_at) return "—";
          const dateStr = String(a.created_at).replace("T", " ");
          const [date, time] = dateStr.split(" ");
          return (
            <div className="flex flex-col" style={{ fontSize: "0.875rem" }}>
              <span>{date || "—"}</span>
              <span className="text-gray-500 text-xs">{time ? time.substring(0, 8) : ""}</span>
            </div>
          );
        },
      },
      {
        name: "Actions",
        width: "120px",
        style: { textAlign: 'center' },
        cell: (a) => {
          if (permissionsLoading || !permissions || !permissions['audits']) {
            return <div className="flex items-center gap-2">Loading...</div>;
          }
          
          const auditsPerms = permissions['audits'];
          const canRetrieve = auditsPerms && auditsPerms.can_retrieve === true;
          const canUpdate = auditsPerms && auditsPerms.can_update === true;
          const canDelete = auditsPerms && auditsPerms.can_delete === true;
          
          const buttons = [];
          
          if (canRetrieve) {
            buttons.push(
              <button
                key="view"
                className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-blue-50"
                title="View"
                onClick={() => navigate(`/audits/${a.id}`)}
                style={{ color: THEME_COLORS.darkTeal }}
              >
                <Eye size={16} />
              </button>
            );
          }
          
          if (canUpdate) {
            buttons.push(
              <button
                key="edit"
                className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-cyan-50"
                title="Edit"
                onClick={() => navigate(`/audits/edit/${a.id}`)}
                style={{ color: THEME_COLORS.mediumTeal }}
              >
                <FileEdit size={16} />
              </button>
            );
          }
          
          if (canDelete === true) {
            buttons.push(
              <button
                key="delete"
                className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-red-50"
                title="Delete"
                onClick={() => {
                  const currentPerms = permissions['audits'];
                  if (currentPerms && currentPerms.can_delete === true) {
                    setConfirmDeleteId(a.id);
                  } else {
                    showToast('You do not have permission to delete audits', 'error');
                  }
                }}
                style={{ color: "#dc3545" }}
              >
                <Trash size={16} />
              </button>
            );
          }
          
          return (
            <div className="flex items-center justify-center gap-2">
              {buttons.length > 0 ? buttons : <span className="text-sm text-gray-500">No actions</span>}
            </div>
          );
        },
      },
    ],
    [navigate, permissionsLoading, permissions, showToast, audits]
  );

  // Get unique departments for filter
  const uniqueDepartments = useMemo(() => {
    const departments = new Set(audits.map((a) => a.department).filter(Boolean));
    return Array.from(departments).sort();
  }, [audits]);

  const filteredAudits = useMemo(() => {
    let filtered = audits;
    
    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((audit) => {
        return (
          (audit.audit_name && audit.audit_name.toLowerCase().includes(searchLower)) ||
          (audit.audit_priority && audit.audit_priority.toLowerCase().includes(searchLower)) ||
          (audit.audit_type && audit.audit_type.toLowerCase().includes(searchLower)) ||
          (audit.audit_status && audit.audit_status.toLowerCase().includes(searchLower)) ||
          (audit.audit_owner && audit.audit_owner.toLowerCase().includes(searchLower)) ||
          (audit.audit_note && audit.audit_note.toLowerCase().includes(searchLower)) ||
          (audit.department && audit.department.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Apply department filter
    if (filterDepartment) {
      filtered = filtered.filter((audit) => audit.department === filterDepartment);
    }
    
    return filtered;
  }, [audits, searchText, filterDepartment]);

  // Calculate status metrics for cards (based on filtered audits)
  const statusMetrics = useMemo(() => {
    const metrics = {};
    
    filteredAudits.forEach((audit) => {
      const status = audit.audit_status || "Unknown";
      
      if (!metrics[status]) {
        metrics[status] = {
          status: status,
          count: 0
        };
      }
      
      metrics[status].count++;
    });
    
    return Object.values(metrics).sort((a, b) => a.status.localeCompare(b.status));
  }, [filteredAudits]);

  // Calculate status vs department cross-tabulation (based on filtered audits)
  const statusDeptTable = useMemo(() => {
    const table = {};
    const departments = new Set();
    
    filteredAudits.forEach((audit) => {
      const status = audit.audit_status || "Unknown";
      const dept = audit.department || "Unassigned";
      
      departments.add(dept);
      
      if (!table[status]) {
        table[status] = {};
      }
      
      if (!table[status][dept]) {
        table[status][dept] = 0;
      }
      
      table[status][dept]++;
    });
    
    const sortedDepts = Array.from(departments).sort();
    const sortedStatuses = Object.keys(table).sort();
    
    return {
      statuses: sortedStatuses,
      departments: sortedDepts,
      data: table
    };
  }, [filteredAudits]);

  if (sessionLoading || loading || permissionsLoading) {
    return <Loader message="Loading audits..." />;
  }

  return (
    <div className="p-6" style={{ overflowX: 'hidden', overflowY: 'auto', width: '100%', maxWidth: '100%', height: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.tasks || MODULE_ICONS.audits || (() => <Search size={24} />), { size: 24, className: "text-violet-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">Audits</h1>
        </div>
      </div>

      {/* Status Cards and Table - Only show when data is loaded */}
      {!loading && (statusMetrics.length > 0 || (statusDeptTable.statuses.length > 0 && statusDeptTable.departments.length > 0)) && (
        <div className="mb-6">
          <div className="grid grid-cols-12 gap-6">
            {/* Status Cards - Left Column */}
            <div className="col-span-12 md:col-span-4 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Status Overview</h2>
              {statusMetrics.length > 0 ? (
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {statusMetrics.map((statusMetric) => (
                    <div
                      key={statusMetric.status}
                      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-4 text-center h-full flex flex-col justify-center"
                    >
                      <div className="text-sm font-medium text-gray-600 mb-2">{statusMetric.status}</div>
                      <div className="text-2xl font-bold text-gray-800">{statusMetric.count}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500">
                  No status data available
                </div>
              )}
            </div>

            {/* Status vs Department Table - Right Column */}
            <div className="col-span-12 md:col-span-8 flex flex-col">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Status vs Department</h2>
              {statusDeptTable.statuses.length > 0 && statusDeptTable.departments.length > 0 ? (
                <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto flex-1">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="px-3 py-2 text-left font-semibold text-gray-700 text-xs">Status</th>
                        {statusDeptTable.departments.map((dept) => (
                          <th key={dept} className="px-2 py-2 text-center font-semibold text-gray-700 text-xs min-w-[80px]">
                            {dept.length > 10 ? dept.substring(0, 10) + '...' : dept}
                          </th>
                        ))}
                        <th className="px-3 py-2 text-center font-semibold text-gray-700 bg-gray-100 text-xs">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusDeptTable.statuses.map((status) => {
                        const rowTotal = statusDeptTable.departments.reduce((sum, dept) => {
                          return sum + (statusDeptTable.data[status][dept] || 0);
                        }, 0);
                        
                        return (
                          <tr key={status} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800 text-xs">{status}</td>
                            {statusDeptTable.departments.map((dept) => (
                              <td key={dept} className="px-2 py-2 text-center text-gray-700 text-xs">
                                {statusDeptTable.data[status][dept] || 0}
                              </td>
                            ))}
                            <td className="px-3 py-2 text-center font-semibold text-gray-800 bg-gray-50 text-xs">{rowTotal}</td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 border-t-2 border-gray-300">
                        <td className="px-3 py-2 font-semibold text-gray-800 text-xs">Total</td>
                        {statusDeptTable.departments.map((dept) => {
                          const colTotal = statusDeptTable.statuses.reduce((sum, status) => {
                            return sum + (statusDeptTable.data[status][dept] || 0);
                          }, 0);
                          return (
                            <td key={dept} className="px-2 py-2 text-center font-semibold text-gray-800 text-xs">
                              {colTotal}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-center font-bold text-gray-900 bg-gray-200 text-xs">
                          {filteredAudits.length}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-center text-gray-500">
                  No data available
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Search and Create Button */}
      <div 
        className="mb-4"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%"
        }}
      >
        {/* First Row: Search Box */}
        <div style={{ 
          position: "relative", 
          maxWidth: "400px", 
          width: "100%"
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
            placeholder="Search audits..."
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
        {/* Second Row: Filter and Create Button */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%"
        }}>
          {uniqueDepartments.length > 0 && (
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              style={{
                minWidth: "150px",
                padding: "0.5rem 0.75rem",
                border: `1px solid ${THEME_COLORS.lightBlue}`,
                borderRadius: "0.5rem",
                height: "38px",
                boxSizing: "border-box"
              }}
            >
              <option value="">All Departments</option>
              {uniqueDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
          {!permissionsLoading && hasPermission('audits', 'create') && (
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => navigate('/audits/new')}
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                color: '#ffffff',
                border: 'none',
                padding: "0.5rem 1rem",
                borderRadius: "0.5rem",
                boxShadow: `0 4px 10px rgba(56, 128, 135, 0.3)`,
                whiteSpace: "nowrap"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                e.currentTarget.style.boxShadow = `0 6px 15px rgba(56, 128, 135, 0.4)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                e.currentTarget.style.boxShadow = `0 4px 10px rgba(56, 128, 135, 0.3)`;
              }}
            >
              <Plus size={18} /> <span className="hidden sm:inline">Create Audit</span>
            </button>
          )}
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={filteredAudits} 
        pagination 
        dense 
        highlightOnHover 
        striped 
        noTableHead={false}
      />

      {confirmDeleteId !== null && (
        <ModernModal
          open={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          title="Delete Audit?"
          maxWidth="max-w-sm"
          footer={
            <div className="flex items-center justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-colors"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => deleteAudit(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-gray-600">
            Are you sure you want to delete this audit? This action cannot be undone.
          </p>
        </ModernModal>
      )}

    </div>
  );
}

