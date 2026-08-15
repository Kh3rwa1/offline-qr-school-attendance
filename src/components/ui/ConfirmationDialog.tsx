import React from 'react';
import { Dialog } from './Dialog';
import { Button } from './Button';
import { AlertTriangle, Info, Trash2, CheckCircle2 } from 'lucide-react';

export type ConfirmationIntent = 'danger' | 'warning' | 'info' | 'success';

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  intent?: ConfirmationIntent;
  isLoading?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  intent = 'danger',
  isLoading = false,
}) => {
  const getIntentConfig = () => {
    switch (intent) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-danger-600" />,
          iconBg: 'bg-danger-50 text-danger-600 border-danger-100 dark:border-danger-900/30',
          buttonVariant: 'danger' as const,
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-warning-600" />,
          iconBg: 'bg-warning-50 text-warning-600 border-warning-100 dark:border-warning-900/30',
          buttonVariant: 'primary' as const,
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-6 h-6 text-success-600" />,
          iconBg: 'bg-success-50 text-success-600 border-success-100 dark:border-success-900/30',
          buttonVariant: 'success' as const,
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-6 h-6 text-info-600" />,
          iconBg: 'bg-info-50 text-info-600 border-info-100 dark:border-info-900/30',
          buttonVariant: 'primary' as const,
        };
    }
  };

  const config = getIntentConfig();

  return (
    <Dialog isOpen={isOpen} onClose={onClose} maxWidth="sm" showCloseButton={false}>
      <div className="flex flex-col items-center text-center p-2">
        <div
          className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-4 shadow-sm ${config.iconBg}`}
        >
          {config.icon}
        </div>

        <h3 className="text-xl font-bold text-ink font-display mb-2">{title}</h3>
        <p className="text-sm text-ink-soft leading-relaxed mb-6 max-w-xs">{description}</p>

        <div className="flex items-center gap-3 w-full">
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={config.buttonVariant}
            size="md"
            onClick={onConfirm}
            isLoading={isLoading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};

export default ConfirmationDialog;
