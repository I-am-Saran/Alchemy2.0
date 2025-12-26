import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { get } from "../services/api";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { THEME_COLORS } from "../constants/colors";
import Loader from "./Loader";
import CreateCommentDialog from "./CreateCommentDialog";

export default function TaskViewDialog({ open, onClose, taskId }) {
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, userRoles, loading: permsLoading } = usePermissions();
  
  // Check if user is superadmin
  const isSuperAdmin = useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    return userRoles.some((userRole) => {
      const roleName = userRole?.roles?.role_name || userRole?.role_name || '';
      return roleName.toLowerCase() === 'super admin' || roleName.toLowerCase() === 'superadmin';
    });
  }, [userRoles]);
  
  const canUpdateTask = !permsLoading && (isSuperAdmin || hasPermission('tasks', 'update'));
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  useEffect(() => {
    if (open && taskId && session && !sessionLoading) {
      const fetchTask = async () => {
        setLoading(true);
        setError("");
        try {
          const tenant_id = session?.tenant_id || "00000000-0000-0000-0000-000000000001";
          const json = await get(`/api/tasks/${taskId}?tenant_id=${encodeURIComponent(tenant_id)}`);
          if (json.error) {
            throw new Error(json.error);
          }
          setTask(json.data);
        } catch (err) {
          console.error("Error fetching task:", err);
          setError(err.message);
          showToast(`Failed to load task: ${err.message}`, 'error');
        } finally {
          setLoading(false);
        }
      };
      fetchTask();
    } else if (!open) {
      setTask(null);
      setError("");
      setShowCommentDialog(false);
    }
  }, [open, taskId, session, sessionLoading, onClose, showToast]);

  // Parse comments
  let parsedComments = [];
  if (task) {
    try {
      if (typeof task.comments === 'string') {
        const parsed = JSON.parse(task.comments);
        parsedComments = Array.isArray(parsed) ? parsed : [];
      } else if (Array.isArray(task.comments)) {
        parsedComments = task.comments;
      }
    } catch {
      parsedComments = [];
    }
  }

  const modalRef = useRef(null);
  const backdropRef = useRef(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (backdropRef.current && event.target === backdropRef.current) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden"; // Prevent body scroll
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
      >
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with close button */}
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-emerald-50">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Task Details</h2>
              {task && <p className="text-gray-600 mt-1 text-sm">ID: {task.id}</p>}
            </div>
            <button
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
              onClick={onClose}
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 overflow-y-auto flex-1 bg-white">
            {loading || sessionLoading ? (
              <Loader message="Loading task details..." />
            ) : error || !task ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
                <p className="text-red-700">{error || "Task not found"}</p>
              </div>
            ) : (
              <div>
                {/* Action Buttons */}
                <div className="mb-6 flex items-center justify-end gap-3">
                {canUpdateTask && (
                  <button
                    onClick={() => {
                      onClose();
                      // Edit will be handled by parent component via onEdit callback
                      // For now, close view dialog - parent should handle edit modal
                      onClose();
                    }}
                    className="px-4 py-2 text-white rounded-lg transition-all font-medium shadow-sm hover:shadow-md"
                    style={{
                      background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                    }}
                  >
                    Edit
                  </button>
                )}
                <button
                  onClick={() => setShowCommentDialog(true)}
                  className="px-4 py-2 text-white rounded-lg transition-all font-medium shadow-sm hover:shadow-md"
                  style={{
                    background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.dustStormDark}, ${THEME_COLORS.dustStormDark})`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.dustStormDark})`;
                  }}
                >
                  Create Comment
                </button>
                </div>

                {/* Main Content - 3 Column Grid for Better Width Usage */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Basic Information */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Basic Information</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Task Name</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.task_name || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Control ID</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.control_id || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Priority</label>
                    <p className="mt-1">
                      <span
                        className={`inline-block px-2 py-1 rounded-full font-semibold text-xs ${
                          task.task_priority === "Critical" || task.task_priority === "High"
                            ? "bg-red-100 text-red-800"
                            : task.task_priority === "Medium"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {task.task_priority || "—"}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Type</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.task_type || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Status</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.task_status || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Control Stage</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.control_stage || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Assigned To</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.assigned_to || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Department</label>
                    <p className="mt-1 text-gray-900 text-sm">{task.department || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Dates and Additional Info */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Additional Information</h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Created At</label>
                    <p className="mt-1 text-gray-900 text-sm">
                      {task.created_at ? String(task.created_at).replace("T", " ").substring(0, 19) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Updated At</label>
                    <p className="mt-1 text-gray-900 text-sm">
                      {task.updated_at ? String(task.updated_at).replace("T", " ").substring(0, 19) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Attachment</label>
                    <p className="mt-1 text-gray-900 text-sm">
                      {task.attachment ? (
                        <a href={task.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs break-all">
                          {task.attachment}
                        </a>
                      ) : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* System Information - UUIDs */}
            <div className="mt-6 bg-gray-50 rounded-lg shadow-md border border-gray-300 p-6">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">System Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600">Task UUID</label>
                  <p className="mt-1 text-gray-800 font-mono text-sm break-all">{task.id || "—"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600">Control UUID</label>
                  <p className="mt-1 text-gray-800 font-mono text-sm break-all">{task.control_uuid || "—"}</p>
                </div>
              </div>
                </div>

                {/* Task Note */}
                {task.task_note && (
                  <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Task Note</h2>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{task.task_note}</p>
                    </div>
                  </div>
                )}

                {/* Comments */}
                {parsedComments.length > 0 && (
                  <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Comments</h2>
                    <div className="bg-gray-50 rounded p-4 max-h-48 overflow-y-auto space-y-3">
                      {(() => {
                        // Sort comments chronologically by time (descending - newest first)
                        const sortedComments = [...parsedComments].sort((a, b) => {
                          const timeA = a.time || '';
                          const timeB = b.time || '';
                          if (!timeA && !timeB) return 0;
                          if (!timeA) return 1; // Put items without time at the end
                          if (!timeB) return -1;
                          // Try to parse as date, fallback to string comparison
                          try {
                            const dateA = new Date(timeA);
                            const dateB = new Date(timeB);
                            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                              return timeB.localeCompare(timeA); // Descending for strings
                            }
                            return dateB.getTime() - dateA.getTime(); // Descending - newest first
                          } catch {
                            return timeB.localeCompare(timeA); // Descending for strings
                          }
                        });

                        return sortedComments.map((c, idx) => {
                          if (!c || typeof c !== 'object') return null;
                          const commentText = typeof c.text === 'string' ? c.text : String(c.text || '');
                          const commentTime = typeof c.time === 'string' ? c.time : '';
                          const commentAuthor = typeof c.author === 'string' ? c.author : '';
                          return (
                            <div key={idx} className="border-b border-gray-200 pb-2 last:border-b-0">
                              <p className="text-gray-700 text-sm whitespace-pre-wrap">{commentText}</p>
                              {(commentTime || commentAuthor) && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {commentTime && <span>{commentTime}</span>}
                                  {commentTime && commentAuthor && <span> • </span>}
                                  {commentAuthor && <span>{commentAuthor}</span>}
                                </p>
                              )}
                            </div>
                          );
                        });
                      })()}
                  </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && taskId && (
        <CreateCommentDialog
          onClose={() => setShowCommentDialog(false)}
          taskId={taskId}
          type="task"
          onSuccess={async () => {
            // Reload task data to show new comment
            try {
              const tenant_id = session?.tenant_id || "00000000-0000-0000-0000-000000000001";
              const json = await get(`/api/tasks/${taskId}?tenant_id=${encodeURIComponent(tenant_id)}`);
              if (!json.error) {
                setTask(json.data);
              }
            } catch (err) {
              console.error("Error fetching task:", err);
            }
          }}
        />
      )}
    </>
  );
}

