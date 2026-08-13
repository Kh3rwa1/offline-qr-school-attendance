import React, { useState } from 'react';

export default function CardStatusPanel({ studentId }: { studentId: string }) {
  const [cards, setCards] = useState([
    { id: '1', digest: 'A1B2C3D4', status: 'ACTIVE', issuedAt: '2023-09-01T10:00:00Z', mode: 'SECURE' },
    { id: '2', digest: 'E5F6G7H8', status: 'REVOKED', issuedAt: '2022-09-01T10:00:00Z', mode: 'UID_LEGACY' }
  ]);

  const updateStatus = (id: string, newStatus: string) => {
    if (newStatus === 'REVOKED' && !window.confirm('Are you sure you want to revoke this card? This action cannot be undone.')) return;
    setCards(cards.map(c => c.id === id ? { ...c, status: newStatus } : c));
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-black mb-4">Card Status & History</h2>
      <div className="space-y-4">
        {cards.map(card => (
          <div key={card.id} className="border p-4 rounded-xl flex justify-between items-center">
            <div>
              <div className="font-mono text-sm">***...{card.digest} <span className="ml-2 text-xs text-slate-500">({card.mode})</span></div>
              <div className="text-xs text-slate-500">Issued: {new Date(card.issuedAt).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                card.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : 
                card.status === 'SUSPENDED' ? 'bg-amber-100 text-amber-800' : 
                card.status === 'REVOKED' ? 'bg-rose-100 text-rose-800' : 
                'bg-slate-100 text-slate-800'
              }`}>{card.status}</span>
              
              {card.status === 'ACTIVE' && <button onClick={() => updateStatus(card.id, 'SUSPENDED')} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded font-bold">Suspend</button>}
              {card.status === 'SUSPENDED' && <button onClick={() => updateStatus(card.id, 'ACTIVE')} className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-bold">Reactivate</button>}
              {card.status !== 'REVOKED' && <button onClick={() => updateStatus(card.id, 'REVOKED')} className="text-xs bg-rose-600 text-white px-2 py-1 rounded font-bold">Revoke</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
