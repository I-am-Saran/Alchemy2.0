// src/pages/UsersPage.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import DataTable from "react-data-table-component";
import { saveAs } from "file-saver";
import ExcelJS from "exceljs";
import { Card, CardBody, Typography } from "@material-tailwind/react";
import TopNav from "../components/TopNav";
import GlossyButton from "../components/GlossyButton";
import Toast from "../components/Toast";
import FormField from "../components/FormField";
import { useNavigate } from "react-router-dom";
import { post, get, put, del } from "../services/api";
import { usePermissions } from "../hooks/usePermissions";
import { useToast } from "../contexts/ToastContext";
import { useSession } from "../contexts/SessionContext";
import { Search, Plus, Eye, FileEdit, Trash, Key } from "lucide-react";
import { MODULE_ICONS } from "../constants/moduleIcons";
import { THEME_COLORS } from "../constants/colors";
import ModernModal from "../components/ModernModal";
import Loader from "../components/Loader";
import UserAutocomplete from "../components/UserAutocomplete";

export default function UsersPage() {
  const navigate = useNavigate();
  const { hasPermission, permissions, loading: permissionsLoading, userRoles } = usePermissions();
  const { showToast } = useToast();
  const { session, loading: sessionLoading } = useSession();

  // Check if user is super admin
  const isSuperAdmin = useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    return userRoles.some((userRole) => {
      const roleName = userRole?.roles?.role_name || userRole?.role_name || '';
      return roleName.toLowerCase() === 'super admin' || roleName.toLowerCase() === 'superadmin';
    });
  }, [userRoles]);

  // ============================
  // View Modes
  // ============================
  const [view, setView] = useState("list"); // list | create | invite

  // ============================
  // Shared States
  // ============================
  const [toast, setToast] = useState({ type: "", message: "" });

  // ============================
  // List View
  // ============================
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [perPage, setPerPage] = useState(() => {
    // Load from localStorage if available
    const saved = localStorage.getItem('usersPerPage');
    return saved ? Number(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [viewUser, setViewUser] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [passwordChangeUser, setPasswordChangeUser] = useState(null);

  // ============================
  // Fetch users from backend
  // ============================
  useEffect(() => {
    const loadUsers = async () => {
      // Wait for session to load, but don't require session to be present
      if (sessionLoading) return;
      
      try {
        setLoading(true);
        const json = await get(`/api/users`);
        
        if (json.error) {
          console.warn("/api/users fetch failed", json.error);
          showToast(`Failed to fetch users: ${json.error}`, 'error');
          setRows([]);
          return;
        }

        // Handle both response formats: {status: "success", data: [...]} or {data: [...]}
        const usersData = json?.data || (json?.status === "success" ? json.data : null);
        
        if (Array.isArray(usersData)) {
          const mapped = usersData.map((u) => ({
            id: u.id ?? u.sso_user_id ?? u.email,
            name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
            role: u.role ?? "Viewer",
            email: u.email ?? "",
            department: u.department ?? "",
            department_owner: u.department_owner ?? "",
            is_active: u.is_active ?? true,
          }));
          setRows(mapped);
        } else {
          console.warn("/api/users returned unexpected shape", json);
          setRows([]);
        }
      } catch (err) {
        console.error("Error fetching /api/users:", err);
        showToast(`Failed to fetch users: ${err.message}`, 'error');
        setRows([]);
      } finally {
        setLoading(false);
      }
    };

    loadUsers();
  }, [sessionLoading, showToast]);

  // ============================
  // Export functions
  // ============================
  const exportToCSV = () => {
    if (!filteredUsers.length) return alert("No data to export!");
    const headers = Object.keys(filteredUsers[0]);
    const rows = filteredUsers.map((r) => headers.map((h) => JSON.stringify(r[h] || "")));
    const blob = new Blob(
      [headers.join(",") + "\n" + rows.map((r) => r.join(",")).join("\n")],
      { type: "text/csv" }
    );
    saveAs(blob, "users.csv");
  };

  const exportToExcel = async () => {
    if (!filteredUsers.length) return alert("No data to export!");
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Users");
    
    // Add headers from first object keys
    if (filteredUsers.length > 0) {
      const headers = Object.keys(filteredUsers[0]);
      worksheet.addRow(headers);
      
      // Add data rows
      filteredUsers.forEach(row => {
        worksheet.addRow(headers.map(key => row[key]));
      });
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "users.xlsx");
  };

  // ============================
  // Filtered data
  // ============================
  const filteredUsers = useMemo(() => {
    let filtered = rows;

    // Apply search filter
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter((r) => {
        return (
          (r.name && r.name.toLowerCase().includes(searchLower)) ||
          (r.email && r.email.toLowerCase().includes(searchLower)) ||
          (r.role && r.role.toLowerCase().includes(searchLower)) ||
          (r.department && r.department.toLowerCase().includes(searchLower)) ||
          (r.department_owner && r.department_owner.toLowerCase().includes(searchLower))
        );
      });
    }

    // Apply role filter
    if (filterRole) {
      filtered = filtered.filter((r) => r.role === filterRole);
    }

    // Apply status filter
    if (filterStatus) {
      if (filterStatus === "Active") {
        filtered = filtered.filter((r) => r.is_active === true);
      } else if (filterStatus === "Inactive") {
        filtered = filtered.filter((r) => r.is_active === false);
      }
    }

    // Apply department filter
    if (filterDepartment) {
      filtered = filtered.filter((r) => {
        const userDept = r.department || "";
        // Match exact or case-insensitive
        return userDept === filterDepartment || 
               userDept.toLowerCase() === filterDepartment.toLowerCase();
      });
    }

    return filtered;
  }, [rows, searchText, filterRole, filterStatus, filterDepartment]);

  // Get unique values for filter dropdowns
  const uniqueRoles = useMemo(() => {
    const roles = new Set(rows.map((r) => r.role).filter(Boolean));
    return Array.from(roles).sort();
  }, [rows]);

  const uniqueDepartments = useMemo(() => {
    // Get unique department values, filtering out null, undefined, and empty strings
    const departments = new Set(
      rows
        .map((r) => r.department)
        .filter((dept) => dept && String(dept).trim() !== "")
    );
    return Array.from(departments).sort();
  }, [rows]);

  // ============================
  // Delete function
  // ============================
  const deleteUser = async (id) => {
    if (!hasPermission('users', 'delete')) {
      showToast('You do not have permission to delete users', 'error');
      setConfirmDeleteId(null);
      return;
    }
    
    try {
      const json = await del(`/api/users/${encodeURIComponent(id)}`);
      if (json.error) {
        if (json.error.includes('permission') || json.error.includes('403')) {
          showToast('You do not have permission to delete users', 'error');
        } else {
          throw new Error(json.error);
        }
      } else {
        showToast('User deleted successfully', 'success');
        // Reload data
        const reloadJson = await get(`/api/users`);
        if (reloadJson?.status === "success" && Array.isArray(reloadJson.data)) {
          const mapped = reloadJson.data.map((u) => ({
            id: u.id ?? u.sso_user_id ?? u.email,
            name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
            role: u.role ?? "Viewer",
            email: u.email ?? "",
            department: u.department ?? "",
            is_active: u.is_active ?? true,
          }));
          setRows(mapped);
        }
      }
    } catch (e) {
      if (e.message && (e.message.includes('permission') || e.message.includes('403'))) {
        showToast('You do not have permission to delete users', 'error');
      } else {
        showToast(`Failed to delete user: ${e.message}`, 'error');
      }
    } finally {
      setConfirmDeleteId(null);
    }
  };

  // ============================
  // View/Edit handlers
  // ============================
  const handleViewUser = async (row) => {
    if (!hasPermission('users', 'retrieve')) {
      showToast('You do not have permission to view users', 'error');
      return;
    }
    
    try {
      const json = await get(`/api/users/${encodeURIComponent(row.id)}`);
      if (!json.error && json.data) {
        setViewUser(json.data);
      } else {
        setViewUser(row);
      }
    } catch {
      setViewUser(row);
    }
  };

  const handleEditUser = (row) => {
    if (!hasPermission('users', 'update')) {
      showToast('You do not have permission to edit users', 'error');
      return;
    }
    setEditUser(row);
  };

  const handleChangePassword = (row) => {
    if (!isSuperAdmin) {
      showToast('Only Super Admin can change user passwords', 'error');
      return;
    }
    setPasswordChangeUser(row);
  };

  // ============================
  // Columns
  // ============================
  const columns = [
    {
      name: "Name",
      selector: (r) => r.name || "",
      sortable: true,
      cell: (r) => (
        <button
          onClick={() => handleViewUser(r)}
          className="text-purple-600 hover:underline font-medium"
        >
          {r.name}
        </button>
      ),
    },
    {
      name: "Email",
      selector: (r) => r.email || "",
      sortable: true,
    },
    {
      name: "Role",
      selector: (r) => r.role || "",
      sortable: true,
    },
    {
      name: "Department",
      selector: (r) => r.department || "",
      sortable: true,
    },
    {
      name: "Department Owner",
      selector: (r) => r.department_owner || "",
      sortable: true,
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
          {hasPermission('users', 'retrieve') && (
            <button
              onClick={() => handleViewUser(r)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.darkTeal }}
              title="View"
            >
              <Eye size={16} />
            </button>
          )}
          {hasPermission('users', 'update') && (
            <button
              onClick={() => handleEditUser(r)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.mediumTeal }}
              title="Edit"
            >
              <FileEdit size={16} />
            </button>
          )}
          {hasPermission('users', 'delete') && (
            <button
              onClick={() => setConfirmDeleteId(r.id)}
              className="btn btn-sm p-1"
              style={{ color: "#dc3545" }}
              title="Delete"
            >
              <Trash size={16} />
            </button>
          )}
          {isSuperAdmin && (
            <button
              onClick={() => handleChangePassword(r)}
              className="btn btn-sm p-1"
              style={{ color: THEME_COLORS.mediumTeal }}
              title="Change Password"
            >
              <Key size={16} />
            </button>
          )}
          <button
            onClick={() => navigate(`/users/${r.id}/roles`)}
            className="btn btn-sm p-1"
            style={{ color: THEME_COLORS.darkTeal }}
            title="Manage Roles"
          >
            <span className="text-xs">Roles</span>
          </button>
        </div>
      ),
      ignoreRowClick: true,
    },
  ];

  // ============================
  // Create View
  // ============================
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Viewer");
  const [department, setDepartment] = useState("");
  const [departmentOwner, setDepartmentOwner] = useState("");
  const [errors, setErrors] = useState({ email: "" });
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (view === "create") {
      setUsername("");
      setPassword("");
      setEmail("");
      setRole("Viewer");
      setDepartment("");
      setDepartmentOwner("");
      setErrors({ email: "" });
      setSubmitting(false);
    }
  }, [view]);

  const validateEmail = (val) => {
    if (!val) return "Mail ID is required.";
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(val)) return "Enter a valid email address.";
    return "";
  };

  const onCreateSubmit = async (e) => {
    e.preventDefault();
    const eErr = validateEmail(email);
    setErrors({ email: eErr });
    if (eErr) return;

    try {
      setSubmitting(true);
      const payload = { 
        username, 
        password, 
        email, 
        role, 
        department: department || null,
        department_owner: departmentOwner || null 
      };
      const json = await post(`/api/users`, payload);
      if (json.error) {
        throw new Error(json.error || json.detail || json.message || "Failed to create user");
      }
      showToast('User created successfully', 'success');
      setView("list");
      // Reload users
      const reloadJson = await get(`/api/users`);
      if (reloadJson?.status === "success" && Array.isArray(reloadJson.data)) {
        const mapped = reloadJson.data.map((u) => ({
          id: u.id ?? u.sso_user_id ?? u.email,
          name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
          role: u.role ?? "Viewer",
          email: u.email ?? "",
          department: u.department ?? "",
          department_owner: u.department_owner ?? "",
          is_active: u.is_active ?? true,
        }));
        setRows(mapped);
      }
    } catch (err) {
      showToast(err.message || "Failed to create user", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ============================
  // Invite View
  // ============================
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("Viewer");
  const [inviteEmail, setInviteEmail] = useState("");

  const onInviteSubmit = async (e) => {
    e.preventDefault();
    try {
      const json = await post(`/api/invite`, { name: inviteName, role: inviteRole, email: inviteEmail });
      if (json.error) {
        throw new Error(json.error || json.detail || json.message || "Failed to send invite");
      }
      showToast('Invitation sent successfully', 'success');
      setView("list");
      // Reload users
      const reloadJson = await get(`/api/users`);
      if (reloadJson?.status === "success" && Array.isArray(reloadJson.data)) {
        const mapped = reloadJson.data.map((u) => ({
          id: u.id ?? u.sso_user_id ?? u.email,
          name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
          role: u.role ?? "User",
          email: u.email ?? "",
          department: u.department ?? "",
          is_active: u.is_active ?? true,
        }));
        setRows(mapped);
      }
    } catch (err) {
      showToast(err.message || "Failed to send invite", 'error');
    }
  };

  // ============================
  // ChangePasswordDialog component
  // ============================
  const ChangePasswordDialog = ({ user, onClose, onSuccess }) => {
    const [password, setPassword] = useState("pass");
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!user || !user.id) {
        showToast('Invalid user data. Please refresh and try again.', 'error');
        return;
      }

      setSaving(true);
      try {
        const res = await put(`/api/users/${encodeURIComponent(user.id)}`, { password });
        if (res.error) throw new Error(res.error);
        showToast('Password changed successfully', 'success');
        onSuccess();
      } catch (err) {
        showToast(`Failed to change password: ${err.message}`, 'error');
      } finally {
        setSaving(false);
      }
    };

    return (
      <ModernModal
        open={!!user}
        onClose={onClose}
        title="Change Password"
        maxWidth="max-w-md"
      >
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User
              </label>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="font-semibold text-gray-900">{user?.name || user?.full_name || "—"}</div>
                <div className="text-sm text-gray-600">{user?.email || "—"}</div>
              </div>
            </div>
            <div>
              <FormField
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Default password is "pass". No password validation is applied.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-all shadow-sm hover:shadow-md"
              onClick={onClose}
            >
              Cancel
            </button>
            <GlossyButton type="submit" disabled={saving}>
              {saving ? "Changing..." : "Change Password"}
            </GlossyButton>
          </div>
        </form>
      </ModernModal>
    );
  };

  // ============================
  // EditUserForm component
  // ============================
  const EditUserForm = ({ user, onSave, onCancel }) => {
    const [editName, setEditName] = useState(user?.name || user?.full_name || "");
    const [editEmail, setEditEmail] = useState(user?.email || "");
    const [editRole, setEditRole] = useState(user?.role || "Viewer");
    const [editDepartment, setEditDepartment] = useState(user?.department || "");
    const [editDepartmentOwner, setEditDepartmentOwner] = useState(user?.department_owner || "");
    const [editIsActive, setEditIsActive] = useState(user?.is_active !== false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});

    const validateEmail = (val) => {
      if (!val) return "Email is required.";
      const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!re.test(val)) return "Enter a valid email address.";
      return "";
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      const eErr = validateEmail(editEmail);
      setErrors({ email: eErr });
      if (eErr) return;

      setSaving(true);
      try {
        await onSave({
          name: editName,
          full_name: editName,
          email: editEmail,
          role: editRole,
          department: editDepartment,
          department_owner: editDepartmentOwner || null,
          is_active: editIsActive,
        });
      } catch (err) {
        // Error handling is done in parent
      } finally {
        setSaving(false);
      }
    };

    return (
      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="md:col-span-1">
            <FormField
              label="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div className="md:col-span-1">
            <FormField
              label="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
            />
            {errors.email && (
              <p className="text-sm text-red-600 mt-1">{errors.email}</p>
            )}
          </div>
          <div className="md:col-span-1">
            <FormField
              label="Role"
              type="select"
              value={editRole}
              onChange={(v) => setEditRole(v)}
              options={[
                { label: "Viewer", value: "Viewer" },
                { label: "Contributor", value: "Contributor" },
                { label: "Admin", value: "Admin" },
                { label: "Super Admin", value: "Super Admin" },
              ]}
            />
          </div>
          <div className="md:col-span-1">
            <FormField
              label="Department"
              type="select"
              value={editDepartment}
              onChange={(v) => setEditDepartment(v)}
              options={[
                { label: "Infra", value: "Infra" },
                { label: "Compliance", value: "Compliance" },
                { label: "Devops", value: "Devops" },
                { label: "Technology", value: "Technology" },
                { label: "Security", value: "Security" },
                { label: "HR", value: "HR" },
                { label: "Finance", value: "Finance" },
                { label: "QA", value: "QA" },
                { label: "Development", value: "Development" },
              ]}
            />
          </div>
          <div className="md:col-span-1 lg:col-span-2">
            <UserAutocomplete
              label="Department Owner"
              value={editDepartmentOwner}
              onChange={setEditDepartmentOwner}
              placeholder="Search by email..."
              fieldType="assignee"
            />
          </div>
          <div className="md:col-span-1">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsActive}
                  onChange={(e) => setEditIsActive(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 text-violet-600 focus:ring-violet-500 focus:ring-2"
                />
                <span className="text-gray-700 font-medium">
                  {editIsActive ? "✓ Active User" : "✗ Inactive User"}
                </span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            className="px-6 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium transition-all shadow-sm hover:shadow-md"
            onClick={onCancel}
          >
            Cancel
          </button>
          <GlossyButton type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </GlossyButton>
        </div>
      </form>
    );
  };

  // ============================
  // Render Views
  // ============================
  if (sessionLoading || (loading && view === "list")) {
    return <Loader message="Loading users..." />;
  }

  const renderList = () => (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {React.createElement(MODULE_ICONS.users, { className: "w-6 h-6 text-gray-800" })}
          <h1 className="text-2xl font-semibold text-gray-800">
            Users
          </h1>
        </div>
        <div className="flex gap-2">
          {hasPermission('users', 'create') && (
            <button
              onClick={() => setView("create")}
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
              <Plus size={18} /> <span>Create User</span>
            </button>
          )}
          <button
            onClick={() => setView("invite")}
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
            <Plus size={18} /> <span>Invite User</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
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
            placeholder="Search users..."
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

        {/* Second Row: Filter Dropdowns */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          width: "100%"
        }}>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            style={{
              minWidth: "150px",
              padding: "0.5rem 0.75rem",
              border: `1px solid ${THEME_COLORS.lightBlue}`,
              borderRadius: "0.5rem",
              height: "38px",
              boxSizing: "border-box"
            }}
          >
            <option value="">All Roles</option>
            {uniqueRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
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

          {/* Clear Filters Button */}
          {(filterRole || filterStatus || filterDepartment || searchText) && (
            <button
              onClick={() => {
                setFilterRole("");
                setFilterStatus("");
                setFilterDepartment("");
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
      </div>

      {/* Export Buttons and Per Page Selector */}
      <div 
        className="flex justify-end mb-3 gap-2"
        style={{
          background: "#ffffff",
          paddingTop: "0.75rem",
          paddingBottom: "0.75rem",
          marginTop: "0.5rem",
          marginBottom: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          flexShrink: 0
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.875rem", color: "#374151", fontWeight: "500" }}>
            Records per page:
          </label>
          <select
            value={perPage}
            onChange={(e) => {
              const newPerPage = Number(e.target.value);
              setPerPage(newPerPage);
              setCurrentPage(1); // Reset to page 1 when changing records per page
              // Save to localStorage
              localStorage.setItem('usersPerPage', newPerPage.toString());
            }}
            style={{
              padding: "0.375rem 0.75rem",
              border: `1px solid ${THEME_COLORS.lightBlue}`,
              borderRadius: "0.375rem",
              fontSize: "0.875rem",
              background: "#ffffff",
              cursor: "pointer",
              minWidth: "80px",
              zIndex: 100
            }}
          >
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>
        </div>
      </div>

      <DataTable
        key={`table-${perPage}`}
        columns={columns}
        data={filteredUsers}
        pagination
        paginationPerPage={perPage}
        paginationDefaultPage={currentPage}
        paginationRowsPerPageOptions={[20, 50, 100, 200, 500]}
        onChangeRowsPerPage={(currentRowsPerPage, currentPage) => {
          setPerPage(currentRowsPerPage);
          setCurrentPage(1); // Reset to page 1
          localStorage.setItem('usersPerPage', currentRowsPerPage.toString());
        }}
        onChangePage={(page, totalRows) => {
          setCurrentPage(page);
        }}
        highlightOnHover
        striped
        dense
        responsive
        sortIcon={<span>⇅</span>}
      />

      {/* View Modal */}
      {viewUser && (
        <ModernModal
          open={!!viewUser}
          onClose={() => setViewUser(null)}
          title="User Details"
          maxWidth="max-w-7xl"
          footer={
            <div className="flex justify-end gap-3">
              {hasPermission('users', 'update') && (
                <button
                  className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-medium transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                  onClick={() => {
                    handleEditUser(viewUser);
                    setViewUser(null);
                  }}
                >
                  Edit User
                </button>
              )}
              <button
                className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => setViewUser(null)}
              >
                Close
              </button>
            </div>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 text-gray-800 py-2">
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">ID</div>
              <div className="font-semibold text-gray-900 break-all">{viewUser.id || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Name</div>
              <div className="font-semibold text-gray-900">{viewUser.name || viewUser.full_name || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">Email</div>
              <div className="font-semibold text-gray-900 break-all">{viewUser.email || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-4 rounded-lg border border-orange-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-2">Role</div>
              <div className="font-semibold text-gray-900">{viewUser.role || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-4 rounded-lg border border-teal-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-teal-700 uppercase tracking-wide mb-2">Department</div>
              <div className="font-semibold text-gray-900">{viewUser.department || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 p-4 rounded-lg border border-violet-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-violet-700 uppercase tracking-wide mb-2">Department Owner</div>
              <div className="font-semibold text-gray-900 break-all">{viewUser.department_owner || "—"}</div>
            </div>
            <div className={`p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow ${viewUser.is_active ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-100' : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-100'}`}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-2 ${viewUser.is_active ? 'text-green-700' : 'text-red-700'}`}>Status</div>
              <div className={`font-semibold ${viewUser.is_active ? 'text-green-900' : 'text-red-900'}`}>
                {viewUser.is_active ? "✓ Active" : "✗ Inactive"}
              </div>
            </div>
            <div className="bg-gradient-to-br from-gray-50 to-slate-50 p-4 rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">SSO Provider</div>
              <div className="font-semibold text-gray-900">{viewUser.sso_provider || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-4 rounded-lg border border-indigo-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">SSO User ID</div>
              <div className="font-semibold text-gray-900 break-all text-sm">{viewUser.sso_user_id || "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-amber-50 p-4 rounded-lg border border-yellow-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">First Login</div>
              <div className="font-semibold text-gray-900 text-sm">
                {viewUser.first_login ? String(viewUser.first_login).replace("T", " ").substring(0, 19) : "—"}
              </div>
            </div>
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 p-4 rounded-lg border border-rose-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-rose-700 uppercase tracking-wide mb-2">Last Login</div>
              <div className="font-semibold text-gray-900 text-sm">
                {viewUser.last_login ? String(viewUser.last_login).replace("T", " ").substring(0, 19) : "—"}
              </div>
            </div>
            <div className="bg-gradient-to-br from-cyan-50 to-blue-50 p-4 rounded-lg border border-cyan-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-cyan-700 uppercase tracking-wide mb-2">Login Count</div>
              <div className="font-semibold text-gray-900">{viewUser.login_count ?? "—"}</div>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2">Profile Picture URL</div>
              <div className="font-semibold text-gray-900 text-sm">
                {viewUser.profile_pic_url ? (
                  <a href={viewUser.profile_pic_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline break-all">
                    {viewUser.profile_pic_url}
                  </a>
                ) : "—"}
              </div>
            </div>
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 p-4 rounded-lg border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Default Role ID</div>
              <div className="font-semibold text-gray-900 break-all text-sm">{viewUser.default_role_id || "—"}</div>
            </div>
            {viewUser.created_at && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">Created At</div>
                <div className="font-semibold text-gray-900 text-sm">{String(viewUser.created_at).replace("T", " ").substring(0, 19)}</div>
              </div>
            )}
            {viewUser.updated_at && (
              <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-4 rounded-lg border border-purple-100 shadow-sm hover:shadow-md transition-shadow">
                <div className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Updated At</div>
                <div className="font-semibold text-gray-900 text-sm">{String(viewUser.updated_at).replace("T", " ").substring(0, 19)}</div>
              </div>
            )}
          </div>
        </ModernModal>
      )}

      {/* Edit Modal */}
      {editUser && (
        <ModernModal
          open={!!editUser}
          onClose={() => setEditUser(null)}
          title="Edit User"
          maxWidth="max-w-6xl"
        >
          <EditUserForm
            user={editUser}
            onSave={async (updatedData) => {
              if (!hasPermission('users', 'update')) {
                showToast('You do not have permission to update users', 'error');
                return;
              }
              
              if (!editUser || !editUser.id) {
                showToast('Invalid user data. Please refresh and try again.', 'error');
                return;
              }
              
              try {
                // Filter out null/empty values for optional fields
                const cleanedData = { ...updatedData };
                if (!cleanedData.department_owner) {
                  cleanedData.department_owner = null;
                }
                if (!cleanedData.department) {
                  cleanedData.department = null;
                }
                
                const res = await put(`/api/users/${encodeURIComponent(editUser.id)}`, cleanedData);
                if (res.error) throw new Error(res.error);
                showToast('User updated successfully', 'success');
                setEditUser(null);
                // Reload users
                const json = await get(`/api/users`);
                if (json?.status === "success" && Array.isArray(json.data)) {
                  const mapped = json.data.map((u) => ({
                    id: u.id ?? u.sso_user_id ?? u.email,
                    name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
                    role: u.role ?? "Viewer",
                    email: u.email ?? "",
                    department: u.department ?? "",
                    is_active: u.is_active ?? true,
                  }));
                  setRows(mapped);
                }
              } catch (err) {
                showToast(`Failed to update user: ${err.message}`, 'error');
              }
            }}
            onCancel={() => setEditUser(null)}
          />
        </ModernModal>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId !== null && (
        <ModernModal
          open={confirmDeleteId !== null}
          onClose={() => setConfirmDeleteId(null)}
          title="Confirm Delete"
          maxWidth="max-w-md"
          footer={
            <div className="flex justify-end gap-2">
              <button
                className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
                onClick={() => deleteUser(confirmDeleteId)}
              >
                Delete
              </button>
            </div>
          }
        >
          <p className="text-gray-700">
            Are you sure you want to delete this user? This action cannot be undone.
          </p>
        </ModernModal>
      )}

      {/* Change Password Modal */}
      {passwordChangeUser && (
        <ChangePasswordDialog
          user={passwordChangeUser}
          onClose={() => setPasswordChangeUser(null)}
          onSuccess={async () => {
            setPasswordChangeUser(null);
            // Reload users
            const reloadJson = await get(`/api/users`);
            if (reloadJson?.status === "success" && Array.isArray(reloadJson.data)) {
              const mapped = reloadJson.data.map((u) => ({
                id: u.id ?? u.sso_user_id ?? u.email,
                name: u.name ?? u.full_name ?? (u.email ? u.email.split("@")[0] : ""),
                role: u.role ?? "Viewer",
                email: u.email ?? "",
                department: u.department ?? "",
                is_active: u.is_active ?? true,
              }));
              setRows(mapped);
            }
          }}
        />
      )}
    </div>
  );

  const renderCreate = () => (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Card className="glass-panel">
        <CardBody>
          <div className="mb-4 flex items-center justify-between">
            <Typography variant="h6" className="text-gray-900">User Creation</Typography>
            <button onClick={() => setView("list")} className="text-emerald-700 text-sm hover:underline font-medium">Back to Users</button>
          </div>
          <Toast type={toast.type} message={toast.message} />
          <form className="grid gap-4" onSubmit={onCreateSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
              <FormField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <div>
                <FormField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                {errors.email && (
                  <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                )}
              </div>
              <FormField label="Role" type="select" value={role} onChange={(v) => setRole(v)} options={[
                { label: "Viewer", value: "Viewer" },
                { label: "Contributor", value: "Contributor" },
                { label: "Admin", value: "Admin" },
                { label: "Super Admin", value: "Super Admin" },
              ]} />
              <FormField label="Department" type="select" value={department} onChange={(v) => setDepartment(v)} options={[
                { label: "Select the department", value: "" },
                { label: "Infra", value: "Infra" },
                { label: "Compliance", value: "Compliance" },
                { label: "Devops", value: "Devops" },
                { label: "Technology", value: "Technology" },
                { label: "Security", value: "Security" },
                { label: "HR", value: "HR" },
                { label: "Finance", value: "Finance" },
                { label: "QA", value: "QA" },
                { label: "Development", value: "Development" },
              ]} />
              <div>
                <UserAutocomplete
                  label="Department Owner"
                  value={departmentOwner}
                  onChange={setDepartmentOwner}
                  placeholder="Search by email..."
                  fieldType="assignee"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <GlossyButton type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create"}
              </GlossyButton>
              <GlossyButton type="button" variant="text" onClick={() => setView("list")}>Cancel</GlossyButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  const renderInvite = () => (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <Card className="glass-panel">
        <CardBody>
          <Typography variant="h6" className="mb-4 text-emerald-700 font-semibold">Invite User</Typography>
          <form className="grid gap-4" onSubmit={onInviteSubmit}>
            <FormField label="Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            <FormField label="Role" type="select" value={inviteRole} onChange={(v) => setInviteRole(v)} options={[
              { label: "Viewer", value: "Viewer" },
              { label: "Contributor", value: "Contributor" },
              { label: "Admin", value: "Admin" },
              { label: "Super Admin", value: "Super Admin" },
            ]} />
            <FormField label="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            <div className="flex items-center gap-3">
              <GlossyButton type="submit">Send Invite</GlossyButton>
              <GlossyButton variant="text" className="bg-transparent text-gray-700 hover:text-emerald-700" onClick={() => setView("list")}>Cancel</GlossyButton>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen">
      <TopNav />
      {view === "list" && renderList()}
      {view === "create" && renderCreate()}
      {view === "invite" && renderInvite()}
    </div>
  );
}
