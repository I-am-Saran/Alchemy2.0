import { Button } from "@material-tailwind/react";
import { THEME_COLORS } from "../constants/colors";

export default function GlossyButton({ className = "", children, variant = "filled", ...props }) {
  const base = "rounded-full transition-all duration-200 ease-out btn-gloss btn-glow focus-visible:outline-none text-sm sm:text-base";
  
  const getVariantStyles = (variant) => {
    switch (variant) {
      case "filled":
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
          color: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        };
      case "outlined":
        return {
          border: `1px solid ${THEME_COLORS.mediumTeal}`,
          backgroundColor: '#ffffff',
          color: THEME_COLORS.darkTeal,
        };
      case "text":
        return {
          backgroundColor: 'transparent',
          color: THEME_COLORS.darkTeal,
        };
      default:
        return {
          background: `linear-gradient(to right, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
          color: '#ffffff',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        };
    }
  };

  const baseStyle = getVariantStyles(variant);
  const focusRingColor = `${THEME_COLORS.mediumTeal}66`;

  return (
    <Button
      {...props}
      variant={variant}
      className={base}
      style={{
        ...baseStyle,
        '--tw-ring-color': focusRingColor,
      }}
      onMouseEnter={(e) => {
        if (variant === "filled") {
          e.currentTarget.style.background = `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.darkTealDark})`;
        } else if (variant === "outlined") {
          e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}40`;
        } else if (variant === "text") {
          e.currentTarget.style.backgroundColor = `${THEME_COLORS.lightMint}40`;
        }
      }}
      onMouseLeave={(e) => {
        const styles = getVariantStyles(variant);
        Object.assign(e.currentTarget.style, styles);
      }}
    >
      {children}
    </Button>
  );
}