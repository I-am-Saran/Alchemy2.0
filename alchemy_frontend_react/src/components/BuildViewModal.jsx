import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

export default function BuildViewModal({ open, onClose, build }) {
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

  if (!open || !build) return null;

  // Format field names for display
  const formatFieldName = (key) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  // Fields to display (excluding internal fields)
  const excludeFields = [
    "tenant_id",
    "is_deleted",
    "deleted_at",
    "deleted_by",
    "created_at",
    "updated_at",
  ];

  const displayFields = Object.keys(build).filter(
    (key) => !excludeFields.includes(key)
  );

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-gray-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            Build Details - {build["Build ID"] || build.id || "N/A"}
          </h2>
          <button
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
            onClick={onClose}
            aria-label="Close"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayFields.map((key) => {
            const value = build[key];
            const displayValue =
              value === null || value === undefined || value === ""
                ? "—"
                : String(value);

            // Handle long text fields
            const isLongText =
              key.toLowerCase().includes("description") ||
              key.toLowerCase().includes("details") ||
              key.toLowerCase().includes("notes");

            return (
              <div
                key={key}
                className={isLongText ? "md:col-span-2" : ""}
              >
                <div className="text-sm font-medium text-gray-600 mb-1">
                  {formatFieldName(key)}
                </div>
                <div
                  className={`text-gray-800 ${
                    isLongText
                      ? "whitespace-pre-wrap break-words"
                      : "break-words"
                  }`}
                >
                  {displayValue}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end">
          <button
            className="px-6 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium transition-all shadow-sm hover:shadow-md"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

