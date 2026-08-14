import React from 'react';

export interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace data…',
}) => {
  return (
    <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
      <p className="text-xs font-bold text-slate-600">{message}</p>
    </div>
  );
};

export default LoadingState;
