import { THEME_COLORS } from "../../constants/colors";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  onClick,
  className = "",
  ariaLabel,
  type = "button",
  disabled = false,
  ...props
}) {
  const base = "inline-flex items-center gap-2 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 disabled:opacity-60 disabled:cursor-not-allowed";

  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-sm sm:text-base px-4 py-2",
    lg: "text-base px-5 py-2.5",
  };

  const getVariantStyles = (variant) => {
    switch (variant) {
      case "primary":
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
          color: '#ffffff',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        };
      case "secondary":
        return {
          backgroundColor: '#ffffff',
          color: THEME_COLORS.darkTeal,
          border: `2px solid ${THEME_COLORS.mediumTeal}`,
        };
      case "outline":
        return {
          backgroundColor: '#ffffff',
          color: THEME_COLORS.darkTeal,
          border: `2px solid ${THEME_COLORS.mediumTeal}`,
        };
      case "ghost":
        return {
          backgroundColor: 'transparent',
          color: THEME_COLORS.darkTeal,
        };
      default:
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
          color: '#ffffff',
          boxShadow: '0 2px 4px -1px rgba(0, 0, 0, 0.1)',
        };
    }
  };

  const baseStyle = getVariantStyles(variant);
  const focusRingColor = `${THEME_COLORS.mediumTeal}66`;
  const sClass = sizes[size] || sizes.md;

  return (
    <button
      type={type}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sClass} ${className}`}
      style={{
        ...baseStyle,
        '--tw-ring-color': focusRingColor,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          if (variant === "primary") {
            e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
            e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.15)';
          } else if (variant === "secondary" || variant === "outline") {
            e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}40`;
            e.currentTarget.style.borderColor = THEME_COLORS.mediumTeal;
          } else if (variant === "ghost") {
            e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}40`;
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          const styles = getVariantStyles(variant);
          Object.assign(e.currentTarget.style, styles);
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}