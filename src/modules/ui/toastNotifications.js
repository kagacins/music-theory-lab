/**
 * Toast Notifications System
 * Provides brief, non-intrusive feedback messages that auto-dismiss
 */

// Toast types with their styling
const TOAST_TYPES = {
  success: {
    icon: '✓',
    bgClass: 'bg-green-600',
    borderClass: 'border-green-700',
  },
  error: {
    icon: '✕',
    bgClass: 'bg-red-600',
    borderClass: 'border-red-700',
  },
  warning: {
    icon: '⚠',
    bgClass: 'bg-amber-500',
    borderClass: 'border-amber-600',
  },
  info: {
    icon: 'ℹ',
    bgClass: 'bg-blue-600',
    borderClass: 'border-blue-700',
  },
};

// Default duration in milliseconds
const DEFAULT_DURATION = 3000;

// Container for toast notifications
let toastContainer = null;

/**
 * Initialize the toast container
 */
function initToastContainer() {
  if (toastContainer) return toastContainer;

  toastContainer = document.createElement('div');
  toastContainer.id = 'toast-container';
  // z-index 100003 ensures toasts appear above the UnifiedRecommendationModal (z-index 100000-100002)
  toastContainer.className = 'fixed bottom-4 right-4 z-[100003] flex flex-col gap-2 pointer-events-none';
  toastContainer.setAttribute('aria-live', 'polite');
  toastContainer.setAttribute('aria-atomic', 'true');
  document.body.appendChild(toastContainer);

  // Add styles
  addToastStyles();

  return toastContainer;
}

/**
 * Add toast-specific styles
 */
function addToastStyles() {
  if (document.getElementById('toast-notification-styles')) return;

  const styles = document.createElement('style');
  styles.id = 'toast-notification-styles';
  styles.textContent = `
    .toast-notification {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-radius: 8px;
      border: 1px solid;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      color: white;
      font-size: 14px;
      font-weight: 500;
      pointer-events: auto;
      transform: translateX(120%);
      opacity: 0;
      transition: transform 0.3s ease, opacity 0.3s ease;
      max-width: 320px;
    }

    .toast-notification.show {
      transform: translateX(0);
      opacity: 1;
    }

    .toast-notification.hiding {
      transform: translateX(120%);
      opacity: 0;
    }

    .toast-icon {
      font-size: 16px;
      font-weight: bold;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 50%;
    }

    .toast-message {
      flex: 1;
      line-height: 1.3;
    }

    .toast-close {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      padding: 2px;
      font-size: 16px;
      line-height: 1;
      transition: color 0.15s;
    }

    .toast-close:hover {
      color: white;
    }

    /* Dark mode support */
    .dark .toast-notification {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
  `;
  document.head.appendChild(styles);
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {Object|string} options - Configuration options or type string for backwards compatibility
 * @param {string} options.type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} options.duration - Duration in ms (0 for persistent)
 * @param {boolean} options.dismissible - Show close button
 * @returns {HTMLElement} The toast element
 */
export function showToast(message, options = {}) {
  // Support backwards compatibility: showToast(msg, 'success')
  if (typeof options === 'string') {
    options = { type: options };
  }

  const {
    type = 'info',
    duration = DEFAULT_DURATION,
    dismissible = true,
  } = options;

  const container = initToastContainer();
  const toastConfig = TOAST_TYPES[type] || TOAST_TYPES.info;

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast-notification ${toastConfig.bgClass} ${toastConfig.borderClass}`;
  toast.setAttribute('role', 'alert');

  toast.innerHTML = `
    <span class="toast-icon">${toastConfig.icon}</span>
    <span class="toast-message">${message}</span>
    ${dismissible ? '<button class="toast-close" aria-label="Dismiss">×</button>' : ''}
  `;

  // Add close button handler
  if (dismissible) {
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => dismissToast(toast));
  }

  // Add to container
  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  // Auto-dismiss after duration
  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }

  return toast;
}

/**
 * Dismiss a toast notification
 * @param {HTMLElement} toast - The toast element to dismiss
 */
export function dismissToast(toast) {
  if (!toast || toast.classList.contains('hiding')) return;

  toast.classList.remove('show');
  toast.classList.add('hiding');

  // Remove after animation
  setTimeout(() => {
    toast.remove();
  }, 300);
}

/**
 * Clear all toast notifications
 */
export function clearAllToasts() {
  if (!toastContainer) return;

  const toasts = toastContainer.querySelectorAll('.toast-notification');
  toasts.forEach(toast => dismissToast(toast));
}

// Convenience methods for common toast types
export const toast = {
  success: (message, options = {}) => showToast(message, { ...options, type: 'success' }),
  error: (message, options = {}) => showToast(message, { ...options, type: 'error' }),
  warning: (message, options = {}) => showToast(message, { ...options, type: 'warning' }),
  info: (message, options = {}) => showToast(message, { ...options, type: 'info' }),
};

// Export for global access
export default {
  showToast,
  dismissToast,
  clearAllToasts,
  toast,
};
