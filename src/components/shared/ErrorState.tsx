import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-6 bg-danger-50 dark:bg-danger-900/20 border border-danger-100 dark:border-danger-600/30 rounded-3xl text-danger-800 dark:text-danger-200 space-y-3 ${className}`}>
      <div className="flex items-center gap-2.5 font-bold text-base">
        <AlertCircle className="w-5 h-5 text-danger-600 shrink-0" />
        <span className="font-display">{title}</span>
      </div>
      <p className="text-sm text-danger-800/90 dark:text-danger-200/90 leading-relaxed">{message}</p>
      {onRetry && (
        <div className="pt-2">
          <Button
            variant="danger"
            size="md"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};

export default ErrorState;
