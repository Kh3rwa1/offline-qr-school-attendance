import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  placement?: 'bottom' | 'right';
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthMap = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
};

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  placement = 'bottom',
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const isBottom = placement === 'bottom';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Drawer / Bottom Sheet Container */}
          <motion.div
            initial={isBottom ? { y: '100%' } : { x: '100%' }}
            animate={isBottom ? { y: 0 } : { x: 0 }}
            exit={isBottom ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            className={`fixed ${
              isBottom
                ? 'bottom-0 inset-x-0 max-h-[90vh] rounded-t-[32px] border-t'
                : `right-0 top-0 bottom-0 w-full ${maxWidthMap[maxWidth]} border-l`
            } bg-surface border-line shadow-2xl z-10 flex flex-col overflow-hidden`}
          >
            {/* Grab handle for bottom sheet */}
            {isBottom && (
              <div className="pt-3 pb-1 flex justify-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 rounded-full bg-ink-muted/30" />
              </div>
            )}

            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-line/60">
              <div className="text-left">
                {title && (
                  <h3 className="text-lg font-bold text-ink font-display leading-tight">
                    {title}
                  </h3>
                )}
                {description && (
                  <p className="text-xs text-ink-soft mt-0.5">{description}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-2 rounded-full text-ink-muted hover:text-ink hover:bg-surface-soft transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Drawer;
