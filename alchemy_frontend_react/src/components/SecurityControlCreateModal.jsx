import React, { useState, useEffect } from "react";
import { Dialog, DialogHeader, DialogBody, DialogFooter } from "@material-tailwind/react";
import { Save } from "lucide-react";
import { useSession } from "../contexts/SessionContext";
import { useToast } from "../contexts/ToastContext";
import { usePermissions } from "../hooks/usePermissions";
import { post } from "../services/api";
import { THEME_COLORS } from "../constants/colors";
import UserAutocomplete from "./UserAutocomplete";
import Loader from "./Loader";
import Button from "./ui/Button";

export default function SecurityControlCreateModal({ open, onClose, onSuccess, certification }) {
  const { session } = useSession();
  const { showToast } = useToast();
  const { hasPermission, hasRole, loading: permissionsLoading } = usePermissions();
  
  // Check if user has privileged roles that can see all status options
  // Super Admin, Admin, Internal Auditor, and External Auditor can see all statuses
  const canSeeAllStatuses = hasRole('Super Admin') || hasRole('Admin') || 
                            hasRole('Internal Auditor') || hasRole('External Auditor');
  const [control, setControl] = useState({
    sno: "",
    id: "",
    owner: "",
    department: "",
    audit_owner: "",
    control_domain: "",
        Priority: "Medium",
        Status: "",
    responsible_team: "",
    requirement: "",
    ISO_27001: "",
    NIST_CSF: "",
    SOC_2: "",
    GDPR: "",
    IT_Act_2000: "",
    PCI_DSS: "",
    HIPAA: "",
    Audit_Review_Status: "",
    evidence: "",
    description: "",
    analyze_comments: "",
    observations_action_item: "",
    Plan: "",
    Do: "",
    Check: "",
    Act: "",
    certification: certification || "",
    tenant_id: session?.tenant_id || "00000000-0000-0000-0000-000000000001",
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      setControl(prev => ({
        ...prev,
        certification: certification || "",
        tenant_id: session?.tenant_id || "00000000-0000-0000-0000-000000000001",
        // Set default Status based on role if not already set
        Status: prev.Status || (canSeeAllStatuses ? "Implemented" : "Not Implemented"),
      }));
    } else {
      // Reset form when closing
      setControl({
        sno: "",
        id: "",
        owner: "",
        department: "",
        audit_owner: "",
        control_domain: "",
        Priority: "Medium",
        Status: canSeeAllStatuses ? "Implemented" : "Not Implemented",
        responsible_team: "",
        requirement: "",
        ISO_27001: "",
        NIST_CSF: "",
        SOC_2: "",
        GDPR: "",
        IT_Act_2000: "",
        PCI_DSS: "",
        HIPAA: "",
        Audit_Review_Status: "",
        evidence: "",
        description: "",
        analyze_comments: "",
        observations_action_item: "",
        Plan: "",
        Do: "",
        Check: "",
        Act: "",
        certification: certification || "",
        tenant_id: session?.tenant_id || "00000000-0000-0000-0000-000000000001",
      });
    }
  }, [open, certification, session, canSeeAllStatuses]);

  const handleChange = (field, value, userObject = null) => {
    setControl(prev => {
      const updated = { ...prev, [field]: value };
      // Auto-populate department when owner is set
      if (field === "owner" && userObject && userObject.department) {
        updated.department = userObject.department;
      }
      return updated;
    });
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleSave = async () => {
    if (!control) return;
    
    // Validate required fields
    const nextErrors = {};
    if (!control.certification || !control.certification.trim()) {
      nextErrors.certification = "Certification is required";
    }
    if (!control.description || !control.description.trim()) {
      nextErrors.description = "Description is required";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      showToast("Please fill in the required fields", "error");
      return;
    }
    
    setSaving(true);
    try {
      const json = await post(`/api/security-controls`, control);
      if (json.error) throw new Error(json.error);
      showToast("Security control created successfully", "success");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      showToast(`Failed to create: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog 
      open={open} 
      handler={onClose} 
      dismiss={{ enabled: true }} 
      className="z-50"
      style={{ maxWidth: '98vw', width: '98vw', maxHeight: '98vh', height: '98vh' }}
    >
      <DialogHeader className="text-base text-violet-800 font-semibold bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-200 px-4 py-3 flex-shrink-0">
        Create Security Control
      </DialogHeader>
      <DialogBody className="w-full max-w-full overflow-y-auto bg-white px-4 py-4 text-gray-800" style={{ flex: '1 1 auto', minHeight: 0, maxHeight: 'calc(98vh - 120px)' }}>
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-gray-700 border-b border-gray-200 pb-2">
            Control Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* S.No */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">S.No</label>
              <input
                type="text"
                value={control.sno || ""}
                onChange={(e) => handleChange("sno", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* ID - Optional, will be auto-generated if not provided */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">ID (Optional)</label>
              <input
                type="text"
                value={control.id || ""}
                onChange={(e) => handleChange("id", e.target.value)}
                placeholder="Auto-generated if empty"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Certification - Required */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                Certification <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={control.certification || ""}
                onChange={(e) => handleChange("certification", e.target.value)}
                placeholder="Enter certification name"
                required
                className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 ${errors.certification ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-purple-500 focus:border-purple-500"}`}
              />
              {errors.certification && (
                <p className="text-xs text-red-600 mt-1">{errors.certification}</p>
              )}
            </div>

            {/* Owner */}
            <UserAutocomplete
              label="Owner"
              value={control.owner || ""}
              onChange={(value, userObject) => handleChange("owner", value, userObject)}
              placeholder="Search by email..."
              fieldType="assignee"
            />

            {/* Department - Auto-populated from Owner */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Department</label>
              <input
                type="text"
                value={control.department || ""}
                readOnly
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-gray-100 text-gray-600"
                placeholder="Auto-populated from owner"
              />
            </div>

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
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Control Domain</label>
              <input
                type="text"
                value={control.control_domain || ""}
                onChange={(e) => handleChange("control_domain", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Priority</label>
              <select
                value={control.Priority || "Medium"}
                onChange={(e) => handleChange("Priority", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Status</label>
              <select
                value={control.Status || ""}
                onChange={(e) => handleChange("Status", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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

            {/* Responsible Team */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Responsible Team</label>
              <input
                type="text"
                value={control.responsible_team || ""}
                onChange={(e) => handleChange("responsible_team", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Requirement */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Requirement</label>
              <input
                type="text"
                value={control.requirement || ""}
                onChange={(e) => handleChange("requirement", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* ISO 27001 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">ISO 27001</label>
              <input
                type="text"
                value={control.ISO_27001 || ""}
                onChange={(e) => handleChange("ISO_27001", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* NIST CSF */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">NIST CSF</label>
              <input
                type="text"
                value={control.NIST_CSF || ""}
                onChange={(e) => handleChange("NIST_CSF", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* SOC 2 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">SOC 2</label>
              <input
                type="text"
                value={control.SOC_2 || ""}
                onChange={(e) => handleChange("SOC_2", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* GDPR */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">GDPR</label>
              <input
                type="text"
                value={control.GDPR || ""}
                onChange={(e) => handleChange("GDPR", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* IT Act 2000 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">IT Act 2000</label>
              <input
                type="text"
                value={control.IT_Act_2000 || ""}
                onChange={(e) => handleChange("IT_Act_2000", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* PCI DSS */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">PCI DSS</label>
              <input
                type="text"
                value={control.PCI_DSS || ""}
                onChange={(e) => handleChange("PCI_DSS", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* HIPAA */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">HIPAA</label>
              <input
                type="text"
                value={control.HIPAA || ""}
                onChange={(e) => handleChange("HIPAA", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Audit Review Status */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Audit Review Status</label>
              <input
                type="text"
                value={control.Audit_Review_Status || ""}
                onChange={(e) => handleChange("Audit_Review_Status", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>

            {/* Evidence */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Evidence</label>
              <input
                type="text"
                value={control.evidence || ""}
                onChange={(e) => handleChange("evidence", e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={control.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              rows="3"
              required
              className={`w-full border rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 ${errors.description ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-purple-500 focus:border-purple-500"}`}
            />
            {errors.description && (
              <p className="text-xs text-red-600 mt-1">{errors.description}</p>
            )}
          </div>

          {/* Analyze Comments */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Analyze Comments</label>
            <textarea
              value={control.analyze_comments || ""}
              onChange={(e) => handleChange("analyze_comments", e.target.value)}
              rows="2"
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Observations / Action Item */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Observations / Action Item</label>
            <textarea
              value={control.observations_action_item || ""}
              onChange={(e) => handleChange("observations_action_item", e.target.value)}
              rows="2"
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Plan / Do / Check / Act */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Plan</label>
              <textarea
                value={control.Plan || ""}
                onChange={(e) => handleChange("Plan", e.target.value)}
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Do</label>
              <textarea
                value={control.Do || ""}
                onChange={(e) => handleChange("Do", e.target.value)}
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Check</label>
              <textarea
                value={control.Check || ""}
                onChange={(e) => handleChange("Check", e.target.value)}
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Act</label>
              <textarea
                value={control.Act || ""}
                onChange={(e) => handleChange("Act", e.target.value)}
                rows="2"
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter className="gap-2 px-4 py-3 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 flex-shrink-0">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button 
          variant="primary" 
          onClick={handleSave}
          disabled={saving}
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Creating..." : "Create Control"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
