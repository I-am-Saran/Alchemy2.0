import React, { useEffect, useMemo, useState } from "react";
import DataTable from "react-data-table-component";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { useTasks, useInvalidateTasks } from "../hooks/useTasks";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Eye, Search, FileEdit, Trash } from "lucide-react";
import { THEME_COLORS } from "../constants/colors";
import { get, del } from "../services/api";
import { MODULE_ICONS } from "../constants/moduleIcons";
import ModernModal from "../components/ModernModal";
import Loader from "../components/Loader";
import TaskEditModal from "../components/TaskEditModal";

export default function TasksPage() {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, loading: permissionsLoading, permissions } = usePermissions();
  const [searchParams] = useSearchParams();
  const controlIdFilter = searchParams.get("control_id") || "";
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterTaskType, setFilterTaskType] = useState("");
  const navigate = useNavigate();
  
  // Use React Query hook for tasks
  const { data: tasks = [], isLoading: tasksLoading, error: tasksError } = useTasks(controlIdFilter);
  const invalidateTasks = useInvalidateTasks();
  
  // Handle errors from React Query
  useEffect(() => {
    if (tasksError) {
      const errorMsg = tasksError.message || 'Failed to load tasks';
      showToast(`Failed to load tasks: ${errorMsg}`, 'error');
    }
  }, [tasksError, showToast]);

  const deleteTask = async (id) => {
    // Check permission before attempting delete
    const tasksPerms = permissions['tasks'];
    if (!tasksPerms || tasksPerms.can_delete !== true) {
      showToast('You do not have permission to delete tasks', 'error');
      setConfirmDeleteId(null);
      return;
    }
    
    try {
      const json = await del(`/api/tasks/${id}`);
      if (json.error) {
        // If error is 403, it's a permission issue
        if (json.error.includes('permission') || json.error.includes('403')) {
          showToast('You do not have permission to delete tasks', 'error');
        } else {
          throw new Error(json.error);
        }
      } else {
        showToast('Task deleted successfully', 'success');
        // Invalidate and refetch tasks using React Query
        invalidateTasks();
      }
    } catch (e) {
      // Check if it's a permission error
      if (e.message && (e.message.includes('permission') || e.message.includes('403'))) {
        showToast('You do not have permission to delete tasks', 'error');
      } else {
        showToast(`Failed to delete task: ${e.message}`, 'error');
      }
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const columns = useMemo(
    () => [
      { 
        name: "Task Name", 
        selector: (t) => t.task_name, 
        sortable: true,
        wrap: false,
        width: "200px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '200px'
            }}
            title={t.task_name || ''}
          >
            {t.task_name || '—'}
          </div>
        )
      },
      { 
        name: "Priority", 
        selector: (t) => t.task_priority, 
        sortable: true,
        width: "100px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100px'
            }}
            title={t.task_priority || ''}
          >
            {t.task_priority || '—'}
          </div>
        )
      },
      { 
        name: "Type", 
        selector: (t) => t.task_type, 
        sortable: true,
        width: "120px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '120px'
            }}
            title={t.task_type || ''}
          >
            {t.task_type || '—'}
          </div>
        )
      },
      { 
        name: "Control Stage", 
        selector: (t) => t.control_stage, 
        sortable: true,
        wrap: false,
        width: "130px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '130px'
            }}
            title={t.control_stage || ''}
          >
            {t.control_stage || '—'}
          </div>
        )
      },
      { 
        name: "Status", 
        selector: (t) => t.task_status, 
        sortable: true,
        width: "100px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100px'
            }}
            title={t.task_status || ''}
          >
            {t.task_status || '—'}
          </div>
        )
      },
      { 
        name: "Assigned To", 
        selector: (t) => t.assigned_to, 
        sortable: true,
        wrap: false,
        width: "180px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '180px'
            }}
            title={t.assigned_to || ''}
          >
            {t.assigned_to || '—'}
          </div>
        )
      },
      { 
        name: "Department", 
        selector: (t) => t.department || "", 
        sortable: true,
        width: "150px",
      },
      { 
        name: "Control ID", 
        selector: (t) => t.control_id, 
        sortable: true,
        wrap: false,
        width: "150px",
        cell: (t) => (
          <div 
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '150px'
            }}
            title={t.control_id || ''}
          >
            {t.control_id || '—'}
          </div>
        )
      },
      {
        name: "Created At",
        selector: (t) => (t.created_at ? String(t.created_at).replace("T", " ") : ""),
        sortable: true,
        width: "140px",
        cell: (t) => {
          if (!t.created_at) return "—";
          const dateStr = String(t.created_at).replace("T", " ");
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
        cell: (t) => {
          // Don't render buttons until permissions are loaded
          if (permissionsLoading || !permissions || !permissions['tasks']) {
            return <div className="flex items-center gap-2">Loading...</div>;
          }
          
          // Get permissions directly - must be explicitly true
          const tasksPerms = permissions['tasks'];
          const canRetrieve = tasksPerms && tasksPerms.can_retrieve === true;
          const canUpdate = tasksPerms && tasksPerms.can_update === true;
          const canDelete = tasksPerms && tasksPerms.can_delete === true;
          
          // Build buttons array - only include if permission is true
          const buttons = [];
          
          if (canRetrieve) {
            buttons.push(
              <button
                key="view"
                className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-blue-50"
                title="View"
                onClick={() => navigate(`/tasks/${t.id}`)}
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
                onClick={() => setEditingTaskId(t.id)}
                style={{ color: THEME_COLORS.mediumTeal }}
              >
                <FileEdit size={16} />
              </button>
            );
          }
          
          // Only add delete button if canDelete is explicitly true
          if (canDelete === true) {
            buttons.push(
              <button
                key="delete"
                className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-red-50"
                title="Delete"
                onClick={() => {
                  // Double-check permission before allowing delete
                  const currentPerms = permissions['tasks'];
                  if (currentPerms && currentPerms.can_delete === true) {
                    setConfirmDeleteId(t.id);
                  } else {
                    showToast('You do not have permission to delete tasks', 'error');
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
    [navigate, permissionsLoading, permissions, showToast, tasks]
  );

  // Get unique departments for filter
  const uniqueDepartments = useMemo(() => {
    const departments = new Set(tasks.map((t) => t.department).filter(Boolean));
    return Array.from(departments).sort();
  }, [tasks]);

  // Filter tasks based on search text, department, and task type
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((task) => {
        return (
          (task.task_name && task.task_name.toLowerCase().includes(searchLower)) ||
          (task.task_priority && task.task_priority.toLowerCase().includes(searchLower)) ||
          (task.task_type && task.task_type.toLowerCase().includes(searchLower)) ||
          (task.task_status && task.task_status.toLowerCase().includes(searchLower)) ||
          (task.assigned_to && task.assigned_to.toLowerCase().includes(searchLower)) ||
          (task.control_id && task.control_id.toLowerCase().includes(searchLower)) ||
          (task.task_note && task.task_note.toLowerCase().includes(searchLower)) ||
          (task.department && task.department.toLowerCase().includes(searchLower))
        );
      });
    }
    
    // Apply department filter
    if (filterDepartment) {
      filtered = filtered.filter((task) => task.department === filterDepartment);
    }
    
    // Apply task type filter
    if (filterTaskType) {
      filtered = filtered.filter((task) => task.task_type === filterTaskType);
    }
    
    return filtered;
  }, [tasks, searchText, filterDepartment, filterTaskType]);

  // Calculate task type metrics for cards (based on all active tasks, not filtered)
  const typeMetrics = useMemo(() => {
    const metrics = {};
    
    // Filter out soft deleted or inactive tasks
    const activeTasks = tasks.filter((task) => {
      // Exclude soft deleted tasks
      if (task.is_deleted === true) return false;
      // Exclude inactive tasks if is_active field exists
      if (task.is_active === false) return false;
      return true;
    });
    
    activeTasks.forEach((task) => {
      const type = task.task_type || "Unknown";
      
      if (!metrics[type]) {
        metrics[type] = {
          type: type,
          count: 0
        };
      }
      
      metrics[type].count++;
    });
    
    return Object.values(metrics).sort((a, b) => a.type.localeCompare(b.type));
  }, [tasks]);

  // Calculate status metrics for cards (based on filtered tasks)
  const statusMetrics = useMemo(() => {
    const metrics = {};
    
    filteredTasks.forEach((task) => {
      const status = task.task_status || "Unknown";
      
      if (!metrics[status]) {
        metrics[status] = {
          status: status,
          count: 0
        };
      }
      
      metrics[status].count++;
    });
    
    return Object.values(metrics).sort((a, b) => a.status.localeCompare(b.status));
  }, [filteredTasks]);

  // Calculate status vs department cross-tabulation (based on filtered tasks)
  const statusDeptTable = useMemo(() => {
    const table = {};
    const departments = new Set();
    
    filteredTasks.forEach((task) => {
      const status = task.task_status || "Unknown";
      const dept = task.department || "Unassigned";
      
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
  }, [filteredTasks]);

  // Show loader only until session is loaded, then show UI immediately
  if (sessionLoading) {
    return <Loader message="Loading tasks..." />;
  }

  return (
    <div className="p-6" style={{ overflowX: 'hidden', overflowY: 'auto', width: '100%', maxWidth: '100%', height: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.tasks, { size: 24, className: "text-violet-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">Tasks</h1>
        </div>
      </div>

      {/* Task Type Cards - First Row */}
      {!tasksLoading && typeMetrics.length > 0 && (
        <div className="mb-6">
          <div 
            className="grid gap-3 items-stretch" 
            style={{ 
              gridTemplateColumns: `repeat(${typeMetrics.length}, minmax(100px, 1fr))`,
              display: 'grid'
            }}
          >
            {typeMetrics.map((typeMetric) => (
              <button
                key={typeMetric.type}
                onClick={() => setFilterTaskType(filterTaskType === typeMetric.type ? "" : typeMetric.type)}
                className={`bg-white rounded-lg border-2 transition-all p-3 text-center hover:shadow-md ${
                  filterTaskType === typeMetric.type
                    ? "border-blue-500 shadow-md"
                    : "border-gray-200 shadow-sm hover:border-gray-300"
                }`}
                style={{
                  cursor: "pointer"
                }}
              >
                <div className="text-xs font-medium text-gray-600 mb-1 truncate" title={typeMetric.type}>
                  {typeMetric.type}
                </div>
                <div className={`text-xl font-bold ${
                  filterTaskType === typeMetric.type ? "text-blue-600" : "text-gray-800"
                }`}>
                  {typeMetric.count}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Status Cards and Table - Only show when data is loaded */}
      {!tasksLoading && (statusMetrics.length > 0 || (statusDeptTable.statuses.length > 0 && statusDeptTable.departments.length > 0)) && (
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
                          {filteredTasks.length}
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
            placeholder="Search tasks..."
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
          {!permissionsLoading && hasPermission('tasks', 'create') && (
            <button
              type="button"
              className="flex items-center gap-2"
              onClick={() => {
                const url = controlIdFilter 
                  ? `/tasks/new?control_id=${encodeURIComponent(controlIdFilter)}`
                  : '/tasks/new';
                navigate(url);
              }}
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
              <Plus size={18} /> <span className="hidden sm:inline">Create Task</span>
            </button>
          )}
        </div>
      </div>

      {tasksLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="flex items-center gap-3">
            <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1.5rem', height: '1.5rem' }}>
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="text-muted">Loading tasks...</span>
          </div>
        </div>
      ) : (
        <DataTable 
          columns={columns} 
          data={filteredTasks} 
          pagination 
          dense 
          highlightOnHover 
          striped 
          noTableHead={false}
        />
      )}

      {confirmDeleteId !== null && (
        <ModernModal
          open={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          title="Delete Task?"
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
                onClick={() => deleteTask(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-gray-600">
            Are you sure you want to delete this task? This action cannot be undone.
          </p>
        </ModernModal>
      )}

      {/* Edit Modal */}
      {editingTaskId && (
        <TaskEditModal
          open={!!editingTaskId}
          onClose={() => setEditingTaskId(null)}
          taskId={editingTaskId}
          onSuccess={() => {
            // Invalidate and refetch tasks after successful edit
            invalidateTasks();
          }}
        />
      )}

    </div>
  );
}