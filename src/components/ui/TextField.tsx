import React, { forwardRef } from 'react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  containerClassName?: string;
  prefixText?: string;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      error,
      startIcon,
      endIcon,
      containerClassName = '',
      className = '',
      id,
      prefixText,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const hasError = Boolean(error);

    return (
      <div className={`space-y-1.5 text-left ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-ink font-display"
          >
            {label} {required && <span className="text-danger-600 font-bold">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {prefixText ? (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-ink-muted select-none pointer-events-none">
              {prefixText}
            </span>
          ) : startIcon ? (
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none flex items-center">
              {startIcon}
            </span>
          ) : null}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError && inputId ? `${inputId}-error` : undefined}
            className={`w-full min-h-[46px] px-4 py-3 rounded-full bg-surface-soft border text-sm font-medium text-ink placeholder:text-ink-muted transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              prefixText ? 'pl-14' : startIcon ? 'pl-11' : 'pl-4'
            } ${endIcon ? 'pr-11' : 'pr-4'} ${
              hasError
                ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100 dark:focus:ring-danger-900/30'
                : 'border-line focus:bg-surface focus:border-forest-700 focus:ring-2 focus:ring-forest-100 dark:focus:ring-forest-900/20'
            } ${className}`}
            {...props}
          />

          {endIcon && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-muted flex items-center">
              {endIcon}
            </span>
          )}
        </div>

        {error ? (
          <p id={inputId ? `${inputId}-error` : undefined} className="text-xs font-semibold text-danger-600 flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-xs text-ink-muted">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
export default TextField;
