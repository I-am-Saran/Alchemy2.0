import React, { useEffect, useState, useRef } from "react";
import { X, FileEdit, ArrowLeft, ChevronDown } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, patch } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Loader from "./Loader";
import TaskViewDialog from "./TaskViewDialog";
import CreateCommentDialog from "./CreateCommentDialog";
import CreateTaskDialog from "../modules/Tasks/CreateTaskDialog";

export default function SecurityControlViewModal({ open, onClose, controlId, onEdit }) {
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, hasRole } = usePermissions();
  const [control, setControl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [viewingTaskId, setViewingTaskId] = useState(null);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('details');
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const statusDropdownRef = useRef(null);
  const modalRef = useRef(null);
  const backdropRef = useRef(null);
  const abortControllerRef = useRef(null);
  const tasksAbortControllerRef = useRef(null);
  const commentsAbortControllerRef = useRef(null);
  const fetchingControlIdRef = useRef(null);
  const fetchingTasksControlIdRef = useRef(null);
  const fetchingCommentsControlIdRef = useRef(null);

  // Check if user has privileged roles that can see all status options
  // Super Admin, Admin, Internal Auditor, and External Auditor can see all statuses
  const canSeeAllStatuses = hasRole('Super Admin') || hasRole('Admin') || 
                            hasRole('Internal Auditor') || hasRole('External Auditor');

  // Handle click outside and escape key
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (backdropRef.current && event.target === backdropRef.current) {
        onClose();
      }
      // Close status dropdown if clicking outside
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
        setShowStatusDropdown(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        if (showStatusDropdown) {
          setShowStatusDropdown(false);
        } else {
          onClose();
        }
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "unset";
    };
  }, [open, onClose, showStatusDropdown]);

  // Handle status update
  const handleStatusChange = async (newStatus) => {
    if (!control || !controlId) return;
    
    setUpdatingStatus(true);
    try {
      // Use the dedicated status update endpoint
      const json = await patch(`/api/security-controls/${controlId}/status`, { Status: newStatus });
      if (json.error) throw new Error(json.error);
      
      setControl({ ...control, Status: newStatus });
      setShowStatusDropdown(false);
      showToast("Status updated successfully", "success");
    } catch (err) {
      showToast(`Failed to update status: ${err.message}`, 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Available status options
  const statusOptions = canSeeAllStatuses
    ? [
        "Implemented",
        "Partially Implemented",
        "Not Implemented",
        "Need clarity",
        "Ready for review",
        "Non compliant"
      ]
    : [
        "Not Implemented",
        "Need clarity",
        "Ready for review",
        "Non compliant"
      ];

  useEffect(() => {
    // Cancel any pending request when component unmounts or dependencies change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      fetchingControlIdRef.current = null;
    };
  }, [open, controlId]);

  useEffect(() => {
    // Prevent duplicate fetches for the same controlId
    if (open && controlId && session && !sessionLoading) {
      // Skip if we're already fetching this exact controlId
      if (fetchingControlIdRef.current === controlId) {
        return;
      }

      // Only fetch if we don't already have this control loaded
      if (!control || control.id !== controlId) {
        // Cancel any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // Mark that we're fetching this controlId
        fetchingControlIdRef.current = controlId;
        
        // Create new AbortController for this request
        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        
        const fetchControl = async () => {
          setLoading(true);
          setError("");
          try {
            const json = await get(`/api/security-controls/${controlId}`, { signal });
            // Check if request was aborted
            if (signal.aborted) {
              fetchingControlIdRef.current = null;
              return;
            }
            
            if (json.error) throw new Error(json.error);
            setControl(json.data);
            setActiveTab('details'); // Reset to details tab when opening
            fetchingControlIdRef.current = null;
          } catch (err) {
            fetchingControlIdRef.current = null;
            // Don't show error if request was aborted
            if (err.name === 'AbortError' || signal.aborted) return;
            setError(err.message);
            showToast(`Failed to load security control: ${err.message}`, 'error');
          } finally {
            if (!signal.aborted) {
              setLoading(false);
            }
          }
        };
        fetchControl();
      } else {
        // We already have the control, just reset tab
        setActiveTab('details');
        fetchingControlIdRef.current = null;
      }
    } else if (!open) {
      // Cancel any pending requests when closing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      fetchingControlIdRef.current = null;
      setControl(null);
      setError("");
      setTasks([]);
      setComments([]);
      setActiveTab('details'); // Reset to details tab when closing
      setShowStatusDropdown(false); // Close status dropdown when closing modal
    }
  }, [open, controlId, session, sessionLoading]);

  // Load tasks only when tasks tab is active
  useEffect(() => {
    // Cancel any pending request when component unmounts or dependencies change
    return () => {
      if (tasksAbortControllerRef.current) {
        tasksAbortControllerRef.current.abort();
        tasksAbortControllerRef.current = null;
      }
      fetchingTasksControlIdRef.current = null;
    };
  }, [open, controlId, activeTab]);

  useEffect(() => {
    // Only fetch tasks when tasks tab is active
    if (open && controlId && session && !sessionLoading && activeTab === 'tasks') {
      // Skip if we're already fetching tasks for this controlId
      if (fetchingTasksControlIdRef.current === controlId) {
        return;
      }

      // Cancel any previous request
      if (tasksAbortControllerRef.current) {
        tasksAbortControllerRef.current.abort();
      }

      // Mark that we're fetching tasks for this controlId
      fetchingTasksControlIdRef.current = controlId;

      // Create new AbortController for this request
      tasksAbortControllerRef.current = new AbortController();
      const signal = tasksAbortControllerRef.current.signal;

      const loadTasks = async () => {
        try {
          const json = await get(`/api/tasks/control/${encodeURIComponent(controlId)}`, { signal });
          // Check if request was aborted
          if (signal.aborted) {
            fetchingTasksControlIdRef.current = null;
            return;
          }
          
          if (json.error) throw new Error(json.error);
          setTasks(Array.isArray(json.data) ? json.data : []);
          fetchingTasksControlIdRef.current = null;
        } catch (e) {
          fetchingTasksControlIdRef.current = null;
          // Don't log error if request was aborted
          if (e.name === 'AbortError' || signal.aborted) return;
          console.error("Load tasks failed", e);
          setTasks([]);
        }
      };
      loadTasks();
    } else if (!open || activeTab !== 'tasks') {
      // Cancel any pending requests when closing or switching tabs
      if (tasksAbortControllerRef.current) {
        tasksAbortControllerRef.current.abort();
        tasksAbortControllerRef.current = null;
      }
      if (!open) {
        fetchingTasksControlIdRef.current = null;
        setTasks([]);
      }
    }
  }, [open, controlId, session, sessionLoading, activeTab]);

  // Load comments only when comments tab is active
  useEffect(() => {
    // Cancel any pending request when component unmounts or dependencies change
    return () => {
      if (commentsAbortControllerRef.current) {
        commentsAbortControllerRef.current.abort();
        commentsAbortControllerRef.current = null;
      }
      fetchingCommentsControlIdRef.current = null;
    };
  }, [open, controlId, activeTab]);

  useEffect(() => {
    // Only fetch comments when comments tab is active
    if (open && controlId && session && !sessionLoading && activeTab === 'comments') {
      // Skip if we're already fetching comments for this controlId
      if (fetchingCommentsControlIdRef.current === controlId) {
        return;
      }

      // Cancel any previous request
      if (commentsAbortControllerRef.current) {
        commentsAbortControllerRef.current.abort();
      }

      // Mark that we're fetching comments for this controlId
      fetchingCommentsControlIdRef.current = controlId;

      // Create new AbortController for this request
      commentsAbortControllerRef.current = new AbortController();
      const signal = commentsAbortControllerRef.current.signal;

      const loadComments = async () => {
        setCommentsLoading(true);
        try {
          const json = await get(`/api/security-controls/${controlId}/comments`, { signal });
          // Check if request was aborted
          if (signal.aborted) {
            fetchingCommentsControlIdRef.current = null;
            return;
          }
          
          if (json.error) throw new Error(json.error);
          setComments(Array.isArray(json.data) ? json.data : []);
          fetchingCommentsControlIdRef.current = null;
        } catch (e) {
          fetchingCommentsControlIdRef.current = null;
          // Don't log error if request was aborted
          if (e.name === 'AbortError' || signal.aborted) return;
          console.error("Load comments failed", e);
          setComments([]);
        } finally {
          if (!signal.aborted) {
            setCommentsLoading(false);
          }
        }
      };
      loadComments();
    } else if (!open || activeTab !== 'comments') {
      // Cancel any pending requests when closing or switching tabs
      if (commentsAbortControllerRef.current) {
        commentsAbortControllerRef.current.abort();
        commentsAbortControllerRef.current = null;
      }
      if (!open) {
        fetchingCommentsControlIdRef.current = null;
        setComments([]);
      }
    }
  }, [open, controlId, session, sessionLoading, activeTab]);


  if (!open) return null;

  return (
    <>
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 animate-in fade-in duration-200"
      >
        <div
          ref={modalRef}
          className="bg-white rounded-xl shadow-2xl w-full max-w-full overflow-hidden flex flex-col border border-gray-100 animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
          style={{ width: '98vw', maxHeight: '98vh', height: '98vh' }}
        >
          {/* Header - Fixed */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50 flex-shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Security Control Details</h2>
              {control && (
                <p className="text-xs text-gray-500 mt-0.5">
                  ID: <span className="font-semibold" style={{ color: THEME_COLORS.darkTeal }}>{control.id}</span>
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-violet-100 text-violet-600 hover:text-violet-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto bg-white px-4 py-4 text-gray-800" style={{ minHeight: 0 }}>
          {loading ? (
            <div className="p-6 text-center">
              <Loader message="Loading security control..." />
            </div>
          ) : error || !control ? (
            <div className="p-6 text-center text-red-600">
              {error || "Security control not found"}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header with Control Information and Action Buttons */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-100 p-4">
                <div className="flex justify-between items-start gap-4 flex-wrap">
                  {/* Control Information */}
                  <div className="flex-1 min-w-0">
                    <h1 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-blue-200">Control Information</h1>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">ID</label>
                        <p className="text-sm font-medium text-gray-900 break-all">{control.id || "—"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Owner</label>
                        <p className="text-sm font-medium text-gray-900 break-all">{control.owner || "—"}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Last Review Date</label>
                        <p className="text-sm font-medium text-gray-900">
                          {control.Review_Date ? control.Review_Date.replaceAll("/", "-") : (control.last_review_date ? String(control.last_review_date).replace("T", " ").substring(0, 19) : "Not Reviewed")}
                        </p>
                      </div>
                      <div className="md:col-span-3">
                        <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Description</label>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{control.description || control.Description || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 flex-shrink-0">
                    <button
                      onClick={onClose}
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
                    {hasPermission('security_controls', 'update') && onEdit && (
                      <button
                        onClick={() => {
                          onClose();
                          onEdit(controlId);
                        }}
                        className="px-5 py-2 text-white font-semibold rounded-lg transition-all shadow-sm hover:shadow-md flex items-center gap-2"
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
                        <FileEdit className="w-4 h-4" />
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
                      ➕ Add Task
                    </button>
                    {/* Change Status Dropdown */}
                    <div className="relative" ref={statusDropdownRef}>
                      <button
                        onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                        disabled={updatingStatus}
                        className="px-4 py-2 text-white rounded-lg transition-all font-medium shadow-sm hover:shadow-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                        }}
                        onMouseEnter={(e) => {
                          if (!updatingStatus) {
                            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!updatingStatus) {
                            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`;
                          }
                        }}
                      >
                        Change Status
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      
                      {showStatusDropdown && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-64 overflow-y-auto">
                          <div className="py-1">
                            {statusOptions.map((status) => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(status)}
                                disabled={updatingStatus || control?.Status === status}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                                  control?.Status === status
                                    ? 'bg-blue-50 text-blue-700 font-semibold'
                                    : 'text-gray-700 hover:bg-gray-100'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                              >
                                {status}
                                {control?.Status === status && (
                                  <span className="ml-2 text-blue-600">✓</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

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
                </div>
              </div>

              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <div className="flex gap-1">
                  <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 font-medium text-sm transition-all ${
                      activeTab === 'details'
                        ? 'border-b-2 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={
                      activeTab === 'details'
                        ? { borderBottomColor: THEME_COLORS.darkTeal }
                        : {}
                    }
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setActiveTab('tasks')}
                    className={`px-4 py-2 font-medium text-sm transition-all ${
                      activeTab === 'tasks'
                        ? 'border-b-2 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={
                      activeTab === 'tasks'
                        ? { borderBottomColor: THEME_COLORS.darkTeal }
                        : {}
                    }
                  >
                    Tasks
                  </button>
                  <button
                    onClick={() => setActiveTab('comments')}
                    className={`px-4 py-2 font-medium text-sm transition-all ${
                      activeTab === 'comments'
                        ? 'border-b-2 text-gray-900'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                    style={
                      activeTab === 'comments'
                        ? { borderBottomColor: THEME_COLORS.darkTeal }
                        : {}
                    }
                  >
                    Comments
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'details' && (
                <>
                  {/* Main Content - Grid Layout - Condensed */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Basic Information */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg shadow-sm border border-blue-100 p-4">
                  <h2 className="text-base font-semibold text-gray-900 mb-3 pb-2 border-b border-blue-200">Basic Information</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">S.No</label>
                      <p className="text-sm font-medium text-gray-900">{control.sno || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">ID</label>
                      <p className="text-sm font-medium text-gray-900 break-all">{control.id || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Owner</label>
                      <p className="text-sm font-medium text-gray-900 break-all">{control.owner || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Department</label>
                      <p className="text-sm font-medium text-gray-900">{control.department || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Audit Owner</label>
                      <p className="text-sm font-medium text-gray-900 break-all">{control.audit_owner || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Domain</label>
                      <p className="text-sm font-medium text-gray-900">{control.control_domain || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Priority</label>
                      <p className="mt-1">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-semibold text-xs ${
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
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Status</label>
                      <p className="text-sm font-medium text-gray-900">{control.Status || "—"}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Responsible Team</label>
                      <p className="text-sm font-medium text-gray-900">{control.reponsible_team || control.responsible_team || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Compliance Information */}
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Compliance Standards</h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">ISO 27001</span>
                      <span className="font-medium text-gray-900 text-sm">{control.ISO_27001 || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">NIST CSF</span>
                      <span className="font-medium text-gray-900 text-sm">{control.NIST_CSF || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">SOC 2</span>
                      <span className="font-medium text-gray-900 text-sm">{control.SOC_2 || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">GDPR</span>
                      <span className="font-medium text-gray-900 text-sm">{control.GDPR || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">IT Act 2000</span>
                      <span className="font-medium text-gray-900 text-sm">{control.IT_Act_2000 || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">PCI DSS</span>
                      <span className="font-medium text-gray-900 text-sm">{control.PCI_DSS || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">HIPAA</span>
                      <span className="font-medium text-gray-900 text-sm">{control.HIPAA || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-700 text-sm">Audit Review Status</span>
                      <span className="font-medium text-gray-900 text-sm">{control.Audit_Review_Status || "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description & Requirement - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.description || control.Description || "—"}</p>
                  </div>
                </div>
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Requirement</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.requirement || control.Requirement || "—"}</p>
                </div>
              </div>

              {/* Observations & Analyze Comments - Side by Side */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Observations / Action Items</h3>
                  <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.observations_action_item || "—"}</p>
                </div>
                {control.analyze_comments && (
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Analyze Comments</h2>
                    <div className="prose prose-sm max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.analyze_comments || "—"}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Plan / Do / Check / Act - 2x2 Grid */}
              {(control.Plan || control.Do || control.Check || control.Act) && (
                <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">PDCA Cycle</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {control.Plan && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Plan</h3>
                        <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.Plan}</p>
                      </div>
                    )}
                    {control.Do && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Do</h3>
                        <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.Do}</p>
                      </div>
                    )}
                    {control.Check && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Check</h3>
                        <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.Check}</p>
                      </div>
                    )}
                    {control.Act && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Act</h3>
                        <p className="text-gray-700 whitespace-pre-wrap text-sm">{control.Act}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Review Information - Grid Layout */}
              <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Review Information</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Review Date</label>
                    <p className="mt-2 text-gray-900 text-sm">
                      {control.Review_Date ? control.Review_Date.replaceAll("/", "-") : "Not Reviewed"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Review Date (Timestamp)</label>
                    <p className="mt-2 text-gray-900 text-sm">
                      {control.last_review_date ? String(control.last_review_date).replace("T", " ").substring(0, 19) : "—"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Date</label>
                    <p className="mt-2 text-gray-900 text-sm">{control.Date || "—"}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Evidence</label>
                    <p className="mt-2 text-gray-900 text-sm">{control.evidence || "—"}</p>
                  </div>
                </div>
              </div>


                </>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  {/* Tasks Section */}
                  <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Tasks</h2>
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="min-w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Task Name</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Priority</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Type</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Status</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Assigned To</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Created At</th>
                            <th className="text-left px-3 py-2 text-gray-700 text-sm">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tasks.length === 0 && (
                            <tr>
                              <td className="px-3 py-2 text-gray-500 text-sm" colSpan={7}>No tasks for this control.</td>
                            </tr>
                          )}
                          {tasks.map((t) => (
                            <tr key={t.id} className="border-t">
                              <td className="px-3 py-2 text-sm">{t.task_name}</td>
                              <td className="px-3 py-2 text-sm">{t.task_priority || "—"}</td>
                              <td className="px-3 py-2 text-sm">{t.task_type || "—"}</td>
                              <td className="px-3 py-2 text-sm">{t.task_status || "—"}</td>
                              <td className="px-3 py-2 text-sm">{t.assigned_to || "—"}</td>
                              <td className="px-3 py-2 text-sm whitespace-nowrap">
                                {t.created_at ? String(t.created_at).replace("T", " ").substring(0, 19) : "—"}
                              </td>
                              <td className="px-3 py-2">
                                {hasPermission('tasks', 'retrieve') && (
                                  <button
                                    className="p-1.5 rounded text-white transition-all text-sm"
                                    style={{
                                      background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.mediumTeal})`,
                                    }}
                                    onClick={() => setViewingTaskId(t.id)}
                                    title="View"
                                  >
                                    View
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'comments' && (
                <div className="space-y-4">
                  {/* Comments */}
                  {commentsLoading ? (
                    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                      <h2 className="text-xl font-semibold text-gray-900 mb-4">Comments</h2>
                      <Loader message="Loading comments..." />
                    </div>
                  ) : (() => {
                    if (comments.length === 0) {
                      return (
                        <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                          <h2 className="text-xl font-semibold text-gray-900 mb-4">Comments</h2>
                          <p className="text-gray-500 text-sm">No comments available.</p>
                        </div>
                      );
                    }

                    const sortedComments = [...comments].sort((a, b) => {
                      const timeA = a.time || '';
                      const timeB = b.time || '';
                      if (!timeA && !timeB) return 0;
                      if (!timeA) return 1;
                      if (!timeB) return -1;
                      try {
                        const dateA = new Date(timeA);
                        const dateB = new Date(timeB);
                        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                          return timeB.localeCompare(timeA);
                        }
                        return dateB.getTime() - dateA.getTime();
                      } catch {
                        return timeB.localeCompare(timeA);
                      }
                    });

                    return (
                      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Comments</h2>
                        <div className="bg-gray-50 rounded p-4 max-h-[calc(98vh-300px)] overflow-y-auto space-y-3">
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
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Comment Dialog */}
      {showCommentDialog && (
        <CreateCommentDialog
          onClose={() => setShowCommentDialog(false)}
          controlId={controlId}
          onSuccess={async () => {
            // Refresh comments if comments tab is active
            if (activeTab === 'comments') {
              const commentsJson = await get(`/api/security-controls/${controlId}/comments`);
              if (!commentsJson.error) setComments(Array.isArray(commentsJson.data) ? commentsJson.data : []);
            }
          }}
        />
      )}

      {/* Task Dialog */}
      {showTaskDialog && (
        <CreateTaskDialog
          onClose={() => setShowTaskDialog(false)}
          controlId={controlId}
          controlUuid={control?.uuid || control?.control_uuid || null}
          onSuccess={async () => {
            // Refresh tasks if tasks tab is active
            if (activeTab === 'tasks') {
              const tasksJson = await get(`/api/tasks/control/${encodeURIComponent(controlId)}`);
              if (!tasksJson.error) setTasks(Array.isArray(tasksJson.data) ? tasksJson.data : []);
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

