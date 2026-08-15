import React from 'react';

export interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rectangular',
  width,
  height,
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'text':
        return 'rounded-md h-4 w-full';
      case 'card':
        return 'rounded-[24px] h-32 w-full';
      case 'rectangular':
      default:
        return 'rounded-2xl';
    }
  };

  const style: React.CSSProperties = {
    width: width,
    height: height,
  };

  return (
    <div
      style={style}
      aria-hidden="true"
      className={`animate-pulse bg-line/80 dark:bg-line/40 ${getVariantStyles()} ${className}`}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => {
  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex gap-4 border-b border-line pb-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={`h-${i}`} variant="text" className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-4 py-2.5 items-center">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} variant="text" className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

export default Skeleton;
