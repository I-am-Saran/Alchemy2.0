import React, { useEffect, useState } from "react";
import FormField from "../components/FormField";
import GlossyButton from "../components/GlossyButton";
import { useNavigate, useParams } from "react-router-dom";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { get, post, put } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import Loader from "../components/Loader";

const CERTIFICATION_TYPES = [
  "ISO 27001",
  "ISO 27017",
  "ISO 27018",
  "SOC 2 Type I",
  "SOC 2 Type II",
  "GDPR",
  "PCI DSS",
  "HIPAA",
  "NIST CSF",
  "CIS Controls",
  "FedRAMP",
  "CCPA",
  "Other",
];

const STATUS_OPTIONS = [
  "Active",
  "Expired",
  "Pending",
  "Renewal Due",
  "Suspended",
  "Revoked",
];

export default function CertificationForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const { session, loading: sessionLoading } = useSession();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [certificationType, setCertificationType] = useState("ISO 27001");
  const [version, setVersion] = useState("");
  const [status, setStatus] = useState("Active");
  const [issueDate, setIssueDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [certifyingBody, setCertifyingBody] = useState("");
  const [certificateNumber, setCertificateNumber] = useState("");
  const [scope, setScope] = useState("");
  const [notes, setNotes] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [loading, setLoading] = useState(!!editId);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCertification = async () => {
      if (!editId || !session) return;
      setLoading(true);
      try {
        const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
        const json = await get(`/api/certifications/${editId}?tenant_id=${encodeURIComponent(tenant_id)}`);
        if (json.error) throw new Error(json.error);
        const found = json.data || null;
        if (!found) throw new Error("Certification not found");
        
        setName(found.name || "");
        setDescription(found.description || "");
        setCertificationType(found.certification_type || "ISO 27001");
        setVersion(found.version || "");
        setStatus(found.status || "Active");
        setIssueDate(found.issue_date || "");
        setExpiryDate(found.expiry_date || "");
        setRenewalDate(found.renewal_date || "");
        setCertifyingBody(found.certifying_body || "");
        setCertificateNumber(found.certificate_number || "");
        setScope(found.scope || "");
        setNotes(found.notes || "");
        setAttachmentUrl(found.attachment_url || "");
      } catch (e) {
        showToast("Failed to load certification: " + e.message, 'error');
        navigate("/certifications");
      } finally {
        setLoading(false);
      }
    };
    if (!sessionLoading && session) fetchCertification();
  }, [editId, sessionLoading, session, navigate, showToast]);

  const onSave = async (e) => {
    e.preventDefault();
    if (!session) return;
    
    // Check permissions
    if (editId) {
      if (!hasPermission('certifications', 'update')) {
        showToast('You do not have permission to update certifications', 'error');
        return;
      }
    } else {
      if (!hasPermission('certifications', 'create')) {
        showToast('You do not have permission to create certifications', 'error');
        return;
      }
    }
    
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        certification_type: certificationType,
        version,
        status,
        issue_date: issueDate || null,
        expiry_date: expiryDate || null,
        renewal_date: renewalDate || null,
        certifying_body: certifyingBody,
        certificate_number: certificateNumber,
        scope,
        notes,
        attachment_url: attachmentUrl,
        tenant_id: session.tenant_id || "00000000-0000-0000-0000-000000000001",
      };

      const tenant_id = session.tenant_id || "00000000-0000-0000-0000-000000000001";
      
      if (editId) {
        const json = await put(`/api/certifications/${editId}?tenant_id=${encodeURIComponent(tenant_id)}`, payload);
        if (json.error) throw new Error(json.error);
        showToast("Certification updated successfully", 'success');
      } else {
        const json = await post(`/api/certifications`, payload);
        if (json.error) throw new Error(json.error);
        showToast("Certification created successfully", 'success');
      }

      navigate("/certifications");
    } catch (e) {
      showToast(`Failed to save certification: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (sessionLoading || loading) {
    return <Loader message="Loading certification form..." />;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800 mb-2">
          {editId ? "Edit Certification" : "Create Certification"}
        </h1>
        <button
          onClick={() => navigate("/certifications")}
          className="text-gray-600 hover:text-gray-800"
        >
          ← Back to Certifications
        </button>
      </div>

      <form onSubmit={onSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label="Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g., ISO 27001:2022 Certification"
          />

          <FormField
            label="Certification Type *"
            type="select"
            value={certificationType}
            onChange={(e) => setCertificationType(e.target.value)}
            required
            options={CERTIFICATION_TYPES.map((type) => ({ value: type, label: type }))}
          />

          <FormField
            label="Version"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="e.g., 2022, v3.0"
          />

          <FormField
            label="Status *"
            type="select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            required
            options={STATUS_OPTIONS.map((status) => ({ value: status, label: status }))}
          />

          <FormField
            label="Issue Date"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />

          <FormField
            label="Expiry Date"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
          />

          <FormField
            label="Renewal Date"
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
          />

          <FormField
            label="Certifying Body"
            value={certifyingBody}
            onChange={(e) => setCertifyingBody(e.target.value)}
            placeholder="e.g., BSI, A-LIGN, etc."
          />

          <FormField
            label="Certificate Number"
            value={certificateNumber}
            onChange={(e) => setCertificateNumber(e.target.value)}
            placeholder="Certificate reference number"
          />

          <FormField
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="Scope of certification"
          />
        </div>

        <FormField
          label="Description"
          type="textarea"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Detailed description of the certification"
        />

        <FormField
          label="Notes"
          type="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Additional notes or comments"
        />

        <FormField
          label="Attachment URL"
          value={attachmentUrl}
          onChange={(e) => setAttachmentUrl(e.target.value)}
          placeholder="URL to certificate document"
        />

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            onClick={() => navigate("/certifications")}
            className="px-6 py-2.5 rounded-lg bg-gray-500 hover:bg-gray-600 text-white font-medium transition-all shadow-sm hover:shadow-md"
          >
            Cancel
          </button>
          <GlossyButton
            type="submit"
            disabled={saving || !name || !certificationType || !status}
            className="px-6 py-2.5"
          >
            {saving ? "Saving..." : editId ? "Update" : "Create"}
          </GlossyButton>
        </div>
      </form>
    </div>
  );
}

