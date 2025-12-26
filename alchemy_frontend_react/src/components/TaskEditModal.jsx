import React, { useEffect, useState, useMemo } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import FormField from "./FormField";
import Button from "./ui/Button";
import UserAutocomplete from "./UserAutocomplete";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, put } from "../services/api";

export default function TaskEditModal({ open, onClose, taskId, onSuccess }) {
  const { session } = useSession();
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
  
  // Check if user has Internal Auditor or External Auditor role
  const isInternalAuditor = hasRole('Internal Auditor');
  const isExternalAuditor = hasRole('External Auditor');

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    control_id: "",
    task_name: "",
    task_note: "",
    task_priority: "Low",
    task_type: "Observation",
    task_status: "Open",
    control_stage: "",
    assigned_to: "",
    department: "",
    attachment: "",
    internally_reviewed: false,
    externally_reviewed: false,
  });
  const [file, setFile] = useState(null);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState("");

  // Load task data when modal opens
  useEffect(() => {
    if (open && taskId && session) {
      loadTask();
    } else if (!open) {
      // Reset form when modal closes
      setFormData({
        control_id: "",
        task_name: "",
        task_note: "",
        task_priority: "Low",
        task_type: "Observation",
        task_status: "Open",
        control_stage: "",
        assigned_to: "",
        attachment: "",
        internally_reviewed: false,
        externally_reviewed: false,
      });
      setComments([]);
      setFile(null);
    }
  }, [open, taskId, session]);

  const loadTask = async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const json = await get(`/api/tasks/${taskId}`);
      if (json.error) throw new Error(json.error);
      const task = json.data || null;
      if (!task) throw new Error("Task not found");
      
        setFormData({
        control_id: task.control_id || "",
        task_name: task.task_name || "",
        task_note: task.task_note || "",
        task_priority: task.task_priority || "Low",
        task_type: task.task_type || "Observation",
        task_status: task.task_status || "Open",
        control_stage: task.control_stage || "",
        assigned_to: task.assigned_to || "",
        department: task.department || "",
        attachment: task.attachment || "",
        // Note: internally_reviewed and externally_reviewed are task statuses, not database columns
        internally_reviewed: false,
        externally_reviewed: false,
      });
      setComments(Array.isArray(task.comments) ? task.comments : []);
    } catch (e) {
      showToast(`Failed to load task: ${e.message}`, 'error');
      onClose();
    } finally {
      setLoading(false);
    }
  };


  const handleSave = async () => {
    if (!session) return;
    
    // Wait for permissions to load
    if (permsLoading) {
      showToast('Please wait while permissions are loading...', 'info');
      return;
    }
    
    // Check permission (including superadmin)
    if (!canUpdateTask) {
      showToast('You do not have permission to update tasks', 'error');
      return;
    }
    
    setSaving(true);
    try {
      // Remove internally_reviewed and externally_reviewed as they are task statuses, not database columns
      const { internally_reviewed, externally_reviewed, ...formDataWithoutReview } = formData;
      const payload = {
        ...formDataWithoutReview,
        comments: Array.isArray(comments) ? comments : [],
        tenant_id: session.tenant_id || "00000000-0000-0000-0000-000000000001",
      };

      const json = await put(`/api/tasks/${taskId}?tenant_id=${encodeURIComponent(payload.tenant_id)}`, payload);
      if (json.error) throw new Error(json.error);

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

      showToast('Task updated successfully', 'success');
      onSuccess?.();
      onClose();
    } catch (err) {
      showToast(`Failed to update task: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} handler={onClose} dismiss={{ enabled: true }} className="z-50">
      <DialogHeader className="text-lg text-violet-800 font-semibold bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-200">
        Edit Task
      </DialogHeader>
      <DialogBody className="w-full mx-4 max-w-6xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 text-gray-800">
        {loading ? (
          <div className="p-6 text-center">
            <p className="text-gray-700">Loading task...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            <FormField 
              label="Control ID" 
              value={formData.control_id} 
              onChange={(e) => setFormData(prev => ({ ...prev, control_id: e.target.value }))} 
              placeholder="e.g., CDE-005" 
              readOnly={true} 
            />
            <FormField 
              label="Task Name" 
              value={formData.task_name} 
              onChange={(e) => setFormData(prev => ({ ...prev, task_name: e.target.value }))} 
              placeholder="Concise task name" 
            />
            <FormField 
              label="Task Note" 
              type="textarea" 
              value={formData.task_note} 
              onChange={(e) => setFormData(prev => ({ ...prev, task_note: e.target.value }))} 
              placeholder="Details, context, next steps" 
            />
            <FormField
              label="Task Priority"
              type="select"
              value={formData.task_priority}
              onChange={(val) => setFormData(prev => ({ ...prev, task_priority: val }))}
              options={[
                { label: "Low", value: "Low" },
                { label: "Medium", value: "Medium" },
                { label: "High", value: "High" },
                { label: "Critical", value: "Critical" },
              ]}
            />
            <FormField
              label="Task Type"
              type="select"
              value={formData.task_type}
              onChange={(val) => setFormData(prev => ({ ...prev, task_type: val }))}
              options={[
                { label: "Observation", value: "Observation" },
                { label: "Improvement", value: "Improvement" },
                { label: "Compliance", value: "Compliance" },
                { label: "Risk", value: "Risk" },
                { label: "IGS", value: "IGS" },
                { label: "Bug - Functional", value: "Bug - Functional" },
                { label: "Bug - Security", value: "Bug - Security" },
                { label: "Bug - Performance", value: "Bug - Performance" },
                { label: "Other", value: "Other" },
              ]}
            />
            <FormField
              label="Control Stage"
              type="select"
              value={formData.control_stage}
              onChange={(val) => setFormData(prev => ({ ...prev, control_stage: val }))}
              options={[
                { label: "Plan", value: "Plan" },
                { label: "Do", value: "Do" },
                { label: "Check", value: "Check" },
                { label: "Act", value: "Act" },
              ]}
            />
            <FormField
              label="Task Status"
              type="select"
              value={formData.task_status}
              onChange={(val) => setFormData(prev => ({ ...prev, task_status: val }))}
              options={[
                { label: "Open", value: "Open" },
                { label: "In Progress", value: "In Progress" },
                { label: "Closed", value: "Closed" },
                { label: "On Hold", value: "On Hold" },
              ]}
            />
            <UserAutocomplete
              label="Assigned To"
              value={formData.assigned_to}
              onChange={(value, userObject) => {
                setFormData(prev => {
                  const updated = { ...prev, assigned_to: value };
                  // Auto-populate department from assigned user
                  if (userObject && userObject.department) {
                    updated.department = userObject.department;
                  }
                  return updated;
                });
              }}
              placeholder="Search by email..."
              fieldType="assignee"
            />
            <FormField
              label="Department"
              value={formData.department || ""}
              onChange={() => {}} // Read-only
              placeholder="Auto-populated from assigned user"
              readOnly={true}
            />
            {/* Review Status Fields - Only for IGS task type */}
            {formData.task_type === "IGS" && (
              <>
                {/* Internally Reviewed - Only visible/editable by Internal Auditor */}
                {(isInternalAuditor || isSuperAdmin) && (
                  <div>
                    <label className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                      <input
                        type="checkbox"
                        checked={formData.internally_reviewed || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, internally_reviewed: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                      />
                      Internally Reviewed
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Only Internal Auditors can update this status</p>
                  </div>
                )}
                {/* Externally Reviewed - Only visible/editable by External Auditor */}
                {(isExternalAuditor || isSuperAdmin) && (
                  <div>
                    <label className="flex items-center gap-2 text-gray-700 font-medium mb-1">
                      <input
                        type="checkbox"
                        checked={formData.externally_reviewed || false}
                        onChange={(e) => setFormData(prev => ({ ...prev, externally_reviewed: e.target.checked }))}
                        className="w-4 h-4 text-violet-600 border-gray-300 rounded focus:ring-violet-500"
                      />
                      Externally Reviewed
                    </label>
                    <p className="text-xs text-gray-500 mt-1">Only External Auditors can update this status</p>
                  </div>
                )}
                {/* Show read-only status for other users */}
                {!isInternalAuditor && !isExternalAuditor && !isSuperAdmin && (
                  <div className="space-y-2">
                    <div className="text-sm text-gray-600">
                      <strong>Internally Reviewed:</strong> {formData.internally_reviewed ? "Yes" : "No"}
                    </div>
                    <div className="text-sm text-gray-600">
                      <strong>Externally Reviewed:</strong> {formData.externally_reviewed ? "Yes" : "No"}
                    </div>
                  </div>
                )}
              </>
            )}
            <div>
              <label className="block text-gray-700 font-medium mb-1">Attachment</label>
              <input 
                type="file" 
                className="w-full border border-gray-300 rounded-lg px-3 py-2" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
              {formData.attachment && (
                <p className="text-sm text-gray-600 mt-1">
                  Current: <a className="text-violet-700 underline" href={formData.attachment} target="_blank" rel="noreferrer">View</a>
                </p>
              )}
            </div>
            {/* Comments Section */}
            <div className="mt-4">
              <h3 className="text-md font-semibold text-gray-700 mb-2">Comments</h3>
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                {Array.isArray(comments) && comments.length > 0 ? (
                  <ul className="space-y-2">
                    {comments.map((c, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="inline-block px-2 py-1 text-xs rounded bg-purple-50 text-purple-700 border border-purple-200">
                          {c?.time || ""}
                        </span>
                        <span className="text-gray-800">{c?.text || ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500">No comments yet.</p>
                )}
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
                    >
                      + <span role="img" aria-label="comment">💬</span>
                      <span>Add Comment</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogBody>
      <DialogFooter className="gap-2 px-6 pb-6 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200">
        <Button variant="outline" onClick={onClose} disabled={saving || loading}>
          Cancel
        </Button>
        <Button 
          variant="primary" 
          onClick={handleSave} 
          disabled={saving || loading || permsLoading || !canUpdateTask}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

