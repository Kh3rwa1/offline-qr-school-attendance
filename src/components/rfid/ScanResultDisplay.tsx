import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export default function ScanResultDisplay({ result }: { result: any }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (result) {
      setVisible(true);
      const timer = setTimeout(() => setVisible(false), 3000);
      
      // Optional sound feedback mock
      if (result.decision === 'ACCEPTED') {
        // play success sound
      } else {
        // play error sound
      }
      
      return () => clearTimeout(timer);
    }
  }, [result]);

  if (!visible || !result) return null;

  const isSuccess = result.decision === 'ACCEPTED';
  const isDuplicate = result.decision === 'DUPLICATE';
  
  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50`}>
      <div className={`w-full max-w-2xl rounded-3xl shadow-2xl p-10 text-center transform transition-all scale-100 ${
        isSuccess ? 'bg-emerald-500 text-white' : 
        isDuplicate ? 'bg-amber-400 text-amber-900' : 
        'bg-rose-500 text-white'
      }`}>
        <div className="flex justify-center mb-6">
          {isSuccess ? <CheckCircle className="w-32 h-32" /> : 
           isDuplicate ? <AlertCircle className="w-32 h-32" /> : 
           <XCircle className="w-32 h-32" />}
        </div>
        
        {isSuccess && result.student ? (
          <>
            <div className="w-40 h-40 bg-white/20 rounded-full mx-auto mb-6 overflow-hidden flex items-center justify-center text-4xl font-black">
              {result.student.name.charAt(0)}
            </div>
            <h1 className="text-5xl font-black mb-2">{result.student.name}</h1>
            <p className="text-2xl opacity-90">{result.message || 'Access Granted'}</p>
          </>
        ) : (
          <>
            <h1 className="text-5xl font-black mb-4">{result.decision}</h1>
            <p className="text-2xl opacity-90">{result.message || 'Access Denied'}</p>
          </>
        )}
      </div>
    </div>
  );
}
