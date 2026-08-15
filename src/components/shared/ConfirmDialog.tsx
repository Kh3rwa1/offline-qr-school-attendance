import React from 'react';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';

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
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      onClose={onCancel}
      onConfirm={onConfirm}
      title={title}
      description={message}
      confirmText={confirmLabel}
      cancelText={cancelLabel}
      intent={isDestructive ? 'danger' : 'warning'}
    />
  );
};

export default ConfirmDialog;
