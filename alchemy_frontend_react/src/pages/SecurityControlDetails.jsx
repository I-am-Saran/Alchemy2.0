import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import CreateCommentDialog from "../components/CreateCommentDialog";
import CreateTaskDialog from "../modules/Tasks/CreateTaskDialog";
import TaskViewDialog from "../components/TaskViewDialog";
import Loader from "../components/Loader";

export default function SecurityControlDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [actions, setActions] = useState([]);
  const [viewingTaskId, setViewingTaskId] = useState(null);

  useEffect(() => {
    if (sessionLoading) return;

    const fetchControl = async () => {
      try {
        const json = await get(`/api/security-controls/${id}`);
        if (json.error) {
          throw new Error(json.error);
        }
        setControl(json.data);
      } catch (err) {
        console.error("Error fetching control:", err);
        setError(err.message);
        showToast(`Failed to load security control: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchControl();
  }, [id, sessionLoading]);

  // Load tasks for this control
  useEffect(() => {
    const loadTasks = async () => {
      if (!session || sessionLoading) return;
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
  }, [id, sessionLoading, session]);

  // Load actions for this control
  useEffect(() => {
    const loadActions = async () => {
      if (!session || sessionLoading) return;
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

  if (loading || sessionLoading) {
    return <Loader message="Loading security control details..." />;
  }

  if (error || !control) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Error</h2>
          <p className="text-red-700">{error || "Security control not found"}</p>
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
            Back to Security Controls
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
            <h1 className="text-3xl font-bold text-gray-900">Security Control Details</h1>
            <p className="text-gray-600 mt-1">ID: {control.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {hasPermission('security_controls', 'update') && (
              <button
                onClick={() => navigate(`/security-controls/${id}/edit`)}
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
              onClick={() => setShowTaskDialog(true)}
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
              Add Task
            </button>
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
                <label className="block text-sm font-medium text-gray-700">S.No</label>
                <p className="mt-1 text-gray-900">{control.sno || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ID</label>
                <p className="mt-1 text-gray-900">{control.id || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Owner</label>
                <p className="mt-1 text-gray-900">{control.owner || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Domain</label>
                <p className="mt-1 text-gray-900">{control.control_domain || "—"}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Priority</label>
                <p className="mt-1">
                  <span
                    className={`inline-block px-3 py-1 rounded-full font-semibold ${
                      control.Priority === "Critical"
                        ? "bg-red-100 text-red-800"
                        : control.Priority === "High"
                        ? "bg-orange-100 text-orange-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {control.Priority || "—"}
                  </span>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <p className="mt-1 text-gray-900">{control.Status || "—"}</p>
              </div>
            </div>
          </div>

          {/* Compliance Information */}
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Compliance Standards</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-700">ISO 27001</span>
                <span className="font-medium text-gray-900">{control.ISO_27001 || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">NIST CSF</span>
                <span className="font-medium text-gray-900">{control.NIST_CSF || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">SOC 2</span>
                <span className="font-medium text-gray-900">{control.SOC_2 || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">GDPR</span>
                <span className="font-medium text-gray-900">{control.GDPR || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">IT Act 2000</span>
                <span className="font-medium text-gray-900">{control.IT_Act_2000 || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">PCI DSS</span>
                <span className="font-medium text-gray-900">{control.PCI_DSS || "—"}</span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="text-gray-700">HIPAA</span>
                <span className="font-medium text-gray-900">{control.HIPAA || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
          <div className="prose prose-sm max-w-none">
            <p className="text-gray-700 whitespace-pre-wrap">{control.description || control.Description || "—"}</p>
          </div>
        </div>

        {/* Requirement & Observations */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirement</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{control.requirement || control.Requirement || "—"}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Observations / Action Items</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{control.observations_action_item || "—"}</p>
          </div>
        </div>

        {/* Analyze Comments */}
        {control.analyze_comments && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Analyze Comments</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-gray-700 whitespace-pre-wrap">{control.analyze_comments || "—"}</p>
            </div>
          </div>
        )}

        {/* Plan / Do / Check / Act */}
        {(control.Plan || control.Do || control.Check || control.Act) && (
          <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">PDCA Cycle</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {control.Plan && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{control.Plan}</p>
                </div>
              )}
              {control.Do && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Do</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{control.Do}</p>
                </div>
              )}
              {control.Check && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Check</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{control.Check}</p>
                </div>
              )}
              {control.Act && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Act</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{control.Act}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Review Information */}
        <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Review Date</label>
              <p className="mt-2 text-gray-900 font-medium">
                {control.Review_Date ? control.Review_Date.replaceAll("/", "-") : "Not Reviewed"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Last Review Date (Timestamp)</label>
              <p className="mt-2 text-gray-900">
                {control.last_review_date ? String(control.last_review_date).replace("T", " ").substring(0, 19) : "—"}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Date</label>
              <p className="mt-2 text-gray-900">{control.Date || "—"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Audit Review Status</label>
              <p className="mt-2 text-gray-900">{control.Audit_Review_Status || control.audit_review_status || "—"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Responsible Team</label>
              <p className="mt-2 text-gray-900">{control.reponsible_team || control.responsible_team || "—"}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Evidence</label>
              <p className="mt-2 text-gray-900">{control.evidence || "—"}</p>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
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
                </tr>
              </thead>
              <tbody>
                {actions.length === 0 && (
                  <tr>
                    <td className="px-3 py-2 text-gray-500" colSpan={6}>No actions for this control.</td>
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tasks Section */}
        <div className="mt-6 bg-white rounded-lg shadow-md border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Tasks</h2>
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
                    <td className="px-3 py-2">{t.task_priority || "—"}</td>
                    <td className="px-3 py-2">{t.task_type || "—"}</td>
                    <td className="px-3 py-2">{t.control_stage || "—"}</td>
                    <td className="px-3 py-2">{t.task_status || "—"}</td>
                    <td className="px-3 py-2">{t.assigned_to || "—"}</td>
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
                        {hasPermission('tasks', 'retrieve') && (
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
                            onClick={() => setViewingTaskId(t.id)}
                            title="View"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-eye" aria-hidden="true">
                              <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"></path>
                              <circle cx="12" cy="12" r="3"></circle>
                            </svg>
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

        {/* Comments */}
        {control.Comments && (() => {
          // Parse comments - could be string, array, or object
          let parsedComments = [];
          try {
            if (typeof control.Comments === 'string') {
              const parsed = JSON.parse(control.Comments);
              parsedComments = Array.isArray(parsed) ? parsed : [];
            } else if (Array.isArray(control.Comments)) {
              parsedComments = control.Comments;
            } else {
              parsedComments = [];
            }
          } catch {
            // If parsing fails, treat as plain text
            parsedComments = [{ text: String(control.Comments), time: "", author: "" }];
          }

          if (parsedComments.length === 0) return null;

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
          controlId={id}
          onSuccess={() => {
            // Reload control data to show new comment
            const fetchControl = async () => {
              try {
                const json = await get(`/api/security-controls/${id}`);
                if (json.error) {
                  throw new Error(json.error);
                }
                setControl(json.data);
              } catch (err) {
                console.error("Error fetching control:", err);
              }
            };
            fetchControl();
          }}
        />
      )}

      {/* Task Dialog */}
      {showTaskDialog && (
        <CreateTaskDialog
          onClose={() => setShowTaskDialog(false)}
          controlId={id}
          controlUuid={control?.uuid || control?.control_uuid || null}
          onSuccess={async () => {
            // Reload control data and tasks
            try {
              const [controlJson, tasksJson] = await Promise.all([
                get(`/api/security-controls/${id}`),
                get(`/api/tasks/control/${encodeURIComponent(id)}`)
              ]);
              if (!controlJson.error) {
                setControl(controlJson.data);
              }
              if (!tasksJson.error) {
                setTasks(Array.isArray(tasksJson.data) ? tasksJson.data : []);
              }
            } catch (err) {
              console.error("Error reloading data:", err);
            }
          }}
        />
      )}

      {/* Task View Dialog */}
      <TaskViewDialog
        open={!!viewingTaskId}
        onClose={() => setViewingTaskId(null)}
        taskId={viewingTaskId}
      />
    </>
  );
}
