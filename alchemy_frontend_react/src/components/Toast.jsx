import { useEffect, useState } from "react";
import { THEME_COLORS } from "../constants/colors";

export default function Toast({ type = "info", message = "", duration = 2500 }) {
  const [open, setOpen] = useState(Boolean(message));
  useEffect(() => {
    if (!message) return;
    setOpen(true);
    const t = setTimeout(() => setOpen(false), duration);
    return () => clearTimeout(t);
  }, [message, duration]);

  if (!open || !message) return null;

  const getTypeStyle = (toastType) => {
    switch (toastType) {
      case 'success':
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.mediumTealDark})`,
          color: '#ffffff',
        };
      case 'error':
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`,
          color: '#ffffff',
        };
      case 'warning':
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTealLight}, ${THEME_COLORS.mediumTeal})`,
          color: '#ffffff',
        };
      case 'info':
      default:
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.lightBlue}, ${THEME_COLORS.lightBlueDark})`,
          color: '#ffffff',
        };
    }
  };

  const style = getTypeStyle(type);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg px-4 py-2 text-white shadow-lg"
      style={style}
    >
      {message}
    </div>
  );
}