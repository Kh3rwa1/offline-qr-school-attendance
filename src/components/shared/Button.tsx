import React from 'react';
import { motion, HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'ref'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-forest-700 hover:bg-forest-800 text-white shadow-md shadow-forest-700/20 border border-transparent font-bold',
  secondary:
    'bg-surface hover:bg-surface-soft text-ink border border-line hover:border-ink-muted shadow-2xs font-semibold',
  ghost:
    'bg-transparent hover:bg-surface-soft text-ink-soft hover:text-ink border border-transparent font-semibold',
  danger:
    'bg-danger-600 hover:bg-danger-800 text-white shadow-md shadow-danger-600/20 border border-transparent font-bold',
  success:
    'bg-success-600 hover:bg-success-800 text-white shadow-md shadow-success-600/20 border border-transparent font-bold',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-[11px] gap-1.5',
  md: 'px-4 py-2.5 text-xs gap-2',
  lg: 'px-6 py-3.5 text-sm gap-2.5',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  className = '',
  disabled,
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      whileHover={isDisabled ? undefined : { scale: 1.02, translateY: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-full font-display transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none select-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...(rest as any)}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!isLoading && rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </motion.button>
  );
};

export default Button;
