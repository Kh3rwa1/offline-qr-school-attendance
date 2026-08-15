import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ScanResultDisplay({ result }: { result: any }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!visible || !result) return null;

  const isSuccess = result.decision === 'ACCEPTED';
  const isDuplicate = result.decision === 'DUPLICATE';
  
  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className={`w-full max-w-lg rounded-[28px] shadow-2xl p-8 sm:p-10 text-center transform transition-all ${
            isSuccess ? 'bg-forest-700 text-white' : 
            isDuplicate ? 'bg-warning-50 text-warning-800 border border-warning-100 dark:border-warning-600/30' : 
            'bg-danger-50 text-danger-800 border border-danger-100 dark:border-danger-600/30'
          }`}
        >
          <div className="flex justify-center mb-5">
            {isSuccess ? <CheckCircle2 className="w-20 h-20 text-emerald-300" /> : 
             isDuplicate ? <AlertCircle className="w-20 h-20 text-warning-600" /> : 
             <XCircle className="w-20 h-20 text-danger-600" />}
          </div>
          
          {isSuccess && result.student ? (
            <>
              <div className="w-20 h-20 bg-white/20 rounded-full mx-auto mb-4 overflow-hidden flex items-center justify-center text-3xl font-extrabold font-display">
                {result.student.name.charAt(0)}
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-2 font-display">{result.student.name}</h1>
              <p className="t-body text-base opacity-90">{result.message || 'Access Granted'}</p>
            </>
          ) : (
            <>
              <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 font-display">{result.decision}</h1>
              <p className="t-body text-base opacity-90">{result.message || 'Access Denied'}</p>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
