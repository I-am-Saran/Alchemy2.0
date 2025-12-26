import React, { useEffect, useMemo, useState } from "react";
import FormField from "../components/FormField";
import GlossyButton from "../components/GlossyButton";
import UserAutocomplete from "../components/UserAutocomplete";
import Breadcrumb from "../components/Breadcrumb";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, post, put, del } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Loader from "../components/Loader";

export default function TaskForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [searchParams] = useSearchParams();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, hasRole, userRoles, loading: permsLoading } = usePermissions();
  
  // Check if user is superadmin
  const isSuperAdmin = useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    return userRoles.some((userRole) => {
      const roleName = userRole?.roles?.role_name || userRole?.role_name || '';
      return roleName.toLowerCase() === 'super admin' || roleName.toLowerCase() === 'superadmin';
    });
  }, [userRoles]);
  
  const canUpdateTask = !permsLoading && (isSuperAdmin || hasPermission('tasks', 'update'));
  const canCreateTask = !permsLoading && (isSuperAdmin || hasPermission('tasks', 'create'));
  
  // Check if user has Internal Auditor or External Auditor role
  const isInternalAuditor = hasRole('Internal Auditor');
  const isExternalAuditor = hasRole('External Auditor');

  const [controlId, setControlId] = useState(searchParams.get("control_id") || "");
  const [controlUuid, setControlUuid] = useState(searchParams.get("control_uuid") || "");
  const returnUrl = searchParams.get("returnUrl") || null;
  const [taskName, setTaskName] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [taskPriority, setTaskPriority] = useState("Low");
  const [taskType, setTaskType] = useState("Observation");
  const [taskStatus, setTaskStatus] = useState("Open");
  const [controlStage, setControlStage] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [auditOwner, setAuditOwner] = useState("");
  const [auditId, setAuditId] = useState("");
  const [audits, setAudits] = useState([]);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [internallyReviewed, setInternallyReviewed] = useState(false);
  const [externallyReviewed, setExternallyReviewed] = useState(false);

  // Task comments state
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState("");

  const isControlLocked = true;

  // Fetch audits for dropdown - only when component is mounted and session is ready
  useEffect(() => {
    // Only fetch if we're actually on the task form page (not pre-rendered)
    if (typeof window === 'undefined') return;
    
    const fetchAudits = async () => {
      if (!session) return;
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(`/api/audits?tenant_id=${encodeURIComponent(tenant_id)}`);
        if (!json.error && Array.isArray(json.data)) {
          setAudits(json.data);
        }
      } catch (e) {
        console.error("Failed to load audits:", e);
      }
    };
    // Only fetch when session is ready and we're actually on this route
    if (!sessionLoading && session && window.location.pathname.includes('/tasks')) {
      fetchAudits();
    }
  }, [sessionLoading, session]);

  useEffect(() => {
    const fetchTask = async () => {
      if (!editId || !session) return;
      setLoading(true);
      try {
        const json = await get(`/api/tasks/${editId}`);
        if (json.error) throw new Error(json.error);
        const found = json.data || null;
        if (!found) throw new Error("Task not found");
        setControlId(found.control_id || "");
        setControlUuid(found.control_uuid || "");
        setTaskName(found.task_name || "");
        setTaskNote(found.task_note || "");
        setTaskPriority(found.task_priority || "Low");
        setTaskType(found.task_type || "Observation");
        setTaskStatus(found.task_status || "Open");
        setControlStage(found.control_stage || "");
        setAssignedTo(found.assigned_to || "");
        setAuditOwner(found.audit_owner || "");
        setAuditId(found.audit_id || "");
        setAttachmentUrl(found.attachment || "");
        setComments(Array.isArray(found.comments) ? found.comments : []);
        // Note: internally_reviewed and externally_reviewed are task statuses, not database columns
        // They should be derived from task_status or handled through a different mechanism
        setInternallyReviewed(false);
        setExternallyReviewed(false);
      } catch (e) {
        alert("Failed to load task: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading) fetchTask();
  }, [editId, sessionLoading, session]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!session) return;
    
    // Wait for permissions to load
    if (permsLoading) {
      showToast('Please wait while permissions are loading...', 'info');
      return;
    }
    
    // Check permissions (including superadmin)
    if (editId) {
      // Updating existing task
      if (!canUpdateTask) {
        showToast('You do not have permission to update tasks', 'error');
        return;
      }
    } else {
      // Creating new task
      if (!canCreateTask) {
        showToast('You do not have permission to create tasks', 'error');
        return;
      }
    }
    
    // Validate control_id is required when creating new tasks
    if (!editId && !controlId) {
      showToast('Control ID is required when creating a task', 'error');
      return;
    }
    
    setSaving(true);
    try {
      const payload = {
        control_id: controlId,
        control_uuid: controlUuid || null,
        audit_id: auditId || null,
        task_name: taskName,
        task_note: taskNote,
        task_priority: taskPriority,
        task_type: taskType,
        task_status: taskStatus,
        control_stage: controlStage,
        assigned_to: assignedTo,
        audit_owner: auditOwner || "",
        attachment: attachmentUrl || "",
        comments: Array.isArray(comments) ? comments : [],
        // Note: internally_reviewed and externally_reviewed are task statuses, not database columns
        // They should be handled as part of task_status or through a different mechanism
      };

      let taskId = editId;
      const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
      
      if (editId) {
        const json = await put(`/api/tasks/${editId}?tenant_id=${encodeURIComponent(tenant_id)}`, payload);
        if (json.error) throw new Error(json.error);
        taskId = json.data?.id || editId;
      } else {
        const json = await post(`/api/tasks`, payload);
        if (json.error) throw new Error(json.error);
        taskId = json.data?.id;
      }

      if (file && taskId) {
        // File upload needs special handling with FormData
        const form = new FormData();
        form.append("file", file);
        const token = sessionStorage.getItem('auth_token');
        const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
        const up = await fetch(`${BASE_URL}/api/tasks/${taskId}/upload`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: form,
        });
        const j = await up.json();
        if (!up.ok || j.error) throw new Error(j.error || up.statusText);
      }

      showToast('Task saved successfully', 'success');
      // If editing and returnUrl is provided, navigate back to that page (e.g., security controls detail page)
      if (editId && returnUrl) {
        navigate(returnUrl);
      } else {
        // Always navigate to tasks page after creating a task to refresh the list
        navigate("/tasks");
      }
    } catch (err) {
      showToast(`Failed to save task: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Check permissions on load - redirect if no permission
  useEffect(() => {
    if (!sessionLoading && !permsLoading && session) {
      if (editId) {
        // Editing existing task - need update permission
        if (!canUpdateTask) {
          showToast('You do not have permission to edit tasks', 'error');
          navigate('/tasks');
        }
      } else {
        // Creating new task - need create permission
        if (!canCreateTask) {
          showToast('You do not have permission to create tasks', 'error');
          navigate('/tasks');
        }
      }
    }
  }, [sessionLoading, permsLoading, session, editId, canUpdateTask, canCreateTask, navigate, showToast]);

  if (sessionLoading || loading || permsLoading) {
    return <Loader message="Loading task form..." />;
  }

  // Don't render form if user doesn't have permission (prevents flash of content)
  if (session && (editId ? !canUpdateTask : !canCreateTask)) {
    return (
      <div className="p-6">
        <p className="text-gray-700">You do not have permission to {editId ? 'edit' : 'create'} tasks.</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumb
        items={[
          { label: "Tasks", to: "/tasks" },
          { label: editId ? "Edit Task" : "Create Task" },
        ]}
      />
      <div className="bg-white rounded-xl shadow-sm border" style={{ borderColor: THEME_COLORS.lightBlue }}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: THEME_COLORS.darkTeal }}>
            {editId ? "Edit Task" : "Create Task"}
          </h2>
            <form onSubmit={onSave}>
              <div className="row">
                <div className="col-6 mb-3">
                  <FormField label="Control ID" value={controlId} onChange={(e) => setControlId(e.target.value)} placeholder="e.g., CDE-005" required={!editId} readOnly={!!editId} />
                </div>
                <div className="col-6 mb-3">
                  <FormField label="Task Name" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="Concise task name" />
                </div>
              </div>
              <div className="row">
                <div className="col-12 mb-3">
                  <FormField label="Task Note" type="textarea" value={taskNote} onChange={(e) => setTaskNote(e.target.value)} placeholder="Details, context, next steps" />
                </div>
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <FormField
                    label="Task Priority"
                    type="select"
                    value={taskPriority}
                    onChange={(val) => setTaskPriority(val)}
                    options={[
                      { label: "Low", value: "Low" },
                      { label: "Medium", value: "Medium" },
                      { label: "High", value: "High" },
                      { label: "Critical", value: "Critical" },
                    ]}
                  />
                </div>
                <div className="col-6 mb-3">
                  <FormField
                    label="Task Type"
                    type="select"
                    value={taskType}
                    onChange={(val) => setTaskType(val)}
                    options={[
                      { label: "Observation", value: "Observation" },
                      { label: "Improvement", value: "Improvement" },
                      { label: "Compliance", value: "Compliance" },
                      { label: "Technical", value: "Technical" },
                      { label: "External", value: "External" },
                      { label: "Risk", value: "Risk" },
                      { label: "IGS", value: "IGS" },
                      { label: "Bug - Functional", value: "Bug - Functional" },
                      { label: "Bug - Security", value: "Bug - Security" },
                      { label: "Bug - Performance", value: "Bug - Performance" },
                      { label: "Other", value: "Other" },
                    ]}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <FormField
                    label="Control Stage"
                    type="select"
                    value={controlStage}
                    onChange={(val) => setControlStage(val)}
                    options={[
                      { label: "Plan", value: "Plan" },
                      { label: "Do", value: "Do" },
                      { label: "Check", value: "Check" },
                      { label: "Act", value: "Act" },
                    ]}
                  />
                </div>
                <div className="col-6 mb-3">
                  <FormField
                    label="Task Status"
                    type="select"
                    value={taskStatus}
                    onChange={(val) => setTaskStatus(val)}
                    options={[
                      { label: "Open", value: "Open" },
                      { label: "In Progress", value: "In Progress" },
                      { label: "Closed", value: "Closed" },
                      { label: "On Hold", value: "On Hold" },
                    ]}
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <UserAutocomplete
                    label="Assigned To"
                    value={assignedTo}
                    onChange={setAssignedTo}
                    placeholder="Search by email..."
                    fieldType="assignee"
                  />
                </div>
                <div className="col-6 mb-3">
                  <UserAutocomplete
                    label="Audit Owner"
                    value={auditOwner}
                    onChange={setAuditOwner}
                    placeholder="Search by email..."
                    fieldType="assignee"
                  />
                </div>
              </div>
              <div className="row">
                <div className="col-6 mb-3">
                  <FormField
                    label="Audit"
                    type="select"
                    value={auditId}
                    onChange={(val) => setAuditId(val)}
                    options={[
                      { label: "None", value: "" },
                      ...audits.map(audit => ({
                        label: audit.audit_name || audit.id,
                        value: audit.id
                      }))
                    ]}
                  />
                </div>
              </div>
              {/* Review Status Fields - Only for IGS task type */}
              {taskType === "IGS" && (
                <div className="row">
                  {/* Internally Reviewed - Only visible/editable by Internal Auditor */}
                  {(isInternalAuditor || isSuperAdmin) && (
                    <div className="col-6 mb-3">
                      <label className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                        <input
                          type="checkbox"
                          checked={internallyReviewed}
                          onChange={(e) => setInternallyReviewed(e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        Internally Reviewed
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Only Internal Auditors can update this status</p>
                    </div>
                  )}
                  {/* Externally Reviewed - Only visible/editable by External Auditor */}
                  {(isExternalAuditor || isSuperAdmin) && (
                    <div className="col-6 mb-3">
                      <label className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                        <input
                          type="checkbox"
                          checked={externallyReviewed}
                          onChange={(e) => setExternallyReviewed(e.target.checked)}
                          className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                        />
                        Externally Reviewed
                      </label>
                      <p className="text-xs text-gray-500 mt-1">Only External Auditors can update this status</p>
                    </div>
                  )}
                  {/* Show read-only status for other users */}
                  {!isInternalAuditor && !isExternalAuditor && !isSuperAdmin && (
                    <div className="col-12 mb-3">
                      <div className="row">
                        <div className="col-6">
                          <div className="text-sm text-gray-600">
                            <strong>Internally Reviewed:</strong> {internallyReviewed ? "Yes" : "No"}
                          </div>
                        </div>
                        <div className="col-6">
                          <div className="text-sm text-gray-600">
                            <strong>Externally Reviewed:</strong> {externallyReviewed ? "Yes" : "No"}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="row">
                <div className="col-12 mb-3">
                  <div>
                    <label className="block text-gray-700 font-medium mb-1">Attachment</label>
                    <input type="file" className="w-full border border-gray-300 rounded-lg px-3 py-2" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    {attachmentUrl && (
                      <p className="text-sm text-gray-600 mt-1">Current: <a className="text-violet-700 underline" href={attachmentUrl} target="_blank" rel="noreferrer">View</a></p>
                    )}
                  </div>
                </div>
              </div>
              {/* Comments Section */}
              <div className="row">
                <div className="col-12 mb-3">
                  <h3 className="text-md font-semibold text-gray-700 mb-2">Comments</h3>
                <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                  {/* Existing comments list */}
                  {Array.isArray(comments) && comments.length > 0 ? (
                    <ul className="space-y-2">
                      {comments.map((c, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="inline-block px-2 py-1 text-xs rounded bg-purple-50 text-purple-700 border border-purple-200">{c?.time || ""}</span>
                          <span className="text-gray-800">{c?.text || ""}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-500">No comments yet.</p>
                  )}
                  {/* Add new comment */}
                  <div className="pt-2">
                    <label className="block text-gray-700 font-medium mb-1">Add a comment</label>
                    <textarea
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="Write your comment"
                    />
                    <div className="flex items-center justify-end pt-2">
                      <button
                        type="button"
                        className="px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white btn-gloss flex items-center gap-2"
                        onClick={() => {
                          const text = newCommentText.trim();
                          if (!text) return;
                          const ts = new Date();
                          const timestamp = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, "0")}-${String(ts.getDate()).padStart(2, "0")} ${String(ts.getHours()).padStart(2, "0")}:${String(ts.getMinutes()).padStart(2, "0")}`;
                          const next = Array.isArray(comments) ? [...comments] : [];
                          next.push({ text, time: timestamp });
                          setComments(next);
                          setNewCommentText("");
                        }}
                        title="Add Comment"
                      >
                        + <span role="img" aria-label="comment">💬</span>
                        <span>Add Comment</span>
                      </button>
                    </div>
                  </div>
                </div>
                </div>
              </div>
              <div className="row">
                <div className="col-12">
                  <div className="flex items-center gap-3 pt-2">
                <GlossyButton 
                  type="submit" 
                  disabled={saving || (editId ? !hasPermission('tasks', 'update') : !hasPermission('tasks', 'create'))}
                  title={editId ? (!hasPermission('tasks', 'update') ? 'You do not have permission to update tasks' : '') : (!hasPermission('tasks', 'create') ? 'You do not have permission to create tasks' : '')}
                >
                  {saving ? "Saving..." : "Save"}
                </GlossyButton>
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg transition-colors"
                  style={{ 
                    border: `1px solid ${THEME_COLORS.lightBlue}`,
                    color: THEME_COLORS.darkTeal,
                    backgroundColor: '#ffffff'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}40`;
                    e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = THEME_COLORS.lightBlue;
                  }}
                  onClick={() => {
                    if (editId && returnUrl) {
                      navigate(returnUrl);
                    } else if (controlId) {
                      // If task was created from security controls module, navigate to security controls list with control_id filter
                      navigate(`/security-controls?control_id=${encodeURIComponent(controlId)}`);
                    } else {
                      navigate("/tasks");
                    }
                  }}
                >
                  Back
                </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
  );
}