import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message,
  onRetry,
}) => {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-800 space-y-3">
      <div className="flex items-center gap-2 font-bold text-sm">
        <AlertCircle className="w-5 h-5 text-red-600" />
        <span>{title}</span>
      </div>
      <p className="text-xs text-red-700">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
};

export default ErrorState;
