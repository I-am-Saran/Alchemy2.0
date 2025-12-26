import React from 'react';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';
import { THEME_COLORS } from '../constants/colors';

export default function Logo({ 
  size = 'default', 
  showText = true, 
  variant = 'default',
  className = '' 
}) {
  const sizes = {
    small: { icon: 16, text: 'text-sm', container: 'w-8 h-8' },
    default: { icon: 24, text: 'text-xl', container: 'w-10 h-10' },
    large: { icon: 32, text: 'text-2xl', container: 'w-12 h-12' },
    xl: { icon: 48, text: 'text-4xl', container: 'w-16 h-16' },
    xxl: { icon: 64, text: 'text-5xl', container: 'w-24 h-24' }
  };

  const currentSize = sizes[size] || sizes.default;

  if (variant === 'icon-only') {
    return (
      <div 
        className={`flex items-center justify-center ${currentSize.container} rounded-lg shadow-md ${className}`}
        style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}
      >
        <ShieldCheck className="text-white" size={currentSize.icon} />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon */}
      <div 
        className={`flex items-center justify-center ${currentSize.container} rounded-lg shadow-md`}
        style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}
      >
        <ShieldCheck className="text-white" size={currentSize.icon} />
      </div>

      {/* Text with QA emphasis */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-baseline gap-1">
            <span 
              className={`${currentSize.text} font-bold ${className?.includes('text-white') ? 'text-white' : 'bg-clip-text text-transparent'}`}
              style={className?.includes('text-white') ? {} : { backgroundImage: `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}
            >
              Alchemy
            </span>
            <span 
              className={`${size === 'xxl' ? 'text-3xl' : size === 'xl' ? 'text-2xl' : 'text-lg'} font-extrabold text-white px-2 py-0.5 rounded-md shadow-sm`}
              style={{ 
                background: `linear-gradient(135deg, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
                boxShadow: `0 2px 8px rgba(176, 132, 1, 0.4)`
              }}
            >
              QA
            </span>
          </div>
          {variant === 'with-subtitle' && (
            <span 
              className={`text-xs hidden sm:block ${className?.includes('text-white') ? 'text-white/80' : ''}`}
              style={className?.includes('text-white') ? {} : { color: THEME_COLORS.darkTeal, opacity: 0.7 }}
            >
              Unified QA Portal
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Alternative logo variant with QA badge
export function LogoWithQABadge({ 
  size = 'default', 
  className = '' 
}) {
  const sizes = {
    small: { icon: 16, text: 'text-sm', container: 'w-8 h-8', badge: 'text-xs px-1.5 py-0.5' },
    default: { icon: 24, text: 'text-xl', container: 'w-10 h-10', badge: 'text-xs px-2 py-1' },
    large: { icon: 32, text: 'text-2xl', container: 'w-12 h-12', badge: 'text-sm px-2.5 py-1' },
    xl: { icon: 48, text: 'text-4xl', container: 'w-16 h-16', badge: 'text-base px-3 py-1.5' },
    xxl: { icon: 64, text: 'text-5xl', container: 'w-24 h-24', badge: 'text-xl px-4 py-2' }
  };

  const currentSize = sizes[size] || sizes.default;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Icon with QA badge overlay */}
      <div className="relative">
        <div 
          className={`flex items-center justify-center ${currentSize.container} rounded-lg shadow-md`}
          style={{ background: `linear-gradient(to bottom right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}
        >
          <ShieldCheck className="text-white" size={currentSize.icon} />
        </div>
        {/* QA Badge */}
        <div 
          className={`absolute -top-1 -right-1 ${currentSize.badge} font-extrabold text-white rounded-full flex items-center justify-center shadow-lg`}
          style={{ 
            background: `linear-gradient(135deg, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
            minWidth: size === 'xxl' ? '2.5rem' : size === 'xl' ? '2rem' : '1.5rem',
            minHeight: size === 'xxl' ? '2.5rem' : size === 'xl' ? '2rem' : '1.5rem'
          }}
        >
          <CheckCircle2 size={size === 'xxl' ? 20 : size === 'xl' ? 16 : 12} className="text-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col">
        <div className="flex items-baseline gap-2">
          <span 
            className={`${currentSize.text} font-bold bg-clip-text text-transparent`}
            style={{ backgroundImage: `linear-gradient(to right, ${THEME_COLORS.darkTeal}, ${THEME_COLORS.mediumTeal})` }}
          >
            Alchemy
          </span>
          <span 
            className={`${size === 'xxl' ? 'text-3xl' : size === 'xl' ? 'text-2xl' : 'text-lg'} font-extrabold text-white px-2 py-0.5 rounded-md shadow-sm`}
            style={{ 
              background: `linear-gradient(135deg, ${THEME_COLORS.mediumTeal}, ${THEME_COLORS.darkTeal})`,
              boxShadow: `0 2px 8px rgba(176, 132, 1, 0.4)`
            }}
          >
            QA
          </span>
        </div>
        <span 
          className="text-xs hidden sm:block" 
          style={{ color: THEME_COLORS.darkTeal, opacity: 0.7 }}
        >
          Unified QA Portal
        </span>
      </div>
    </div>
  );
}

