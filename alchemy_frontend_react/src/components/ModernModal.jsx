import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modern modal component with click-outside-to-close and escape key support
 */
export default function ModernModal({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidth = "max-w-6xl",
  showCloseButton = true,
}) {
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

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200"
    >
      <div
        ref={modalRef}
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} max-h-[95vh] overflow-hidden flex flex-col border border-gray-200 animate-in zoom-in-95 duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-purple-50">
            <h2 className="text-xl font-bold text-violet-800">{title}</h2>
            {showCloseButton && (
              <button
                className="p-2 rounded-lg hover:bg-violet-100 text-violet-600 hover:text-violet-800 transition-colors"
                onClick={onClose}
                aria-label="Close"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        <div className="px-6 py-4 overflow-y-auto flex-1 bg-white">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-gray-100">{footer}</div>
        )}
      </div>
    </div>
  );
}

