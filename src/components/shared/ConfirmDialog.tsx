import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { motion, AnimatePresence } from 'motion/react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm Action',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="app-card max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                isDestructive
                  ? 'bg-danger-50 text-danger-600 border border-danger-100 dark:border-danger-600/30'
                  : 'bg-warning-50 text-warning-600 border border-warning-100 dark:border-warning-600/30'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="t-title text-base font-bold text-ink">{title}</h3>
          </div>

          <p className="t-body text-xs text-ink-soft leading-relaxed">{message}</p>

          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="secondary" size="md" onClick={onCancel}>
              {cancelLabel}
            </Button>
            <Button
              variant={isDestructive ? 'danger' : 'primary'}
              size="md"
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmDialog;
