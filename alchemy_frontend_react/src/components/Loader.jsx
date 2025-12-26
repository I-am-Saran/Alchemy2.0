import React from "react";
import { THEME_COLORS } from "../constants/colors";

/**
 * Reusable Loader component with spinner animation
 * @param {Object} props
 * @param {string} props.message - Optional loading message
 * @param {boolean} props.fullScreen - Whether to show full screen loader (default: true)
 * @param {string} props.size - Size of spinner: 'sm', 'md', 'lg' (default: 'md')
 */
export default function Loader({ 
  message = "Loading...", 
  fullScreen = true,
  size = "md"
}) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  };

  const spinnerSize = sizeClasses[size] || sizeClasses.md;

  const spinner = (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer spinning circle */}
        <div
          className={`${spinnerSize} border-4 rounded-full animate-spin`}
          style={{
            borderColor: `${THEME_COLORS.lightBlue} transparent ${THEME_COLORS.lightBlue} ${THEME_COLORS.lightBlue}`,
            borderTopColor: THEME_COLORS.mediumTeal,
            borderRightColor: THEME_COLORS.darkTeal,
          }}
        ></div>
        {/* Inner pulsing circle */}
        <div
          className={`${spinnerSize} absolute top-0 left-0 border-2 rounded-full animate-pulse`}
          style={{
            borderColor: THEME_COLORS.mediumTeal,
            opacity: 0.5,
          }}
        ></div>
      </div>
      {message && (
        <p className="text-gray-700 font-medium animate-pulse">{message}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-white">
        {spinner}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center w-full py-12">
      {spinner}
    </div>
  );
}
