import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export type ToastKind = 'success' | 'warning' | 'error' | 'info';

export interface ToastProps {
  kind: ToastKind;
  text?: string;
  message?: string;
  onDismiss?: () => void;
  autoDismiss?: boolean;
  duration?: number;
  className?: string;
}

const toastIcons: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-success-600 shrink-0" strokeWidth={2} />,
  warning: <AlertTriangle className="w-4 h-4 text-warning-600 shrink-0" strokeWidth={2} />,
  error: <XCircle className="w-4 h-4 text-danger-600 shrink-0" strokeWidth={2} />,
  info: <Info className="w-4 h-4 text-info-600 shrink-0" strokeWidth={2} />,
};

const toastStyles: Record<ToastKind, string> = {
  success: 'bg-success-50 text-success-800 border-success-100 dark:border-success-600/30',
  warning: 'bg-warning-50 text-warning-800 border-warning-100 dark:border-warning-600/30',
  error: 'bg-danger-50 text-danger-800 border-danger-100 dark:border-danger-600/30',
  info: 'bg-info-50 text-info-800 border-info-100 dark:border-info-600/30',
};

export const Toast: React.FC<ToastProps> = ({
  kind,
  text,
  message,
  onDismiss,
  autoDismiss = true,
  duration = 4000,
  className = '',
}) => {
  const content = text || message || '';

  useEffect(() => {
    if (autoDismiss && onDismiss) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoDismiss, onDismiss, duration]);

  if (!content) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
      className={`rounded-2xl p-4 text-xs font-semibold shadow-sm flex items-center justify-between gap-3 border ${toastStyles[kind]} ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {toastIcons[kind]}
        <span className="truncate leading-relaxed">{content}</span>
      </div>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss message"
          className="p-1 rounded-lg opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5 transition-opacity cursor-pointer shrink-0"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2} />
        </button>
      )}
    </motion.div>
  );
};

export default Toast;
