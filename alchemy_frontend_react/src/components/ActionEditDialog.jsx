import React, { useState, useEffect } from "react";
import Modal from "./Modal";
import { THEME_COLORS } from "../constants/colors";
import FormField from "./FormField";
import UserAutocomplete from "./UserAutocomplete";
import { useToast } from "../contexts/ToastContext";
import { put, post } from "../services/api";

export default function ActionEditDialog({ open, onClose, action, controlId, onSave }) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    action_name: "",
    action_description: "",
    action_priority: "",
    action_status: "",
    action_type: "",
    assigned_to: "",
    due_date: "",
    notes: "",
    comments: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (action) {
      setFormData({
        action_name: action.action_name || "",
        action_description: action.action_description || "",
        action_priority: action.action_priority || "",
        action_status: action.action_status || "",
        action_type: action.action_type || "",
        assigned_to: action.assigned_to || "",
        due_date: action.due_date ? action.due_date.split("T")[0] : "",
        notes: action.notes || "",
        comments: action.comments || "",
      });
    } else {
      // New action
      setFormData({
        action_name: "",
        action_description: "",
        action_priority: "",
        action_status: "",
        action_type: "",
        assigned_to: "",
        due_date: "",
        notes: "",
        comments: "",
      });
    }
  }, [action, open]);

  const handleSave = async () => {
    if (!formData.action_name.trim()) {
      showToast("Action name is required", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        control_id: controlId,
        tenant_id: "00000000-0000-0000-0000-000000000001",
      };

      let result;
      if (action?.id) {
        // Update existing
        result = await put(`/api/actions/${action.id}?tenant_id=${payload.tenant_id}`, payload);
      } else {
        // Create new
        result = await post("/api/actions", payload);
      }

      if (result.error) {
        throw new Error(result.error.detail || result.error || "Failed to save action");
      }

      showToast(action?.id ? "Action updated successfully" : "Action created successfully", "success");
      if (onSave) {
        onSave();
      }
      onClose();
    } catch (err) {
      showToast(`Failed to save action: ${err.message}`, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={action?.id ? "Edit Action" : "Create Action"}
      confirmText={saving ? "Saving..." : "Save"}
      onConfirm={handleSave}
    >
      <div className="space-y-4">
        <FormField
          label="Action Name *"
          type="text"
          value={formData.action_name}
          onChange={(val) => setFormData(prev => ({ ...prev, action_name: val }))}
        />

        <FormField
          label="Description"
          type="textarea"
          value={formData.action_description}
          onChange={(val) => setFormData(prev => ({ ...prev, action_description: val }))}
          rows={4}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Priority"
            type="select"
            value={formData.action_priority}
            onChange={(val) => setFormData(prev => ({ ...prev, action_priority: val }))}
            options={[
              { label: "Low", value: "Low" },
              { label: "Medium", value: "Medium" },
              { label: "High", value: "High" },
              { label: "Critical", value: "Critical" },
            ]}
          />

          <FormField
            label="Status"
            type="select"
            value={formData.action_status}
            onChange={(val) => setFormData(prev => ({ ...prev, action_status: val }))}
            options={[
              { label: "Open", value: "Open" },
              { label: "In Progress", value: "In Progress" },
              { label: "Completed", value: "Completed" },
              { label: "On Hold", value: "On Hold" },
              { label: "Cancelled", value: "Cancelled" },
            ]}
          />

          <FormField
            label="Type"
            type="select"
            value={formData.action_type}
            onChange={(val) => setFormData(prev => ({ ...prev, action_type: val }))}
            options={[
              { label: "Corrective", value: "Corrective" },
              { label: "Preventive", value: "Preventive" },
              { label: "Improvement", value: "Improvement" },
              { label: "Other", value: "Other" },
            ]}
          />

          <FormField
            label="Due Date"
            type="date"
            value={formData.due_date}
            onChange={(val) => setFormData(prev => ({ ...prev, due_date: val }))}
          />
        </div>

        <UserAutocomplete
          label="Assigned To"
          value={formData.assigned_to}
          onChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
          placeholder="Search by email..."
          fieldType="assignee"
        />

        <FormField
          label="Notes"
          type="textarea"
          value={formData.notes}
          onChange={(val) => setFormData(prev => ({ ...prev, notes: val }))}
          rows={3}
        />

        <FormField
          label="Comments"
          type="textarea"
          value={formData.comments}
          onChange={(val) => setFormData(prev => ({ ...prev, comments: val }))}
          rows={3}
        />
      </div>
    </Modal>
  );
}





