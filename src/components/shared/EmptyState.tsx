import React from 'react';

export interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  icon?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  onAction,
  icon = '📂',
}) => {
  return (
    <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div className="text-4xl">{icon}</div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 max-w-md mx-auto">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
