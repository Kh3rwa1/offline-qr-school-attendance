import React, { useState, forwardRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface PasswordFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      label = 'Password',
      helperText,
      error,
      containerClassName = '',
      className = '',
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const inputId = id || `password-${label.toLowerCase().replace(/\s+/g, '-')}`;
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
          <input
            ref={ref}
            id={inputId}
            type={showPassword ? 'text' : 'password'}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError && inputId ? `${inputId}-error` : undefined}
            className={`w-full min-h-[46px] pl-4 pr-12 py-3 rounded-full bg-surface-soft border text-sm font-medium text-ink placeholder:text-ink-muted transition-all outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
              hasError
                ? 'border-danger-600 focus:border-danger-600 focus:ring-2 focus:ring-danger-100 dark:focus:ring-danger-900/30'
                : 'border-line focus:bg-surface focus:border-forest-700 focus:ring-2 focus:ring-forest-100 dark:focus:ring-forest-900/20'
            } ${className}`}
            {...props}
          />

          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full text-ink-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" strokeWidth={2} />
            ) : (
              <Eye className="w-4 h-4" strokeWidth={2} />
            )}
          </button>
        </div>

        {error ? (
          <p id={inputId ? `${inputId}-error` : undefined} className="text-sm font-semibold text-danger-600 flex items-center gap-1">
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p className="text-sm text-ink-soft">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

PasswordField.displayName = 'PasswordField';
export default PasswordField;
