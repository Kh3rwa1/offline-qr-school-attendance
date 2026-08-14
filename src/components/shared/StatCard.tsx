import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string | React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'indigo' | 'emerald' | 'amber' | 'purple' | 'cyan' | 'rose';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  variant = 'default',
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'indigo':
        return 'text-indigo-600 bg-indigo-50 border-indigo-100';
      case 'emerald':
        return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'amber':
        return 'text-amber-600 bg-amber-50 border-amber-100';
      case 'purple':
        return 'text-purple-600 bg-purple-50 border-purple-100';
      case 'cyan':
        return 'text-cyan-600 bg-cyan-50 border-cyan-100';
      case 'rose':
        return 'text-rose-600 bg-rose-50 border-rose-100';
      default:
        return 'text-slate-900 bg-white border-slate-200';
    }
  };

  return (
    <div className={`p-5 rounded-2xl border shadow-sm ${getVariantStyles()}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{title}</p>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-black">{value}</span>
        {trend && (
          <span
            className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              trend.isPositive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      {subtitle && <p className="text-xs text-slate-500 mt-1 font-medium">{subtitle}</p>}
    </div>
  );
};

export default StatCard;
