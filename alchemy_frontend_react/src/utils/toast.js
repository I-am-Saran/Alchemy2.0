/**
 * Toast utility functions for easy toast notifications
 * These functions can be used throughout the application
 */

let toastContext = null;

export function setToastContext(context) {
  toastContext = context;
}

export function showSuccess(message, duration = 5000) {
  if (toastContext) {
    return toastContext.showToast(message, 'success', duration);
  }
  console.log(`✅ ${message}`);
}

export function showError(message, duration = 5000) {
  if (toastContext) {
    return toastContext.showToast(message, 'error', duration);
  }
  console.error(`❌ ${message}`);
}

export function showWarning(message, duration = 5000) {
  if (toastContext) {
    return toastContext.showToast(message, 'warning', duration);
  }
  console.warn(`⚠️ ${message}`);
}

export function showInfo(message, duration = 5000) {
  if (toastContext) {
    return toastContext.showToast(message, 'info', duration);
  }
  console.info(`ℹ️ ${message}`);
}

