import React from 'react';
import { motion } from 'motion/react';
import { Button } from './Button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
  details?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We encountered an error while processing your request. Please try again or contact your administrator.',
  onRetry,
  className = '',
  details,
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[28px] bg-danger-50/50 dark:bg-danger-900/10 border border-danger-100 dark:border-danger-900/30 ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-danger-100/80 dark:bg-danger-900/40 text-danger-600 flex items-center justify-center mb-4 shadow-sm">
        <AlertTriangle className="w-7 h-7" strokeWidth={2} />
      </div>

      <h3 className="text-lg sm:text-xl font-bold text-ink font-display mb-1.5">
        {title}
      </h3>

      <p className="text-sm text-ink-soft max-w-md leading-relaxed mb-6">
        {message}
      </p>

      {onRetry && (
        <Button
          variant="danger"
          size="md"
          onClick={onRetry}
          leftIcon={<RefreshCw className="w-4 h-4" />}
        >
          Try Again
        </Button>
      )}

      {details && (
        <div className="mt-4 max-w-md w-full text-left">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-danger-700 underline cursor-pointer"
          >
            {showDetails ? 'Hide technical details' : 'Show technical details'}
          </button>
          {showDetails && (
            <pre className="mt-2 p-3 bg-surface rounded-xl border border-line text-xs font-mono text-ink-soft overflow-x-auto">
              {details}
            </pre>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default ErrorState;
