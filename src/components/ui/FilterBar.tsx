import React from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { Button } from './Button';

export interface FilterOption {
  id: string;
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
}

export interface FilterBarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  filters?: FilterOption[];
  onReset?: () => void;
  actions?: React.ReactNode;
  activeFilterCount?: number;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records…',
  filters,
  onReset,
  actions,
  activeFilterCount = 0,
  className = '',
}) => {
  return (
    <div
      className={`p-3.5 sm:p-4 rounded-2xl bg-surface border border-line shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${className}`}
    >
      {/* Left: Search Input & Dropdown Filters */}
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery || ''}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-9 py-2 rounded-full bg-surface-soft border border-line text-xs sm:text-sm font-medium text-ink placeholder:text-ink-muted focus:bg-surface focus:border-forest-700 outline-none transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search query"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Dropdown Filters */}
        {filters && filters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => (
              <select
                key={filter.id}
                value={filter.value}
                onChange={(e) => filter.onChange(e.target.value)}
                aria-label={filter.label}
                className="px-3.5 py-2 rounded-full bg-surface-soft border border-line text-xs sm:text-sm font-semibold text-ink focus:bg-surface focus:border-forest-700 outline-none cursor-pointer transition-all"
              >
                {filter.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}

        {/* Reset Filter Button */}
        {onReset && activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
            className="text-ink-muted hover:text-ink self-start sm:self-auto"
          >
            Reset ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Right: Custom Action Buttons */}
      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
};

export default FilterBar;
