import React from 'react';

export interface LoadingStateProps {
  message?: string;
  variant?: 'default' | 'stat-cards' | 'table' | 'hero' | 'grid';
  type?: 'default' | 'stat-cards' | 'table' | 'hero' | 'grid';
  rows?: number;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace data…',
  variant,
  type,
  rows = 5,
}) => {
  const activeVariant = variant || type || 'default';

  if (activeVariant === 'stat-cards') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="app-card p-6 sm:p-7 space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 rounded-full skeleton-shimmer" />
              <div className="h-7 w-7 rounded-full skeleton-shimmer" />
            </div>
            <div className="h-9 w-20 rounded-xl skeleton-shimmer my-3" />
            <div className="h-4 w-32 rounded-full skeleton-shimmer" />
          </div>
        ))}
      </div>
    );
  }

  if (activeVariant === 'hero') {
    return (
      <div className="app-card p-8 space-y-6 w-full">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl skeleton-shimmer" />
          <div className="space-y-2 flex-1">
            <div className="h-6 w-1/3 rounded-xl skeleton-shimmer" />
            <div className="h-4 w-1/2 rounded-lg skeleton-shimmer" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-line">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl skeleton-shimmer" />
          ))}
        </div>
      </div>
    );
  }

  if (activeVariant === 'table') {
    return (
      <div className="app-card overflow-hidden w-full border border-line">
        <div className="p-4 border-b border-line bg-surface-soft flex items-center justify-between">
          <div className="h-4 w-32 rounded-full skeleton-shimmer" />
          <div className="h-8 w-48 rounded-full skeleton-shimmer" />
        </div>
        <div className="divide-y divide-line p-2">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="p-3.5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="h-8 w-8 rounded-full skeleton-shimmer" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-1/4 rounded-full skeleton-shimmer" />
                  <div className="h-2.5 w-1/3 rounded-full skeleton-shimmer" />
                </div>
              </div>
              <div className="h-6 w-20 rounded-full skeleton-shimmer" />
              <div className="h-6 w-16 rounded-full skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default content-shaped composite shimmer skeleton
  return (
    <div className="app-card p-8 sm:p-10 space-y-6 w-full text-center">
      <div className="max-w-md mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl skeleton-shimmer mx-auto" />
        <div className="h-5 w-48 rounded-full skeleton-shimmer mx-auto" />
        <div className="h-3 w-64 rounded-full skeleton-shimmer mx-auto opacity-70" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-line">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-2xl skeleton-shimmer" />
        ))}
      </div>
      <p className="text-xs font-semibold text-ink-soft pt-2">{message}</p>
    </div>
  );
};

export default LoadingState;
