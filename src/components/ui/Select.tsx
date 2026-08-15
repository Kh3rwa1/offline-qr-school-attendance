import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  options?: SelectOption[];
  containerClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      helperText,
      error,
      options,
      children,
      containerClassName = '',
      className = '',
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const selectId = id || (label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);

    return (
      <div className={`space-y-1.5 text-left ${containerClassName}`}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-semibold text-ink font-display"
          >
            {label} {required && <span className="text-danger-600 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError && selectId ? `${selectId}-error` : undefined}
            className={`w-full min-h-[46px] pl-4 pr-10 py-3 rounded-full bg-surface-soft border text-sm font-medium text-ink transition-all outline-none appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              hasError
                ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100 dark:focus:ring-danger-900/30'
                : 'border-line focus:bg-surface focus:border-forest-700 focus:ring-2 focus:ring-forest-100 dark:focus:ring-forest-900/20'
            } ${className}`}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none flex items-center">
            <ChevronDown className="w-4 h-4" strokeWidth={2} />
          </span>
        </div>

        {error ? (
          <p id={selectId ? `${selectId}-error` : undefined} className="text-xs font-semibold text-danger-600 flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Select.displayName = 'Select';
export default Select;
