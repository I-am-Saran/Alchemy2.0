import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import CreateCommentDialog from "../components/CreateCommentDialog";
import Loader from "../components/Loader";

export default function ActionDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const [action, setAction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);

  useEffect(() => {
    if (sessionLoading) return;

    const fetchAction = async () => {
      try {
        const json = await get(`/api/actions/${id}`);
        if (json.error) {
          throw new Error(json.error);
        }
        setAction(json.data);
      } catch (err) {
        console.error("Error fetching action:", err);
        setError(err.message);
        showToast(`Failed to load action: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAction();
  }, [id, sessionLoading]);

  if (loading || sessionLoading) {
    return <Loader message="Loading action details..." />;
  }

  if (error || !action) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || "Action not found"}</p>
          <button
            onClick={() => navigate("/security-controls")}
            className="mt-4 px-4 py-2 rounded-lg transition-all"
            style={{
              background: THEME_COLORS.lightMint,
              color: THEME_COLORS.darkTeal,
              border: `1px solid ${THEME_COLORS.lightBlue}`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = THEME_COLORS.lightBlue;
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = THEME_COLORS.lightMint;
              e.currentTarget.style.color = THEME_COLORS.darkTeal;
            }}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Action Details</h1>
            <p className="text-gray-600 mt-1">ID: {action.id || action.action_id || "—"}</p>
          </div>
          <div className="flex items-center gap-3">
            {hasPermission('actions', 'update') && (
              <button
                onClick={() => navigate(`/actions/${id}/edit`)}
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
            {hasPermission('actions', 'comment') && (
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
                Add Comment
              </button>
            )}
            <button
              onClick={() => navigate("/security-controls")}
              className="px-4 py-2 rounded-lg transition-all"
              style={{
                background: THEME_COLORS.lightMint,
                color: THEME_COLORS.darkTeal,
                border: `1px solid ${THEME_COLORS.lightBlue}`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = THEME_COLORS.lightBlue;
                e.currentTarget.style.color = '#ffffff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = THEME_COLORS.lightMint;
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
                <label className="block text-sm font-medium text-gray-700">Action Name</label>
                <p className="mt-1 text-gray-900">{action.action_name || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Action Type</label>
                <p className="mt-1 text-gray-900">{action.action_type || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <p className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full font-semibold ${
                      action.action_priority === "Critical"
                        ? "bg-red-100 text-red-800"
                        : action.action_priority === "High"
                        ? "bg-orange-100 text-orange-800"
                        : action.action_priority === "Medium"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {action.action_priority || "—"}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-gray-900">{action.action_status || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Assigned To</label>
                <p className="mt-1 text-gray-900">{action.assigned_to || "—"}</p>
              </div>
              {action.due_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Due Date</label>
                  <p className="mt-1 text-gray-900">{action.due_date || "—"}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Information</h2>
            <div className="space-y-4">
              {action.control_id && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Control ID</label>
                  <p className="mt-1 text-gray-900">{action.control_id || "—"}</p>
                </div>
              )}
              {action.created_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Created At</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(action.created_at).toLocaleString() || "—"}
                  </p>
                </div>
              )}
              {action.updated_at && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Updated At</label>
                  <p className="mt-1 text-gray-900">
                    {new Date(action.updated_at).toLocaleString() || "—"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {action.action_description && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{action.action_description || "—"}</p>
            </div>
          </div>
        )}

        {/* Notes */}
        {action.notes && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Notes</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{action.notes || "—"}</p>
            </div>
          </div>
        )}

        {/* Comments */}
        {action.comments && (() => {
          // Parse comments - could be string, array, or object
          let parsedComments = [];
          try {
            if (typeof action.comments === 'string') {
              const parsed = JSON.parse(action.comments);
              parsedComments = Array.isArray(parsed) ? parsed : [];
            } else if (Array.isArray(action.comments)) {
              parsedComments = action.comments;
            } else {
              parsedComments = [];
            }
          } catch {
            // If parsing fails, treat as plain text
            parsedComments = [{ text: String(action.comments), time: "", author: "" }];
          }

          if (parsedComments.length === 0) return null;

          // Sort comments chronologically by time
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
                return timeA.localeCompare(timeB);
              }
              return dateA.getTime() - dateB.getTime();
            } catch {
              return timeA.localeCompare(timeB);
            }
          });

          return (
            <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Comments</h2>
              <div className="bg-gray-50 rounded p-4 max-h-48 overflow-y-auto space-y-3">
                {sortedComments.map((c, idx) => {
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
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <CreateCommentDialog
          onClose={() => setShowCommentDialog(false)}
          actionId={id}
          type="action"
          onSuccess={() => {
            // Reload action data to show new comment
            const fetchAction = async () => {
              try {
                const json = await get(`/api/actions/${id}`);
                if (json.error) {
                  throw new Error(json.error);
                }
                setAction(json.data);
              } catch (err) {
                console.error("Error fetching action:", err);
              }
            };
            fetchAction();
          }}
        />
      )}
    </>
  );
}

