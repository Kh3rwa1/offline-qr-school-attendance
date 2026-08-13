import React, { useState } from 'react';
import { api } from '../../services/api';
import { Shield, ShieldAlert, Wifi } from 'lucide-react';

export default function CardEnrollmentWizard({ schoolId }: { schoolId: string }) {
  const [step, setStep] = useState(1);
  const [studentId, setStudentId] = useState('');
  const [mode, setMode] = useState<'SECURE' | 'UID_LEGACY'>('SECURE');
  const [cardDigest, setCardDigest] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const simulateRead = () => {
    setLoading(true);
    setTimeout(() => {
      setCardDigest('A1B2C3D4');
      setLoading(false);
      setStep(4);
    }, 1500);
  };

  const enrollCard = async () => {
    if (!window.confirm('Are you sure you want to enroll this card?')) return;
    setLoading(true);
    try {
      await api(`/api/v1/schools/${schoolId}/rfid/enroll`, {
        method: 'POST',
        body: JSON.stringify({ studentId, mode, digest: cardDigest })
      });
      setResult({ success: true, message: 'Card enrolled successfully' });
    } catch (e: any) {
      setResult({ success: false, message: e.message || 'Enrollment failed' });
    }
    setLoading(false);
    setStep(6);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm max-w-2xl mx-auto">
      <h2 className="text-xl font-black mb-6">Card Enrollment Wizard</h2>
      
      {step === 1 && (
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">Select Student</label>
          <input 
            type="text" 
            placeholder="Search student ID..." 
            value={studentId} 
            onChange={(e) => setStudentId(e.target.value)}
            className="w-full border rounded-xl p-3"
          />
          <button 
            disabled={!studentId} 
            onClick={() => setStep(2)}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold disabled:opacity-50"
          >Next</button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <label className="block text-sm font-bold text-slate-700">Security Mode</label>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setMode('SECURE')}
              className={`p-4 border rounded-xl flex flex-col items-center gap-2 ${mode === 'SECURE' ? 'border-blue-600 bg-blue-50' : ''}`}
            >
              <Shield className="w-6 h-6 text-emerald-600" />
              <span className="font-bold">SECURE (Recommended)</span>
            </button>
            <button 
              onClick={() => setMode('UID_LEGACY')}
              className={`p-4 border rounded-xl flex flex-col items-center gap-2 ${mode === 'UID_LEGACY' ? 'border-blue-600 bg-blue-50' : ''}`}
            >
              <ShieldAlert className="w-6 h-6 text-amber-600" />
              <span className="font-bold text-amber-600">UID_LEGACY</span>
            </button>
          </div>
          {mode === 'UID_LEGACY' && <p className="text-sm text-amber-700 font-bold">Warning: UID Legacy mode is not secure against cloning.</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">Back</button>
            <button onClick={() => setStep(3)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">Next</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center py-10 space-y-4">
          <Wifi className="w-12 h-12 text-blue-600 mx-auto animate-pulse" />
          <h3 className="font-bold text-lg">Place card on reader</h3>
          <button 
            onClick={simulateRead} 
            disabled={loading}
            className="px-6 py-2 bg-slate-800 text-white rounded-xl font-bold"
          >
            {loading ? 'Reading...' : 'Simulate Read'}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Card Read Successfully</h3>
          <p className="text-slate-600">Card Fingerprint: <span className="font-mono bg-slate-100 px-2 py-1 rounded">***...{cardDigest}</span></p>
          <div className="flex gap-2">
            <button onClick={() => setStep(3)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">Read Again</button>
            <button onClick={() => setStep(5)} className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold">Next</button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-bold text-lg">Confirm Enrollment</h3>
          <div className="bg-slate-50 p-4 rounded-xl text-sm space-y-2">
            <p><strong>Student ID:</strong> {studentId}</p>
            <p><strong>Mode:</strong> {mode}</p>
            <p><strong>Fingerprint:</strong> ***...{cardDigest}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(4)} className="px-4 py-2 bg-slate-100 rounded-xl font-bold">Back</button>
            <button onClick={enrollCard} disabled={loading} className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold">
              {loading ? 'Enrolling...' : 'Confirm Enrollment'}
            </button>
          </div>
        </div>
      )}

      {step === 6 && result && (
        <div className={`p-4 rounded-xl font-bold ${result.success ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          {result.message}
          <button onClick={() => { setStep(1); setStudentId(''); setResult(null); }} className="block mt-4 text-sm underline">Start New Enrollment</button>
        </div>
      )}
    </div>
  );
}
