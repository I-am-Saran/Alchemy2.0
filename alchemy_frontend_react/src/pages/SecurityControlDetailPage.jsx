import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Eye, FileEdit, Trash } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, post, put, del } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import UserAutocomplete from "../components/UserAutocomplete";
import Loader from "../components/Loader";
import ActionViewDialog from "../components/ActionViewDialog";
import ActionEditDialog from "../components/ActionEditDialog";
import TaskEditModal from "../components/TaskEditModal";

export default function SecurityControlDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, hasRole, loading: permissionsLoading } = usePermissions();
  
  // Check if user has privileged roles that can see all status options
  // Super Admin, Admin, Internal Auditor, and External Auditor can see all statuses
  const canSeeAllStatuses = hasRole('Super Admin') || hasRole('Admin') || 
                            hasRole('Internal Auditor') || hasRole('External Auditor');
  // Local state for structured comments and tasks
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [editingCommentIndex, setEditingCommentIndex] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  // @mention suggestions states
  const [commentSuggestions, setCommentSuggestions] = useState([]);
  const [showCommentSuggestions, setShowCommentSuggestions] = useState(false);
  const [editSuggestions, setEditSuggestions] = useState([]);
  const [showEditSuggestions, setShowEditSuggestions] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [confirmDeleteCommentIndex, setConfirmDeleteCommentIndex] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  // Actions state
  const [actions, setActions] = useState([]);
  const [viewingAction, setViewingAction] = useState(null);
  const [editingAction, setEditingAction] = useState(null);

  useEffect(() => {
    const fetchControl = async () => {
      if (!session) return;
      try {
        const json = await get(`/api/security-controls/${id}`);
        if (json.error) throw new Error(json.error);
        setControl(json.data);
        // Initialize comments from record
        const parseArrayField = (val) => {
          if (!val) return [];
          try {
            const parsed = typeof val === "string" ? JSON.parse(val) : val;
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            // Fallback: treat plain text as a single-item array
            return typeof val === "string" && val.trim()
              ? [{ text: val.trim(), time: "", author: "" }]
              : [];
          }
        };
        setComments(parseArrayField(json.data?.Comments));
      } catch (err) {
        showToast(`Failed to load record: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading) {
      if (!session) {
        // 🛡️ No session: stop loading and redirect
        setLoading(false);
        navigate("/login", { replace: true });
        return;
      }
      fetchControl();
    }
  }, [id, session, sessionLoading, navigate]);

  // Load tasks for this control via Tasks API
  useEffect(() => {
    const loadTasks = async () => {
      if (!session) return;
      try {
        const json = await get(`/api/tasks/control/${encodeURIComponent(id)}`);
        if (json.error) throw new Error(json.error);
        setTasks(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error("Load tasks failed", e);
        setTasks([]);
      }
    };
    if (!sessionLoading) loadTasks();
  }, [id, sessionLoading, session, location.pathname]);

  // Load actions for this control
  useEffect(() => {
    const loadActions = async () => {
      if (!session) return;
      try {
        const json = await get(`/api/actions?control_id=${encodeURIComponent(id)}&tenant_id=00000000-0000-0000-0000-000000000001`);
        if (json.error) throw new Error(json.error);
        setActions(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error("Load actions failed", e);
        setActions([]);
      }
    };
    if (!sessionLoading) loadActions();
  }, [id, sessionLoading, session]);

  const handleChange = (field, value) => {
    setControl((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const today = new Date();
      // Format as ISO date (YYYY-MM-DD) for PostgreSQL TIMESTAMP WITH TIME ZONE
      const formattedToday = `${today.getFullYear()}-${String(
        today.getMonth() + 1
      ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // Serialize structured fields into a clean payload
      const payload = {
        ...control,
        id,
        Review_Date: formattedToday,
        Comments: JSON.stringify(comments ?? []),
        task: JSON.stringify(tasks ?? []),
      };
      // Remove any legacy keys that could break backend
      delete payload["Comments_1"]; delete payload["Comments2"]; delete payload["Comments 2"]; 
      // Drop fields that do not exist in DB schema (typoed column exists with space)
      delete payload["responsible_team"]; // DB likely uses "Reponsible Team"
      const json = await post(`/api/security-controls`, payload);
      if (json.error) {
        // Handle error object - extract detail if it's an object
        const errorMsg = typeof json.error === 'object' && json.error.detail 
          ? json.error.detail 
          : (typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
        throw new Error(errorMsg);
      }
      showToast('Record saved successfully', 'success');
      // Build query string with filters from URL to preserve them when navigating back
      const queryParams = new URLSearchParams();
      if (searchParams.get('priority')) queryParams.set('priority', searchParams.get('priority'));
      if (searchParams.get('status')) queryParams.set('status', searchParams.get('status'));
      if (searchParams.get('domain')) queryParams.set('domain', searchParams.get('domain'));
      if (searchParams.get('assignee')) queryParams.set('assignee', searchParams.get('assignee'));
      if (searchParams.get('certification')) queryParams.set('certification', searchParams.get('certification'));
      if (searchParams.get('search')) queryParams.set('search', searchParams.get('search'));
      
      const queryString = queryParams.toString();
      const url = queryString 
        ? `/security-controls?${queryString}`
        : '/security-controls';
      
      navigate(url);
    } catch (err) {
      // Extract error message properly from API response
      let errorMsg = err.message || 'Unknown error occurred';
      if (err.body) {
        if (typeof err.body === 'object') {
          errorMsg = err.body.detail || err.body.message || err.body.error || JSON.stringify(err.body);
        } else if (typeof err.body === 'string') {
          errorMsg = err.body;
        }
      }
      showToast(`Save failed: ${errorMsg}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Immediate persistence helpers for comments/tasks
  const persistComments = async (nextArr) => {
    try {
      const json = await post(`/api/security-controls/${id}/comments`, {
        comment: Array.isArray(nextArr) ? nextArr : [],
      });
      return !json.error;
    } catch (e) {
      console.error("Persist comments error", e);
      return false;
    }
  };

  // Inline task persistence removed; tasks now managed via dedicated Tasks module

  // Helpers for @mention tokens and suggestions
  const getActiveMention = (text) => {
    const atIdx = text.lastIndexOf("@");
    if (atIdx === -1) return null;
    const after = text.slice(atIdx + 1);
    if (!after) return null;
    const stop = after.search(/[\s.,;:!?]/);
    const token = stop === -1 ? after : after.slice(0, stop);
    if (!token || !/^[a-zA-Z0-9._-]+$/.test(token)) return null;
    return { start: atIdx, token };
  };

  const replaceMention = (text, token, email) => {
    const atIdx = text.lastIndexOf("@");
    if (atIdx === -1) return text;
    const after = text.slice(atIdx + 1);
    const stop = after.search(/[\s.,;:!?]/);
    const tail = stop === -1 ? "" : after.slice(stop);
    return text.slice(0, atIdx) + "@" + email + tail;
  };

  const fetchUserSuggestions = async (token, setter) => {
    try {
      const json = await get(`/api/users/search?q=${encodeURIComponent(token)}`);
      if (!json.error) setter(Array.isArray(json.data) ? json.data : []);
      else setter([]);
    } catch {
      setter([]);
    }
  };

  if (sessionLoading || loading) {
    return <Loader message="Loading security control details..." />;
  }

  if (!control)
    return (
      <div className="p-6 text-red-600">
        Record not found. <button onClick={() => navigate(-1)}>⬅ Back</button>
      </div>
    );

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center border-b pb-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">
            Security Control Details
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ID: <span className="font-semibold" style={{ color: THEME_COLORS.darkTeal }}>{id}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => {
              // Build query string with filters from URL to preserve them when navigating back
              const queryParams = new URLSearchParams();
              if (searchParams.get('priority')) queryParams.set('priority', searchParams.get('priority'));
              if (searchParams.get('status')) queryParams.set('status', searchParams.get('status'));
              if (searchParams.get('domain')) queryParams.set('domain', searchParams.get('domain'));
              if (searchParams.get('assignee')) queryParams.set('assignee', searchParams.get('assignee'));
              if (searchParams.get('certification')) queryParams.set('certification', searchParams.get('certification'));
              if (searchParams.get('search')) queryParams.set('search', searchParams.get('search'));
              
              const queryString = queryParams.toString();
              const url = queryString 
                ? `/security-controls?${queryString}`
                : '/security-controls';
              
              navigate(url);
            }}
            className="px-4 py-2 rounded-lg transition-all font-medium flex items-center gap-2"
            style={{
              background: THEME_COLORS.whiteSmoke,
              color: THEME_COLORS.darkTeal,
              border: `1px solid ${THEME_COLORS.lightBlue}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME_COLORS.lightBlue;
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = THEME_COLORS.whiteSmoke;
              e.currentTarget.style.color = THEME_COLORS.darkTeal;
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2"
            style={{
              background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
              opacity: saving ? 0.6 : 1,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
              }
            }}
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Content Card */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-700 border-b pb-2">
          Control Information
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* S.No */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              S.No
            </label>
            <input
              type="text"
              value={control.sno || ""}
              onChange={(e) => handleChange("sno", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* ID */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              ID
            </label>
            <input
              type="text"
              value={control.id || ""}
              onChange={(e) => handleChange("id", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Owner */}
          <UserAutocomplete
            label="Owner"
            value={control.owner || ""}
            onChange={(value) => handleChange("owner", value)}
            placeholder="Search by email..."
            fieldType="assignee"
          />

          {/* Audit Owner */}
          <UserAutocomplete
            label="Audit Owner"
            value={control.audit_owner || ""}
            onChange={(value) => handleChange("audit_owner", value)}
            placeholder="Search by email..."
            fieldType="assignee"
          />

          {/* Domain */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Control Domain
            </label>
            <input
              type="text"
              value={control.control_domain || ""}
              onChange={(e) => handleChange("control_domain", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Priority</label>
            <select
              value={control.Priority || ""}
              onChange={(e) => handleChange("Priority", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Status</label>
            <select
              value={control.Status || ""}
              onChange={(e) => handleChange("Status", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            >
              {canSeeAllStatuses ? (
                <>
                  <option value="Implemented">Implemented</option>
                  <option value="Partially Implemented">Partially Implemented</option>
                  <option value="Not Implemented">Not Implemented</option>
                  <option value="Need clarity">Need clarity</option>
                  <option value="Ready for review">Ready for review</option>
                  <option value="Non compliant">Non compliant</option>
                </>
              ) : (
                <>
                  <option value="Not Implemented">Not Implemented</option>
                  <option value="Need clarity">Need clarity</option>
                  <option value="Ready for review">Ready for review</option>
                  <option value="Non compliant">Non compliant</option>
                </>
              )}
            </select>
          </div>

          {/* Review Date */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Last Review Date
            </label>
            <input
              type="text"
              value={control.Review_Date || ""}
              onChange={(e) => handleChange("Review_Date", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              readOnly
            />
          </div>

          {/* Evidence */}
          {/* <div>
            <label className="block text-gray-700 font-medium mb-1">Evidence</label>
            <input
              type="text"
              value={control.Evidence || ""}
              onChange={(e) => handleChange("Evidence", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div> */}

          {/* Responsible Team */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Responsible Team</label>
            <input
              type="text"
              value={control.responsible_team || control.reponsible_team || ""}
              onChange={(e) => handleChange("responsible_team", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Requirement */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Requirement</label>
            <input
              type="text"
              value={control.requirement || ""}
              onChange={(e) => handleChange("requirement", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* ISO 27001 */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">ISO 27001</label>
            <input
              type="text"
              value={control.ISO_27001 || ""}
              onChange={(e) => handleChange("ISO_27001", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* NIST CSF */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">NIST CSF</label>
            <input
              type="text"
              value={control.NIST_CSF || ""}
              onChange={(e) => handleChange("NIST_CSF", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* SOC 2 */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">SOC 2</label>
            <input
              type="text"
              value={control.SOC_2 || ""}
              onChange={(e) => handleChange("SOC_2", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* GDPR */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">GDPR</label>
            <input
              type="text"
              value={control.GDPR || ""}
              onChange={(e) => handleChange("GDPR", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* IT Act 2000 */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">IT Act 2000</label>
            <input
              type="text"
              value={control.IT_Act_2000 || ""}
              onChange={(e) => handleChange("IT_Act_2000", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* PCI DSS */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">PCI DSS</label>
            <input
              type="text"
              value={control.PCI_DSS || ""}
              onChange={(e) => handleChange("PCI_DSS", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* HIPAA */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">HIPAA</label>
            <input
              type="text"
              value={control.HIPAA || ""}
              onChange={(e) => handleChange("HIPAA", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Audit Review Status */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Audit Review Status</label>
            <input
              type="text"
              value={control.Audit_Review_Status || ""}
              onChange={(e) => handleChange("Audit_Review_Status", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Date</label>
            <input
              type="text"
              value={control.Date || ""}
              onChange={(e) => handleChange("Date", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Evidence */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Evidence</label>
            <input
              type="text"
              value={control.evidence || ""}
              onChange={(e) => handleChange("evidence", e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-gray-700 font-medium mb-1">Description</label>
          <textarea
            value={control.description || control.Description || ""}
            onChange={(e) => handleChange("description", e.target.value)}
            rows="5"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Analyze Comments */}
        <div>
          <label className="block text-gray-700 font-medium mb-1">Analyze Comments</label>
          <textarea
            value={control.analyze_comments || ""}
            onChange={(e) => handleChange("analyze_comments", e.target.value)}
            rows="3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Observations / Action Item */}
        <div>
          <label className="block text-gray-700 font-medium mb-1">Observations / Action Item</label>
          <textarea
            value={control.observations_action_item || ""}
            onChange={(e) => handleChange("observations_action_item", e.target.value)}
            rows="3"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>

        {/* Plan / Do / Check / Act */}
        <div className="grid grid-cols-1 gap-5">
          <div>
            <label className="block text-gray-700 font-medium mb-1">Plan</label>
            <textarea
              value={control.Plan || ""}
              onChange={(e) => handleChange("Plan", e.target.value)}
              rows="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Do</label>
            <textarea
              value={control.Do || ""}
              onChange={(e) => handleChange("Do", e.target.value)}
              rows="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Check</label>
            <textarea
              value={control.Check || ""}
              onChange={(e) => handleChange("Check", e.target.value)}
              rows="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-gray-700 font-medium mb-1">Act</label>
            <textarea
              value={control.Act || ""}
              onChange={(e) => handleChange("Act", e.target.value)}
              rows="10"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
        </div>

        {/* Actions Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-700">Actions</h3>
            {!permissionsLoading && hasPermission('actions', 'create') && (
              <button
                type="button"
                className="px-3 py-2 rounded-lg text-white transition-all shadow-sm hover:shadow-md"
                style={{
                  background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                }}
                onClick={() => setEditingAction({})}
              >
                ➕ Add Action
              </button>
            )}
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-700">Action Name</th>
                  <th className="text-left px-3 py-2 text-gray-700">Priority</th>
                  <th className="text-left px-3 py-2 text-gray-700">Status</th>
                  <th className="text-left px-3 py-2 text-gray-700">Type</th>
                  <th className="text-left px-3 py-2 text-gray-700">Assigned To</th>
                  <th className="text-left px-3 py-2 text-gray-700">Due Date</th>
                  <th className="text-left px-3 py-2 text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-gray-500" colSpan={7}>No actions for this control.</td>
                  </tr>
                )}
                {actions.map((action) => (
                  <tr key={action.id} className="border-t">
                    <td className="px-3 py-2">{action.action_name}</td>
                    <td className="px-3 py-2">{action.action_priority || "—"}</td>
                    <td className="px-3 py-2">{action.action_status || "—"}</td>
                    <td className="px-3 py-2">{action.action_type || "—"}</td>
                    <td className="px-3 py-2">{action.assigned_to || "—"}</td>
                    <td className="px-3 py-2">
                      {action.due_date ? new Date(action.due_date).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {!permissionsLoading && hasPermission('actions', 'retrieve') && (
                          <button
                            className="p-2 rounded text-white transition-all"
                            style={{
                              background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.mediumTeal})`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.mediumTeal})`;
                            }}
                            onClick={() => setViewingAction(action)}
                            title="View"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye" aria-hidden="true">
                              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                          </button>
                        )}
                        {!permissionsLoading && hasPermission('actions', 'update') && (
                          <button
                            className="p-2 rounded text-white transition-all"
                            style={{
                              background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                            }}
                            onClick={() => setEditingAction(action)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                        )}
                        {!permissionsLoading && hasPermission('actions', 'delete') && (
                          <button
                            className="p-2 rounded text-white transition-all"
                            style={{
                              background: `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.vanDykeBrown})`;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
                            }}
                            onClick={async () => {
                              if (window.confirm("Are you sure you want to delete this action?")) {
                                try {
                                  const json = await del(`/api/actions/${action.id}?tenant_id=00000000-0000-0000-0000-000000000001`);
                                  if (json.error) throw new Error(json.error);
                                  // Reload actions
                                  const reload = await get(`/api/actions?control_id=${encodeURIComponent(id)}&tenant_id=00000000-0000-0000-0000-000000000001`);
                                  setActions(Array.isArray(reload.data) ? reload.data : []);
                                  showToast("Action deleted successfully", "success");
                                } catch (e) {
                                  showToast(`Failed to delete action: ${e.message}`, 'error');
                                }
                              }
                            }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tasks Section: external Tasks module integration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-md font-semibold text-gray-700">Tasks</h3>
            <button
              type="button"
              className="px-3 py-2 rounded-lg text-white transition-all shadow-sm hover:shadow-md"
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
              }}
              onClick={() => navigate(`/tasks/add?control_id=${encodeURIComponent(id)}`)}
            >
              ➕ Add Task
            </button>
          </div>
          <div className="overflow-x-auto border rounded-lg" style={{ overflowX: 'auto' }}>
            <table className="min-w-full" style={{ minWidth: 'max-content' }}>
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-700">Task Name</th>
                  <th className="text-left px-3 py-2 text-gray-700">Priority</th>
                  <th className="text-left px-3 py-2 text-gray-700">Type</th>
                  <th className="text-left px-3 py-2 text-gray-700">Control Stage</th>
                  <th className="text-left px-3 py-2 text-gray-700">Status</th>
                  <th className="text-left px-3 py-2 text-gray-700">Assigned To</th>
                  <th className="text-left px-3 py-2 text-gray-700">Created At</th>
                  <th className="text-left px-3 py-2 text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-gray-500" colSpan={8}>No tasks for this control.</td>
                  </tr>
                )}
                {tasks.map((t) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-3 py-2">{t.task_name}</td>
                    <td className="px-3 py-2">{t.task_priority}</td>
                    <td className="px-3 py-2">{t.task_type}</td>
                    <td className="px-3 py-2">{t.control_stage || "—"}</td>
                    <td className="px-3 py-2">{t.task_status}</td>
                    <td className="px-3 py-2">{t.assigned_to}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {t.created_at ? (() => {
                        const dateStr = String(t.created_at).replace("T", " ");
                        const [date, time] = dateStr.split(" ");
                        return (
                          <div className="flex flex-col">
                            <span>{date || "—"}</span>
                            <span className="text-gray-500 text-sm">{time ? time.substring(0, 8) : ""}</span>
                          </div>
                        );
                      })() : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {!permissionsLoading && hasPermission('tasks', 'retrieve') && (
                          <button
                            className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-blue-50"
                            title="View"
                            onClick={() => navigate(`/tasks/${t.id}`)}
                            style={{ color: THEME_COLORS.darkTeal }}
                          >
                            <Eye size={16} />
                          </button>
                        )}
                        {!permissionsLoading && hasPermission('tasks', 'update') && (
                          <button
                            className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-cyan-50"
                            title="Edit"
                            onClick={() => setEditingTaskId(t.id)}
                            style={{ color: THEME_COLORS.mediumTeal }}
                          >
                            <FileEdit size={16} />
                          </button>
                        )}
                        {!permissionsLoading && hasPermission('tasks', 'delete') && (
                          <button
                            className="flex items-center justify-center p-1.5 rounded transition-colors hover:bg-red-50"
                            title="Delete"
                            onClick={async () => {
                              try {
                                const json = await del(`/api/tasks/${t.id}`);
                                if (json.error) throw new Error(json.error);
                                // reload tasks
                                const reload = await get(`/api/tasks/control/${encodeURIComponent(id)}`);
                                setTasks(Array.isArray(reload.data) ? reload.data : []);
                              } catch (e) {
                                showToast(`Failed to delete task: ${e.message}`, 'error');
                              }
                            }}
                            style={{ color: "#dc3545" }}
                          >
                            <Trash size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Comments Section (moved to end) */}
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-gray-700">Comments</h3>
          <div className="flex flex-col md:flex-row gap-3 relative">
            <input
              type="text"
              value={newComment}
              onChange={async (e) => {
                const val = e.target.value;
                setNewComment(val);
                const mention = getActiveMention(val);
                if (mention && mention.token.length >= 2) {
                  setShowCommentSuggestions(true);
                  await fetchUserSuggestions(mention.token, setCommentSuggestions);
                } else {
                  setShowCommentSuggestions(false);
                  setCommentSuggestions([]);
                }
              }}
              placeholder="Add a comment"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
            {showCommentSuggestions && commentSuggestions.length > 0 && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow z-10">
                {commentSuggestions.map((u) => (
                  <button
                    key={u.id || u.email}
                    type="button"
                    onClick={() => {
                      const mention = getActiveMention(newComment);
                      if (mention) {
                        const next = replaceMention(newComment, mention.token, u.email);
                        setNewComment(next);
                        setShowCommentSuggestions(false);
                        setCommentSuggestions([]);
                      }
                    }}
                    className="w-full text-left px-3 py-2 transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}80`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {u.email}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              style={{
                background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`;
              }}
              onClick={async () => {
                if (!newComment.trim()) return;
                const now = new Date();
                const stamp = now.toLocaleString();
                const newEntry = {
                  text: newComment.trim(),
                  time: stamp,
                  author: session?.user?.email || "",
                };
                const before = comments;
                const nextLocal = [...comments, newEntry];
                setComments(nextLocal);
                setNewComment("");
                try {
                  const json = await post(`/api/security-controls/${id}/comments`, {
                    comment: newEntry,
                  });
                  if (json.error) {
                    // Handle error object - extract detail if it's an object
                    const errorMsg = typeof json.error === 'object' && json.error.detail 
                      ? json.error.detail 
                      : (typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
                    throw new Error(errorMsg);
                  }
                } catch (e) {
                  // Extract error message properly from API response
                  let errorMsg = e.message || 'Failed to add comment';
                  if (e.body) {
                    if (typeof e.body === 'object') {
                      errorMsg = e.body.detail || e.body.message || e.body.error || JSON.stringify(e.body);
                    } else if (typeof e.body === 'string') {
                      errorMsg = e.body;
                    }
                  }
                  console.error("Add comment failed", errorMsg);
                  showToast(`Failed to add comment: ${errorMsg}`, 'error');
                  setComments(before);
                }
              }}
              className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex items-center justify-center"
              aria-label="Add Comment"
              title="Add Comment"
            >
              <span aria-hidden="true" className="text-black text-lg">+</span>
              <span aria-hidden="true" className="text-black ml-1">💬</span>
            </button>
          </div>

          <ul className="space-y-2">
            {comments.length === 0 && (
              <li className="text-gray-500">No comments yet.</li>
            )}
            {comments.map((c, idx) => {
              if (!c || typeof c !== 'object') return null;
              const commentText = typeof c.text === 'string' ? c.text : (typeof c === 'string' ? c : String(c.text || ''));
              const commentTime = typeof c.time === 'string' ? c.time : '';
              const commentAuthor = typeof c.author === 'string' ? c.author : '';
              const isOwner = (session?.user?.email || "") === commentAuthor;
              const isEditing = editingCommentIndex === idx;
              return (
                <li key={idx} className="p-3 border rounded-lg flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1">
                    {isEditing ? (
                      <div className="relative">
                        <input
                        type="text"
                        value={editCommentText}
                        onChange={async (e) => {
                          const val = e.target.value;
                          setEditCommentText(val);
                          const mention = getActiveMention(val);
                          if (mention && mention.token.length >= 2) {
                            setShowEditSuggestions(true);
                            await fetchUserSuggestions(mention.token, setEditSuggestions);
                          } else {
                            setShowEditSuggestions(false);
                            setEditSuggestions([]);
                          }
                        }}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1"
                        />
                        {showEditSuggestions && editSuggestions.length > 0 && (
                          <div className="absolute left-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded shadow z-10">
                            {editSuggestions.map((u) => (
                              <button
                                key={u.id || u.email}
                                type="button"
                                onClick={() => {
                                  const mention = getActiveMention(editCommentText);
                                  if (mention) {
                                    const next = replaceMention(editCommentText, mention.token, u.email);
                                    setEditCommentText(next);
                                    setShowEditSuggestions(false);
                                    setEditSuggestions([]);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 transition-colors"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}80`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                              >
                                {u.email}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {commentText}
                        <div className="text-xs text-gray-500">{commentTime} • {commentAuthor}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {isOwner && !isEditing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCommentIndex(idx);
                          setEditCommentText(commentText);
                        }}
                        className="p-2 bg-violet-600 hover:bg-violet-700 text-white rounded-full flex items-center justify-center"
                        aria-label="Edit Comment"
                        title="Edit Comment"
                      >
                        <span aria-hidden="true">✏️</span>
                      </button>
                    )}
                    {isOwner && isEditing && (
                      <button
                        type="button"
                        onClick={async () => {
                          const next = comments.map((x, i) => i === idx ? { ...x, text: editCommentText } : x);
                          setComments(next);
                          setEditingCommentIndex(null);
                          setEditCommentText("");
                          const ok = await persistComments(next);
                          if (!ok) {
                            showToast('Failed to save comment', 'error');
                          } else {
                            showToast('Comment saved successfully', 'success');
                          }
                        }}
                        className="px-3 py-1 text-white rounded flex items-center transition-all shadow-sm hover:shadow-md"
                        style={{
                          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                        }}
                        aria-label="Save Comment"
                        title="Save Comment"
                      >
                        <span aria-hidden="true" className="mr-1">💾</span>
                        <span>Save</span>
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteCommentIndex(idx)}
                        className="p-2 text-white rounded-full flex items-center justify-center transition-all"
                        style={{
                          background: `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.vanDykeBrown})`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
                        }}
                        aria-label="Delete Comment"
                        title="Delete Comment"
                      >
                        <span aria-hidden="true">🗑️</span>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {confirmDeleteCommentIndex !== null && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-[90%] max-w-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Delete Comment?</h2>
            <p className="text-gray-600 mb-4">Are you sure you want to delete this comment?</p>
            <div className="flex items-center justify-end gap-3">
              <button 
                className="px-4 py-2 rounded-lg transition-all"
                style={{
                  background: THEME_COLORS.whiteSmoke,
                  color: THEME_COLORS.darkTeal,
                  border: `1px solid ${THEME_COLORS.lightBlue}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = THEME_COLORS.lightBlue;
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = THEME_COLORS.whiteSmoke;
                  e.currentTarget.style.color = THEME_COLORS.darkTeal;
                }}
                onClick={() => setConfirmDeleteCommentIndex(null)}
              >
                No
              </button>
              <button
                className="px-4 py-2 rounded-lg text-white transition-all shadow-sm hover:shadow-md"
                style={{
                  background: `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.vanDykeBrown})`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
                }}
                onClick={async () => {
                  const next = comments.filter((_, i) => i !== confirmDeleteCommentIndex);
                  setComments(next);
                  setConfirmDeleteCommentIndex(null);
                  const ok = await persistComments(next);
                  if (!ok) {
                    showToast('Failed to delete comment', 'error');
                  } else {
                    showToast('Comment deleted successfully', 'success');
                  }
                }}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action View Dialog */}
      <ActionViewDialog
        open={!!viewingAction}
        onClose={() => setViewingAction(null)}
        action={viewingAction}
      />

      {/* Action Edit Dialog */}
      <ActionEditDialog
        open={!!editingAction}
        onClose={() => setEditingAction(null)}
        action={editingAction}
        controlId={id}
        onSave={async () => {
          // Reload actions
          try {
            const reload = await get(`/api/actions?control_id=${encodeURIComponent(id)}&tenant_id=00000000-0000-0000-0000-000000000001`);
            setActions(Array.isArray(reload.data) ? reload.data : []);
          } catch (e) {
            console.error("Failed to reload actions", e);
          }
        }}
      />

      {/* Task Edit Modal */}
      {editingTaskId && (
        <TaskEditModal
          open={!!editingTaskId}
          onClose={() => setEditingTaskId(null)}
          taskId={editingTaskId}
          onSuccess={async () => {
            // Reload tasks after successful edit
            try {
              const json = await get(`/api/tasks/control/${encodeURIComponent(id)}`);
              if (json.error) throw new Error(json.error);
              setTasks(Array.isArray(json.data) ? json.data : []);
            } catch (e) {
              console.error("Load tasks failed", e);
              setTasks([]);
            }
          }}
        />
      )}
    </div>
  );
}
