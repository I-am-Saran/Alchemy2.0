import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Loader from "../components/Loader";
import CreateCommentDialog from "../components/CreateCommentDialog";

export default function TaskDetails() {
  const { id } = useParams();
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    const fetchTask = async () => {
      try {
        const tenant_id = session?.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(`/api/tasks/${id}?tenant_id=${encodeURIComponent(tenant_id)}`);
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

    if (session) {
      fetchTask();
    }
  }, [id, sessionLoading, session]);

  if (loading || sessionLoading) {
    return <Loader message="Loading task details..." />;
  }

  if (error || !task) {
    return (
      <div className="min-h-screen">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-700">{error || "Task not found"}</p>
            <button
              onClick={() => navigate("/tasks")}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              Back to Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Parse comments
  let parsedComments = [];
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

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Task Details</h1>
            <p className="text-gray-600 mt-1">ID: {task.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {canUpdateTask && (
              <button
                onClick={() => navigate(`/tasks/edit/${task.id}`)}
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
            <button
              onClick={() => navigate("/tasks")}
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
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Task Name</label>
                <p className="mt-1 text-gray-900">{task.task_name || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Control ID</label>
                <p className="mt-1 text-gray-900">{task.control_id || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <p className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full font-semibold ${
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
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <p className="mt-1 text-gray-900">{task.task_type || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-gray-900">{task.task_status || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Control Stage</label>
                <p className="mt-1 text-gray-900">{task.control_stage || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                <p className="mt-1 text-gray-900">{task.assigned_to || "—"}</p>
              </div>
            </div>
          </div>

          {/* Dates and Additional Info */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Created At</label>
                <p className="mt-1 text-gray-900">
                  {task.created_at ? String(task.created_at).replace("T", " ").substring(0, 19) : "—"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Updated At</label>
                <p className="mt-1 text-gray-900">
                  {task.updated_at ? String(task.updated_at).replace("T", " ").substring(0, 19) : "—"}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Attachment</label>
                <p className="mt-1 text-gray-900">
                  {task.attachment ? (
                    <a href={task.attachment} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
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

      {/* Comment Dialog */}
      {showCommentDialog && (
        <CreateCommentDialog
          onClose={() => setShowCommentDialog(false)}
          taskId={id}
          type="task"
          onSuccess={() => {
            // Reload task data to show new comment
            const fetchTask = async () => {
              try {
                const tenant_id = session?.tenant_id || "00000000-0000-0000-0000-000000000001";
                const json = await get(`/api/tasks/${id}?tenant_id=${encodeURIComponent(tenant_id)}`);
                if (json.error) {
                  throw new Error(json.error);
                }
                setTask(json.data);
              } catch (err) {
                console.error("Error fetching task:", err);
              }
            };
            fetchTask();
          }}
        />
      )}

    </div>
  );
}