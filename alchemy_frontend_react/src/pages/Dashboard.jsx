// src/pages/Dashboard.jsx
import React, { useEffect, useState } from "react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { useNavigate } from "react-router-dom";
import { get } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import { MODULE_ICONS } from "../constants/moduleIcons";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  CheckSquare,
  Shield,
  Award,
  TrendingUp,
  AlertCircle,
  Clock,
  LayoutDashboard,
  ArrowUp,
  ArrowDown,
  ChevronsUpDown,
} from "lucide-react";
import Loader from "../components/Loader";

const COLORS = {
  primary: THEME_COLORS.darkTeal,
  secondary: THEME_COLORS.mediumTeal,
  accent: THEME_COLORS.lightBlue,
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
};

const CHART_COLORS = [
  COLORS.primary,
  COLORS.secondary,
  COLORS.accent,
  COLORS.success,
  COLORS.warning,
  COLORS.danger,
  COLORS.info,
  "#8B5CF6",
  "#EC4899",
];

export default function Dashboard() {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Task metrics
  const [taskMetrics, setTaskMetrics] = useState({
    total: 0,
    tasks_vs_assignees_ageing: [],
    tasks_vs_assignee_vs_priority: [],
    priority_vs_ageing_vs_assignee: [],
  });
  const [taskLoading, setTaskLoading] = useState(true);

  // Controls metrics (collective)
  const [controlsMetrics, setControlsMetrics] = useState({
    total_controls: 0,
    status_vs_assignee: [],
    status_vs_domain: [],
    dept_deptowner_vs_status: [],
    compliance_rate: 0,
  });
  const [controlsLoading, setControlsLoading] = useState(true);
  
  // Sort configurations
  const [assigneeSortConfig, setAssigneeSortConfig] = useState({ column: 'total', direction: 'desc' });
  
  // User email to name mapping
  const [userMap, setUserMap] = useState({}); // { email: { name, email } }

  // Fetch task metrics
  useEffect(() => {
    const fetchTaskMetrics = async () => {
      if (!session || sessionLoading) return;
      setTaskLoading(true);
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(
          `/api/dashboard/tasks/metrics?tenant_id=${encodeURIComponent(tenant_id)}`
        );
        if (json.error) throw new Error(json.error);
        setTaskMetrics(json.data || { 
          total: 0, 
          tasks_vs_assignees_ageing: [], 
          tasks_vs_assignee_vs_priority: [], 
          priority_vs_ageing_vs_assignee: [] 
        });
      } catch (err) {
        showToast(`Failed to load task metrics: ${err.message}`, "error");
        setTaskMetrics({ 
          total: 0, 
          tasks_vs_assignees_ageing: [], 
          tasks_vs_assignee_vs_priority: [], 
          priority_vs_ageing_vs_assignee: [] 
        });
      } finally {
        setTaskLoading(false);
      }
    };
    fetchTaskMetrics();
  }, [session, sessionLoading, showToast]);

  // Fetch users for email-to-name mapping
  useEffect(() => {
    const fetchUsers = async () => {
      if (!session || sessionLoading) return;
      try {
        const json = await get(`/api/users`);
        if (json.error) {
          console.warn("Failed to fetch users for name mapping:", json.error);
          return;
        }
        const usersData = json?.data || (json?.status === "success" ? json.data : []);
        if (Array.isArray(usersData)) {
          const emailMap = {};
          usersData.forEach((u) => {
            const email = u.email || "";
            if (email) {
              const name = u.name || u.full_name || email.split("@")[0];
              emailMap[email] = { name, email };
            }
          });
          setUserMap(emailMap);
        }
      } catch (err) {
        console.warn("Error fetching users for name mapping:", err);
      }
    };
    fetchUsers();
  }, [session, sessionLoading]);

  // Helper function to get display name from email
  const getDisplayName = (email) => {
    if (!email || email === "Unassigned") return email;
    const user = userMap[email];
    if (user) return user.name;
    // Fallback: extract name from email
    return email.split("@")[0];
  };

  // Helper function to get email (for tooltip)
  const getEmail = (email) => {
    if (!email || email === "Unassigned") return email;
    return email;
  };

  // Custom Tooltip component for Recharts that shows email
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // For the third graph, entry.name might be an assignee email
      // Check if any entry name looks like an email (contains @)
      const hasAssigneeEntries = payload.some(entry => entry.name && entry.name.includes('@'));
      
      // Get assignee info from data or from entry names
      let assigneeEmail = data.assigneeEmail || data.assignee;
      let assigneeDisplay = data.assigneeDisplay;
      
      // If this is the third graph with assignees as entry names
      if (hasAssigneeEntries && payload.length > 0) {
        // Show the label (priority-ageBucket) and then each assignee with their email
        return (
          <div className="bg-white border rounded shadow p-2" style={{ fontSize: '12px' }}>
            <p className="mb-1 fw-semibold">{label || `${data.priority || ''} - ${data.ageBucket || ''}`}</p>
            {payload.map((entry, index) => {
              if (entry.value > 0) {
                const entryEmail = entry.name; // entry.name is the assignee email in this graph
                const entryDisplay = getDisplayName(entryEmail);
                return (
                  <div key={index} style={{ margin: '4px 0' }}>
                    <p style={{ color: entry.color, margin: '2px 0', fontWeight: 'bold' }}>
                      {`${entryDisplay}: ${entry.value}`}
                    </p>
                    {entryEmail && entryEmail !== entryDisplay && entryEmail !== "Unassigned" && (
                      <p className="mb-0 text-muted small" style={{ marginLeft: '8px', fontSize: '10px' }}>
                        {entryEmail}
                      </p>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        );
      }
      
      // For other graphs, show assignee info at the top
      const email = assigneeEmail || label;
      const displayName = assigneeDisplay || getDisplayName(email) || label;
      
      return (
        <div className="bg-white border rounded shadow p-2" style={{ fontSize: '12px' }}>
          <p className="mb-1 fw-semibold">{displayName}</p>
          {email && email !== displayName && email !== "Unassigned" && email.includes('@') && (
            <p className="mb-1 text-muted small">{email}</p>
          )}
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color, margin: '2px 0' }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Fetch controls metrics
  useEffect(() => {
    const fetchControlsMetrics = async () => {
      if (!session || sessionLoading) return;
      setControlsLoading(true);
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(
          `/api/dashboard/controls/metrics?tenant_id=${encodeURIComponent(tenant_id)}`
        );
        if (json.error) {
          // Handle error object properly
          const errorMsg = typeof json.error === 'string' 
            ? json.error 
            : json.error?.message || json.error?.detail || JSON.stringify(json.error);
          throw new Error(errorMsg);
        }
        const data = json.data || { 
          total_controls: 0, 
          status_vs_assignee: [], 
          status_vs_domain: [], 
          dept_deptowner_vs_status: [],
          compliance_rate: 0
        };
        setControlsMetrics(data);
      } catch (err) {
        // Extract detailed error message
        let errorMessage = err.message || "Unknown error";
        if (err.body) {
          if (typeof err.body === 'string') {
            errorMessage = err.body;
          } else if (err.body.detail) {
            errorMessage = err.body.detail;
          } else if (err.body.error) {
            errorMessage = typeof err.body.error === 'string' ? err.body.error : err.body.error.message || JSON.stringify(err.body.error);
          } else if (err.body.message) {
            errorMessage = err.body.message;
          }
        }
        if (err.status === 403) {
          errorMessage = "You don't have permission to view controls metrics. Please contact your administrator.";
        } else if (err.status === 401) {
          errorMessage = "Authentication failed. Please log in again.";
        }
        console.error("Controls metrics error:", err);
        console.error("Error details:", {
          message: err.message,
          status: err.status,
          body: err.body,
          stack: err.stack
        });
        showToast(`Failed to load controls metrics: ${errorMessage}`, "error");
        setControlsMetrics({ 
          total_controls: 0, 
          status_vs_assignee: [], 
          status_vs_domain: [], 
          dept_deptowner_vs_status: [],
          compliance_rate: 0
        });
      } finally {
        setControlsLoading(false);
      }
    };
    fetchControlsMetrics();
  }, [session, sessionLoading, showToast]);

  // Show loader only until session is loaded, then show UI immediately
  if (sessionLoading) {
    return <Loader message="Loading dashboard..." />;
  }

  return (
    <div className="container-fluid p-4" style={{ maxWidth: '100%' }}>
        {/* Header */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="d-flex align-items-center gap-3 mb-3">
              {React.createElement(MODULE_ICONS.dashboard || LayoutDashboard || CheckSquare, {
                size: 28,
                className: "text-violet-800",
              })}
              <h1 className="h3 mb-0 text-violet-800 fw-semibold">Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="row mb-4">
          <div className="col-md-4 col-sm-6 mb-3">
            <div
              className="card h-100 shadow-sm"
              style={{
                borderLeft: `4px solid ${COLORS.secondary}`,
                cursor: "pointer",
              }}
              onClick={() => navigate("/security-controls")}
            >
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1 small">Total Controls</p>
                    {controlsLoading ? (
                      <div className="d-flex align-items-center gap-2">
                        <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <span className="text-muted small">Loading...</span>
                      </div>
                    ) : (
                      <h3 className="mb-0 fw-bold">{controlsMetrics.total_controls}</h3>
                    )}
                  </div>
                  <Shield size={32} color={COLORS.secondary} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-sm-6 mb-3">
            <div
              className="card h-100 shadow-sm"
              style={{
                borderLeft: `4px solid ${COLORS.primary}`,
                cursor: "pointer",
              }}
              onClick={() => navigate("/tasks")}
            >
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1 small">Total Tasks</p>
                    {taskLoading ? (
                      <div className="d-flex align-items-center gap-2">
                        <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <span className="text-muted small">Loading...</span>
                      </div>
                    ) : (
                      <h3 className="mb-0 fw-bold">{taskMetrics.total}</h3>
                    )}
                  </div>
                  <CheckSquare size={32} color={COLORS.primary} />
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-4 col-sm-6 mb-3">
            <div className="card h-100 shadow-sm" style={{ borderLeft: `4px solid ${COLORS.success}` }}>
              <div className="card-body">
                <div className="d-flex align-items-center justify-content-between">
                  <div>
                    <p className="text-muted mb-1 small">Compliance Score</p>
                    {controlsLoading ? (
                      <div className="d-flex align-items-center gap-2">
                        <div className="spinner-border spinner-border-sm" role="status" style={{ width: '1rem', height: '1rem' }}>
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <span className="text-muted small">Loading...</span>
                      </div>
                    ) : (
                      <h3 className="mb-0 fw-bold">{controlsMetrics.compliance_rate}%</h3>
                    )}
                  </div>
                  <TrendingUp size={32} color={COLORS.success} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls Status Distribution and Assignee Table */}
        <div className="row mb-4">
          {/* Horizontal Bar Chart - Status Distribution */}
          <div className="col-md-4 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <Shield size={20} color={COLORS.secondary} />
                  Controls by Status
                </h5>
              </div>
              <div className="card-body d-flex flex-column" style={{ height: '100%' }}>
                {controlsLoading ? (
                  <p className="text-muted">Loading...</p>
                ) : controlsMetrics.status_vs_assignee.length > 0 ? (
                  (() => {
                    // Calculate status totals
                    const statusTotals = {};
                    controlsMetrics.status_vs_assignee.forEach((item) => {
                      statusTotals[item.status] = (statusTotals[item.status] || 0) + item.count;
                    });
                    
                    const barData = Object.entries(statusTotals)
                      .map(([status, value]) => ({
                        status: status,
                        count: value
                      }))
                      .sort((a, b) => b.count - a.count); // Sort by count descending
                    
                    // Custom tick component for multi-line labels
                    const CustomYAxisTick = ({ x, y, payload }) => {
                      const text = payload.value;
                      const words = text.split(' ');
                      const mid = Math.ceil(words.length / 2);
                      const line1 = words.slice(0, mid).join(' ');
                      const line2 = words.slice(mid).join(' ');
                      
                      return (
                        <g transform={`translate(${x},${y})`}>
                          <text x={0} y={0} dy={-4} textAnchor="end" fill="#666" fontSize={11}>
                            <tspan x={0} dy="0">{line1}</tspan>
                            {line2 && <tspan x={0} dy="12">{line2}</tspan>}
                          </text>
                        </g>
                      );
                    };
                    
                    return (
                      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                        <ResponsiveContainer width="100%" height={Math.max(400, barData.length * 50 + 100)}>
                          <BarChart
                            data={barData}
                            layout="vertical"
                            margin={{ top: 10, right: 50, left: 10, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis 
                              type="number" 
                              tick={{ fontSize: 12 }}
                              label={{ value: 'Number of Controls', position: 'insideBottom', offset: -2, style: { fontSize: 12 } }}
                            />
                            <YAxis 
                              dataKey="status" 
                              type="category" 
                              width={120}
                              tick={<CustomYAxisTick />}
                              interval={0}
                            />
                            <Tooltip 
                              formatter={(value) => [value, 'Count']}
                              labelFormatter={(label) => `Status: ${label}`}
                              contentStyle={{ fontSize: 12 }}
                            />
                            <Bar 
                              dataKey="count" 
                              fill={COLORS.primary}
                              radius={[0, 4, 4, 0]}
                              label={{ position: 'right', fontSize: 11, fill: '#333' }}
                            >
                              {barData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-muted">No data available</p>
                )}
              </div>
            </div>
          </div>

          {/* Assignee vs Status Table */}
          <div className="col-md-8 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <Shield size={20} color={COLORS.secondary} />
                  Controls by Owner & Status
                </h5>
              </div>
              <div className="card-body d-flex flex-column" style={{ height: '100%' }}>
                {controlsLoading ? (
                  <p className="text-muted">Loading controls metrics...</p>
                ) : controlsMetrics.status_vs_assignee.length > 0 ? (
                            (() => {
                              const assignees = Array.from(new Set(controlsMetrics.status_vs_assignee.map((d) => d.assignee)));
                              const statuses = Array.from(new Set(controlsMetrics.status_vs_assignee.map((d) => d.status)));
                              
                              // Build table data with totals
                              const tableData = assignees.map((assignee) => {
                                const row = { assignee, total: 0 };
                                statuses.forEach((status) => {
                                  const item = controlsMetrics.status_vs_assignee.find(
                                    (d) => d.assignee === assignee && d.status === status
                                  );
                                  const count = item ? item.count : 0;
                                  row[status] = count;
                                  row.total += count;
                                });
                                return row;
                              });
                              
                              // Sort function
                              const sortData = (data, sortConfig) => {
                                const sorted = [...data];
                                sorted.sort((a, b) => {
                                  let aVal, bVal;
                                  if (sortConfig.column === 'assignee') {
                                    aVal = a.assignee || '';
                                    bVal = b.assignee || '';
                                    return sortConfig.direction === 'asc' 
                                      ? aVal.localeCompare(bVal)
                                      : bVal.localeCompare(aVal);
                                  } else if (sortConfig.column === 'total') {
                                    aVal = a.total || 0;
                                    bVal = b.total || 0;
                                  } else {
                                    aVal = a[sortConfig.column] || 0;
                                    bVal = b[sortConfig.column] || 0;
                                  }
                                  return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                                });
                                return sorted;
                              };
                              
                              const sortedData = sortData(tableData, assigneeSortConfig);
                              
                              const handleSort = (column) => {
                                setAssigneeSortConfig(prev => ({
                                  column,
                                  direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc'
                                }));
                              };
                              
                              const getSortIcon = (column) => {
                                if (assigneeSortConfig.column !== column) {
                                  return <ChevronsUpDown size={14} className="ms-1 opacity-50" />;
                                }
                                return assigneeSortConfig.direction === 'asc' 
                                  ? <ArrowUp size={14} className="ms-1" />
                                  : <ArrowDown size={14} className="ms-1" />;
                              };
                              
                              // Calculate column totals
                              const columnTotals = {};
                              statuses.forEach((status) => {
                                columnTotals[status] = sortedData.reduce((sum, row) => sum + (row[status] || 0), 0);
                              });
                              const grandTotal = sortedData.reduce((sum, row) => sum + row.total, 0);
                              
                              return (
                                <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                                  <table className="table table-bordered table-hover table-sm mb-0">
                                    <thead className="table-light">
                                      <tr>
                                        <th 
                                          className="fw-semibold" 
                                          style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 10, cursor: 'pointer' }}
                                          onClick={() => handleSort('assignee')}
                                        >
                                          <div className="d-flex align-items-center">
                                            Owner
                                            {getSortIcon('assignee')}
                                          </div>
                                        </th>
                                        {statuses.map((status) => (
                                          <th 
                                            key={status} 
                                            className="text-center fw-semibold"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => handleSort(status)}
                                          >
                                            <div className="d-flex align-items-center justify-content-center">
                                              {status}
                                              {getSortIcon(status)}
                                            </div>
                                          </th>
                                        ))}
                                        <th 
                                          className="text-center fw-semibold bg-light"
                                          style={{ cursor: 'pointer' }}
                                          onClick={() => handleSort('total')}
                                        >
                                          <div className="d-flex align-items-center justify-content-center">
                                            Total
                                            {getSortIcon('total')}
                                          </div>
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sortedData.map((row, idx) => {
                                        const assigneeEmail = row.assignee;
                                        const assigneeDisplay = getDisplayName(assigneeEmail);
                                        // Show tooltip if email exists, is different from display name, and is not "Unassigned"
                                        const showTooltip = assigneeEmail && 
                                                          assigneeEmail !== assigneeDisplay && 
                                                          assigneeEmail !== "Unassigned";
                                        return (
                                          <tr key={idx}>
                                            <td 
                                              className="fw-medium" 
                                              style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5, cursor: showTooltip ? 'help' : 'default' }}
                                              title={showTooltip ? assigneeEmail : undefined}
                                            >
                                              {assigneeDisplay}
                                            </td>
                                          {statuses.map((status) => (
                                            <td key={status} className="text-center">
                                              {row[status] || 0}
                                            </td>
                                          ))}
                                          <td className="text-center fw-semibold bg-light">{row.total}</td>
                                        </tr>
                                        );
                                      })}
                                    </tbody>
                                    <tfoot className="table-secondary">
                                      <tr>
                                        <td className="fw-bold" style={{ position: 'sticky', left: 0, backgroundColor: '#6c757d', color: 'white', zIndex: 10 }}>
                                          Total
                                        </td>
                                        {statuses.map((status) => (
                                          <td key={status} className="text-center fw-bold">
                                            {columnTotals[status]}
                                          </td>
                                        ))}
                                        <td className="text-center fw-bold">{grandTotal}</td>
                                      </tr>
                                    </tfoot>
                                  </table>
                                </div>
                              );
                            })()
                          ) : (
                            <p className="text-muted">No data available</p>
                          )}
              </div>
            </div>
          </div>
        </div>

        {/* Department + Dept Owner vs Status */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow-sm h-100">
              <div className="card-header bg-white">
                <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <Shield size={20} color={COLORS.secondary} />
                  Controls by Department + Dept Owner & Status
                </h5>
              </div>
              <div className="card-body d-flex flex-column" style={{ height: '100%' }}>
                {controlsLoading ? (
                  <p className="text-muted">Loading controls metrics...</p>
                ) : controlsMetrics.dept_deptowner_vs_status && controlsMetrics.dept_deptowner_vs_status.length > 0 ? (
                  (() => {
                    const deptData = controlsMetrics.dept_deptowner_vs_status;
                    const departments = Array.from(new Set(deptData.map((d) => d.department)));
                    const deptOwners = Array.from(new Set(deptData.map((d) => d.dept_owner)));
                    const statuses = Array.from(new Set(deptData.map((d) => d.status)));
                    
                    // Build table data grouped by department and dept_owner
                    const tableData = [];
                    departments.forEach((department) => {
                      deptOwners.forEach((deptOwner) => {
                        const row = { 
                          department, 
                          dept_owner: deptOwner, 
                          total: 0,
                          key: `${department}|||${deptOwner}`
                        };
                        statuses.forEach((status) => {
                          const item = deptData.find(
                            (d) => d.department === department && d.dept_owner === deptOwner && d.status === status
                          );
                          const count = item ? item.count : 0;
                          row[status] = count;
                          row.total += count;
                        });
                        // Only add row if it has at least one control
                        if (row.total > 0) {
                          tableData.push(row);
                        }
                      });
                    });
                    
                    // Calculate column totals
                    const columnTotals = {};
                    statuses.forEach((status) => {
                      columnTotals[status] = tableData.reduce((sum, row) => sum + (row[status] || 0), 0);
                    });
                    const grandTotal = tableData.reduce((sum, row) => sum + row.total, 0);
                    
                    return (
                      <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                        <table className="table table-bordered table-hover table-sm mb-0">
                          <thead className="table-light">
                            <tr>
                              <th 
                                className="fw-semibold" 
                                style={{ position: 'sticky', left: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}
                              >
                                Department
                              </th>
                              <th 
                                className="fw-semibold" 
                                style={{ position: 'sticky', left: 150, backgroundColor: '#f8f9fa', zIndex: 10 }}
                              >
                                Dept Owner
                              </th>
                              {statuses.map((status) => (
                                <th 
                                  key={status} 
                                  className="text-center fw-semibold"
                                >
                                  {status}
                                </th>
                              ))}
                              <th 
                                className="text-center fw-semibold bg-light"
                              >
                                Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {tableData.map((row, idx) => (
                              <tr key={row.key || idx}>
                                <td 
                                  className="fw-medium" 
                                  style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 5 }}
                                >
                                  {row.department}
                                </td>
                                <td 
                                  className="fw-medium" 
                                  style={{ position: 'sticky', left: 150, backgroundColor: 'white', zIndex: 5 }}
                                >
                                  {row.dept_owner}
                                </td>
                                {statuses.map((status) => (
                                  <td key={status} className="text-center">
                                    {row[status] || 0}
                                  </td>
                                ))}
                                <td className="text-center fw-semibold bg-light">{row.total}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="table-secondary">
                            <tr>
                              <td 
                                className="fw-bold" 
                                colSpan="2"
                                style={{ position: 'sticky', left: 0, backgroundColor: '#6c757d', color: 'white', zIndex: 10 }}
                              >
                                Total
                              </td>
                              {statuses.map((status) => (
                                <td key={status} className="text-center fw-bold">
                                  {columnTotals[status]}
                                </td>
                              ))}
                              <td className="text-center fw-bold">{grandTotal}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    );
                  })()
                ) : (
                  <p className="text-muted">No data available</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Task Metrics Section */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card shadow-sm">
              <div className="card-header bg-white">
                <h5 className="mb-0 fw-semibold d-flex align-items-center gap-2">
                  <CheckSquare size={20} color={COLORS.primary} />
                  Task Metrics
                </h5>
              </div>
              <div className="card-body">
                {taskLoading ? (
                  <p className="text-muted">Loading task metrics...</p>
                ) : (
                  <div className="row">
                    <div className="col-md-6 mb-4">
                      <h6 className="text-muted mb-3">Tasks vs Assignees (with Ageing)</h6>
                      {taskMetrics.tasks_vs_assignees_ageing.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart
                            data={(() => {
                              const assignees = Array.from(new Set(taskMetrics.tasks_vs_assignees_ageing.map((d) => d.assignee)));
                              const ageBuckets = ["0-30 days", "31-90 days", "91-180 days", "181-365 days", "365+ days", "Unknown"];
                              
                              return assignees.map((assignee) => {
                                const dataPoint = { 
                                  assignee,
                                  assigneeEmail: assignee,
                                  assigneeDisplay: getDisplayName(assignee)
                                };
                                ageBuckets.forEach((ageBucket) => {
                                  const item = taskMetrics.tasks_vs_assignees_ageing.find(
                                    (d) => d.assignee === assignee && d.age_bucket === ageBucket
                                  );
                                  dataPoint[ageBucket] = item ? item.count : 0;
                                });
                                return dataPoint;
                              });
                            })()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                            layout="vertical"
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis
                              dataKey="assigneeDisplay"
                              type="category"
                              width={100}
                              tick={{ fontSize: 10 }}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            {["0-30 days", "31-90 days", "91-180 days", "181-365 days", "365+ days", "Unknown"].map((ageBucket) => (
                              <Bar
                                key={ageBucket}
                                dataKey={ageBucket}
                                name={ageBucket}
                                stackId="age"
                                fill={
                                  ageBucket === "0-30 days"
                                    ? COLORS.success
                                    : ageBucket === "31-90 days"
                                    ? COLORS.info
                                    : ageBucket === "91-180 days"
                                    ? COLORS.warning
                                    : ageBucket === "181-365 days"
                                    ? COLORS.danger
                                    : ageBucket === "365+ days"
                                    ? "#991B1B"
                                    : COLORS.accent
                                }
                              />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-muted">No tasks vs assignees ageing data available</p>
                      )}
                    </div>
                    <div className="col-md-6 mb-4">
                      <h6 className="text-muted mb-3">Tasks vs Assignee vs Priority</h6>
                      {taskMetrics.tasks_vs_assignee_vs_priority.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                          <BarChart
                            data={(() => {
                              const assignees = Array.from(new Set(taskMetrics.tasks_vs_assignee_vs_priority.map((d) => d.assignee)));
                              const priorities = Array.from(new Set(taskMetrics.tasks_vs_assignee_vs_priority.map((d) => d.priority)));
                              
                              return assignees.map((assignee) => {
                                const dataPoint = { 
                                  assignee,
                                  assigneeEmail: assignee,
                                  assigneeDisplay: getDisplayName(assignee)
                                };
                                priorities.forEach((priority) => {
                                  const item = taskMetrics.tasks_vs_assignee_vs_priority.find(
                                    (d) => d.assignee === assignee && d.priority === priority
                                  );
                                  dataPoint[priority] = item ? item.count : 0;
                                });
                                return dataPoint;
                              });
                            })()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="assigneeDisplay"
                              angle={-45}
                              textAnchor="end"
                              height={100}
                              interval={0}
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '11px' }} />
                            {Array.from(new Set(taskMetrics.tasks_vs_assignee_vs_priority.map((d) => d.priority))).map(
                              (priority, pIdx) => (
                                <Bar
                                  key={priority}
                                  dataKey={priority}
                                  name={priority}
                                  fill={CHART_COLORS[pIdx % CHART_COLORS.length]}
                                />
                              )
                            )}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-muted">No tasks vs assignee vs priority data available</p>
                      )}
                    </div>
                    <div className="col-12 mb-4">
                      <h6 className="text-muted mb-3">Task Priority vs Ageing vs Assignee</h6>
                      {taskMetrics.priority_vs_ageing_vs_assignee.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart
                            data={(() => {
                              const priorities = Array.from(new Set(taskMetrics.priority_vs_ageing_vs_assignee.map((d) => d.priority)));
                              const ageBuckets = ["0-30 days", "31-90 days", "91-180 days", "181-365 days", "365+ days", "Unknown"];
                              const assignees = Array.from(new Set(taskMetrics.priority_vs_ageing_vs_assignee.map((d) => d.assignee)));
                              
                              // Group by priority and age bucket, then show assignees
                              return priorities.flatMap((priority) =>
                                ageBuckets.map((ageBucket) => {
                                  const dataPoint = { 
                                    key: `${priority}-${ageBucket}`,
                                    priority,
                                    ageBucket
                                  };
                                  assignees.forEach((assignee) => {
                                    const item = taskMetrics.priority_vs_ageing_vs_assignee.find(
                                      (d) => d.priority === priority && d.age_bucket === ageBucket && d.assignee === assignee
                                    );
                                    dataPoint[assignee] = item ? item.count : 0;
                                  });
                                  return dataPoint;
                                })
                              );
                            })()}
                            margin={{ top: 20, right: 30, left: 20, bottom: 100 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="key"
                              angle={-45}
                              textAnchor="end"
                              height={120}
                              interval={0}
                              tick={{ fontSize: 9 }}
                            />
                            <YAxis tick={{ fontSize: 10 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend 
                              wrapperStyle={{ fontSize: '10px' }}
                              formatter={(value) => {
                                // value is the assignee email, show display name
                                return getDisplayName(value);
                              }}
                            />
                            {(() => {
                              const assignees = Array.from(new Set(taskMetrics.priority_vs_ageing_vs_assignee.map((d) => d.assignee)));
                              const assigneeMap = {};
                              assignees.forEach((assignee) => {
                                assigneeMap[assignee] = getDisplayName(assignee);
                              });
                              return assignees.map((assignee, aIdx) => (
                                <Bar
                                  key={assignee}
                                  dataKey={assignee}
                                  name={assignee} // Keep email as name for data lookup, but display name in legend
                                  stackId="assignee"
                                  fill={CHART_COLORS[aIdx % CHART_COLORS.length]}
                                />
                              ));
                            })()}
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-muted">No priority vs ageing vs assignee data available</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
