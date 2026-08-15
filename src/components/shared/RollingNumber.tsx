import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface RollingNumberProps {
  value: number;
  className?: string;
}

export const RollingNumber: React.FC<RollingNumberProps> = ({ value, className = '' }) => {
  const [prevValue, setPrevValue] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down'>('up');

  useEffect(() => {
    if (value !== prevValue) {
      setDirection(value > prevValue ? 'up' : 'down');
      setPrevValue(value);
    }
  }, [value, prevValue]);

  const digits = String(value).split('');

  return (
    <span className={`inline-flex items-center font-mono tabular-nums overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: direction === 'up' ? 12 : -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: direction === 'up' ? -12 : 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 450, damping: 28 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default RollingNumber;
