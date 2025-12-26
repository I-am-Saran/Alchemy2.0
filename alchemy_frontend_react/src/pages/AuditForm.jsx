import React, { useEffect, useMemo, useState } from "react";
import FormField from "../components/FormField";
import GlossyButton from "../components/GlossyButton";
import UserAutocomplete from "../components/UserAutocomplete";
import Breadcrumb from "../components/Breadcrumb";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, post, put } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Loader from "../components/Loader";

export default function AuditForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: editId } = useParams();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission, userRoles, loading: permsLoading } = usePermissions();
  
  const isSuperAdmin = useMemo(() => {
    if (!userRoles || userRoles.length === 0) return false;
    return userRoles.some((userRole) => {
      const roleName = userRole?.roles?.role_name || userRole?.role_name || '';
      return roleName.toLowerCase() === 'super admin' || roleName.toLowerCase() === 'superadmin';
    });
  }, [userRoles]);
  
  const canUpdateAudit = !permsLoading && (isSuperAdmin || hasPermission('audits', 'update'));
  const canCreateAudit = !permsLoading && (isSuperAdmin || hasPermission('audits', 'create'));

  const [auditName, setAuditName] = useState("");
  const [auditNote, setAuditNote] = useState("");
  const [auditPriority, setAuditPriority] = useState("Low");
  const [auditType, setAuditType] = useState("Observation");
  const [auditStatus, setAuditStatus] = useState("Open");
  const [controlStage, setControlStage] = useState("");
  const [auditOwner, setAuditOwner] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);
  const [comments, setComments] = useState([]);
  const [newCommentText, setNewCommentText] = useState("");
  const isViewOnly = !!editId && location.pathname.startsWith('/audits/') && !location.pathname.startsWith('/audits/edit/');

  useEffect(() => {
    const fetchAudit = async () => {
      if (!editId || !session) return;
      setLoading(true);
      try {
        const json = await get(`/api/audits/${editId}`);
        if (json.error) throw new Error(json.error);
        const found = json.data || null;
        if (!found) throw new Error("Audit not found");
        setAuditName(found.audit_name || "");
        setAuditNote(found.audit_note || "");
        setAuditPriority(found.audit_priority || "Low");
        setAuditType(found.audit_type || "Observation");
        setAuditStatus(found.audit_status || "Open");
        setControlStage(found.control_stage || "");
        setAuditOwner(found.audit_owner || "");
        setAttachmentUrl(found.attachment || "");
        setComments(Array.isArray(found.comments) ? found.comments : []);
      } catch (e) {
        alert("Failed to load audit: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading) fetchAudit();
  }, [editId, sessionLoading, session]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!session) return;
    
    if (permsLoading) {
      showToast('Please wait while permissions are loading...', 'info');
      return;
    }
    
    if (editId) {
      if (!canUpdateAudit) {
        showToast('You do not have permission to update audits', 'error');
        return;
      }
    } else {
      if (!canCreateAudit) {
        showToast('You do not have permission to create audits', 'error');
        return;
      }
    }
    
    setSaving(true);
    try {
      const payload = {
        audit_name: auditName,
        audit_note: auditNote,
        audit_priority: auditPriority,
        audit_type: auditType,
        audit_status: auditStatus,
        control_stage: controlStage,
        audit_owner: auditOwner || "",
        attachment: attachmentUrl || "",
        comments: Array.isArray(comments) ? comments : [],
      };

      let auditId = editId;
      const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
      
      if (editId) {
        const json = await put(`/api/audits/${editId}?tenant_id=${encodeURIComponent(tenant_id)}`, payload);
        if (json.error) throw new Error(json.error);
        auditId = json.data?.id || editId;
      } else {
        const json = await post(`/api/audits`, payload);
        if (json.error) throw new Error(json.error);
        auditId = json.data?.id;
      }

      showToast('Audit saved successfully', 'success');
      navigate("/audits");
    } catch (err) {
      showToast(`Failed to save audit: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!sessionLoading && !permsLoading && session) {
      if (editId) {
        if (!canUpdateAudit) {
          showToast('You do not have permission to edit audits', 'error');
          navigate('/audits');
        }
      } else {
        if (!canCreateAudit) {
          showToast('You do not have permission to create audits', 'error');
          navigate('/audits');
        }
      }
    }
  }, [sessionLoading, permsLoading, session, editId, canUpdateAudit, canCreateAudit, navigate, showToast]);

  if (sessionLoading || loading || permsLoading) {
    return <Loader message="Loading audit form..." />;
  }

  if (session && (editId ? !canUpdateAudit : !canCreateAudit)) {
    return (
      <div className="p-6">
        <p className="text-gray-700">You do not have permission to {editId ? 'edit' : 'create'} audits.</p>
      </div>
    );
  }

  if (editId && isViewOnly) {
    return (
      <div className="p-6" style={{ overflowX: 'hidden', overflowY: 'auto', width: '100%', maxWidth: '100%', height: '100%' }}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-semibold text-gray-800">Audit Details</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate('/audits')}
              className="px-3 py-2 rounded-lg border"
              style={{ borderColor: THEME_COLORS.lightBlue, color: THEME_COLORS.darkTeal }}
            >
              Back
            </button>
            {canUpdateAudit && (
              <button
                type="button"
                onClick={() => navigate(`/audits/edit/${editId}`)}
                className="px-3 py-2 rounded-lg text-white"
                style={{ background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})` }}
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="mb-3">
              <div className="text-sm text-gray-600">Name</div>
              <div className="text-gray-900 font-medium">{auditName || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Priority</div>
              <div className="text-gray-900 font-medium">{auditPriority || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Type</div>
              <div className="text-gray-900 font-medium">{auditType || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Status</div>
              <div className="text-gray-900 font-medium">{auditStatus || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Control Stage</div>
              <div className="text-gray-900 font-medium">{controlStage || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Owner</div>
              <div className="text-gray-900 font-medium">{auditOwner || '—'}</div>
            </div>
            <div className="mb-3">
              <div className="text-sm text-gray-600">Attachment</div>
              {attachmentUrl ? (
                <a href={attachmentUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Open Attachment</a>
              ) : (
                <div className="text-gray-900 font-medium">—</div>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600 mb-2">Notes</div>
            <div className="text-gray-900 whitespace-pre-wrap">{auditNote || '—'}</div>
          </div>
        </div>

        {Array.isArray(comments) && comments.length > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-lg font-semibold mb-3">Comments</div>
            <div className="space-y-3">
              {comments.map((c, idx) => (
                <div key={idx} className="border rounded p-3">
                  <div className="text-sm text-gray-600">{c.author || 'Anonymous'}</div>
                  <div className="text-gray-900 whitespace-pre-wrap">{c.text || ''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <Breadcrumb
        items={[
          { label: "Audits", to: "/audits" },
          { label: editId ? "Edit Audit" : "Create Audit" },
        ]}
      />
      <div className="bg-white rounded-xl shadow-sm border" style={{ borderColor: THEME_COLORS.lightBlue }}>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4" style={{ color: THEME_COLORS.darkTeal }}>
            {editId ? "Edit Audit" : "Create Audit"}
          </h2>
          <form onSubmit={onSave}>
            <div className="row">
              <div className="col-6 mb-3">
                <FormField label="Audit Name" value={auditName} onChange={(e) => setAuditName(e.target.value)} placeholder="Audit name" required />
              </div>
              <div className="col-6 mb-3">
                <FormField
                  label="Audit Priority"
                  type="select"
                  value={auditPriority}
                  onChange={(val) => setAuditPriority(val)}
                  options={[
                    { label: "Low", value: "Low" },
                    { label: "Medium", value: "Medium" },
                    { label: "High", value: "High" },
                    { label: "Critical", value: "Critical" },
                  ]}
                />
              </div>
            </div>
            <div className="row">
              <div className="col-12 mb-3">
                <FormField label="Audit Note" type="textarea" value={auditNote} onChange={(e) => setAuditNote(e.target.value)} placeholder="Details, context, next steps" />
              </div>
            </div>
            <div className="row">
              <div className="col-6 mb-3">
                <FormField
                  label="Audit Type"
                  type="select"
                  value={auditType}
                  onChange={(val) => setAuditType(val)}
                  options={[
                    { label: "Observation", value: "Observation" },
                    { label: "Improvement", value: "Improvement" },
                    { label: "Compliance", value: "Compliance" },
                    { label: "Technical", value: "Technical" },
                    { label: "External", value: "External" },
                    { label: "Risk", value: "Risk" },
                    { label: "IGS", value: "IGS" },
                    { label: "Other", value: "Other" },
                  ]}
                />
              </div>
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
            </div>
            <div className="row">
              <div className="col-6 mb-3">
                <FormField
                  label="Audit Status"
                  type="select"
                  value={auditStatus}
                  onChange={(val) => setAuditStatus(val)}
                  options={[
                    { label: "Open", value: "Open" },
                    { label: "In Progress", value: "In Progress" },
                    { label: "Closed", value: "Closed" },
                    { label: "On Hold", value: "On Hold" },
                  ]}
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
              <div className="col-12 mb-3">
                <div>
                  <label className="block text-gray-700 font-medium mb-1">Attachment</label>
                  <input 
                    type="file" 
                    className="w-full border border-gray-300 rounded-lg px-3 py-2" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)} 
                  />
                  {attachmentUrl && (
                    <p className="text-sm text-gray-600 mt-1">
                      Current: <a className="text-violet-700 underline" href={attachmentUrl} target="_blank" rel="noreferrer">View</a>
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="row">
              <div className="col-12">
                <div className="flex gap-3 justify-end mt-4">
                  <button
                    type="button"
                    onClick={() => navigate("/audits")}
                    className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <GlossyButton
                    type="submit"
                    disabled={saving}
                    style={{
                      background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                    }}
                  >
                    {saving ? 'Saving...' : (editId ? 'Update Audit' : 'Create Audit')}
                  </GlossyButton>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}




