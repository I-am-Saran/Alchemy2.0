import React from "react";
import Modal from "./Modal";
import { THEME_COLORS } from "../constants/colors";

export default function ActionViewDialog({ open, onClose, action }) {
  if (!action) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="View Action"
      confirmText="Close"
      onConfirm={onClose}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Action Name</label>
          <div className="text-gray-900">{action.action_name || "—"}</div>
        </div>
        
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
          <div className="text-gray-900 whitespace-pre-wrap">{action.action_description || "—"}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Priority</label>
            <div className="text-gray-900">{action.action_priority || "—"}</div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Status</label>
            <div className="text-gray-900">{action.action_status || "—"}</div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Type</label>
            <div className="text-gray-900">{action.action_type || "—"}</div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Assigned To</label>
            <div className="text-gray-900">{action.assigned_to || "—"}</div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Due Date</label>
            <div className="text-gray-900">
              {action.due_date ? new Date(action.due_date).toLocaleDateString() : "—"}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Created At</label>
            <div className="text-gray-900">
              {action.created_at ? new Date(action.created_at).toLocaleString() : "—"}
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
          <div className="text-gray-900 whitespace-pre-wrap">{action.notes || "—"}</div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Comments</label>
          <div className="text-gray-900 whitespace-pre-wrap">{action.comments || "—"}</div>
        </div>
      </div>
    </Modal>
  );
}





