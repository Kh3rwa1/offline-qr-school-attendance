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
    <div className={`p-6 bg-danger-50 border border-danger-100 dark:border-danger-600/30 rounded-3xl text-danger-800 space-y-3 ${className}`}>
      <div className="flex items-center gap-2.5 font-bold text-sm">
        <AlertCircle className="w-5 h-5 text-danger-600 shrink-0" />
        <span className="font-display">{title}</span>
      </div>
      <p className="text-xs text-danger-800/90 leading-relaxed">{message}</p>
      {onRetry && (
        <div className="pt-1">
          <Button
            variant="danger"
            size="sm"
            onClick={onRetry}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};

export default ErrorState;
