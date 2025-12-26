import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { THEME_COLORS } from '../constants/colors';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const toastCounterRef = useRef(0);

  const showToast = useCallback((message, type = 'info', duration = 5000) => {
    // Use counter + timestamp + random for unique IDs
    toastCounterRef.current += 1;
    const id = `${Date.now()}-${toastCounterRef.current}-${Math.random().toString(36).substr(2, 9)}`;
    const newToast = {
      id,
      message,
      type, // 'success', 'error', 'warning', 'info'
      duration,
      open: true,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, duration);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const value = {
    showToast,
    removeToast,
    toasts,
  };

  return (
    <ToastContext.Provider value={value}>
      <Toast.Provider swipeDirection="right">
        {children}
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onRemove={removeToast}
          />
        ))}
        <Toast.Viewport className="fixed top-0 right-0 z-[9999] flex max-h-screen w-full flex-col p-4 md:max-w-[420px]" />
      </Toast.Provider>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onRemove }) {
  const getTypeStyle = (type) => {
    switch (type) {
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

  const style = getTypeStyle(toast.type);

  return (
    <Toast.Root
      className="rounded-lg p-4 shadow-lg relative min-w-[300px] text-white"
      style={style}
      duration={toast.duration}
      open={toast.open}
      onOpenChange={(open) => {
        if (!open) {
          onRemove(toast.id);
        }
      }}
    >
      <Toast.Title className="font-semibold pr-8">{toast.message}</Toast.Title>
      <Toast.Close className="absolute top-2 right-2 text-white hover:opacity-70 text-xl leading-none transition-opacity">
        ×
      </Toast.Close>
    </Toast.Root>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

