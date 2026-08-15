import React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag' | 'ref'
  > {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-forest-700 hover:bg-forest-800 text-white shadow-md shadow-forest-700/20 border border-transparent font-bold active:bg-forest-900',
  secondary:
    'bg-surface hover:bg-surface-soft text-ink border border-line hover:border-ink-muted shadow-2xs font-semibold active:bg-line-soft',
  outline:
    'bg-transparent hover:bg-surface-soft text-forest-700 dark:text-forest-500 border border-forest-600 font-semibold',
  ghost:
    'bg-transparent hover:bg-surface-soft text-ink-soft hover:text-ink border border-transparent font-semibold',
  danger:
    'bg-danger-600 hover:bg-danger-800 text-white shadow-md shadow-danger-600/20 border border-transparent font-bold',
  success:
    'bg-success-600 hover:bg-success-800 text-white shadow-md shadow-success-600/20 border border-transparent font-bold',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-2 text-xs min-h-[36px] gap-2',
  md: 'px-5 py-2.5 text-sm min-h-[44px] gap-2.5',
  lg: 'px-6 py-3.5 text-base min-h-[48px] gap-3 font-semibold',
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
  fullWidth = false,
  type = 'button',
  ...rest
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <motion.button
      whileHover={isDisabled ? undefined : { scale: 1.015, translateY: -1 }}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      type={type}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center rounded-full font-display transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none select-none text-center ${
        fullWidth ? 'w-full' : ''
      } ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      {...(rest as any)}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        leftIcon && <span className="shrink-0 flex items-center">{leftIcon}</span>
      )}
      {children && <span className="truncate">{children}</span>}
      {!isLoading && rightIcon && <span className="shrink-0 flex items-center">{rightIcon}</span>}
    </motion.button>
  );
};

export default Button;
