import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function ReaderManagement({ schoolId }: { schoolId: string }) {
  const [readers, setReaders] = useState<any[]>([]);

  useEffect(() => {
    // Mock fetch for readers
    setReaders([
      { id: '1', name: 'Main Gate In', status: 'ACTIVE', location: 'Gate A', direction: 'IN', lastSeen: Date.now() - 1000, drift: 0.5 },
      { id: '2', name: 'Main Gate Out', status: 'PENDING', location: 'Gate A', direction: 'OUT', lastSeen: Date.now() - 300000, drift: -1.2 },
      { id: '3', name: 'Library', status: 'REVOKED', location: 'Library', direction: 'IN', lastSeen: Date.now() - 86400000, drift: 0 }
    ]);
  }, [schoolId]);

  const approveReader = (id: string) => {
    setReaders(readers.map(r => r.id === id ? { ...r, status: 'ACTIVE' } : r));
  };

  const revokeReader = (id: string) => {
    if (window.confirm('Are you sure you want to revoke this reader?')) {
      setReaders(readers.map(r => r.id === id ? { ...r, status: 'REVOKED' } : r));
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm">
      <h2 className="text-xl font-black mb-6">Reader Management</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2">Name / Location</th>
              <th className="pb-2">Direction</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Health</th>
              <th className="pb-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {readers.map(r => (
              <tr key={r.id} className="border-b last:border-0">
                <td className="py-3 font-bold">{r.name} <div className="text-xs text-slate-500 font-normal">{r.location}</div></td>
                <td className="py-3">{r.direction}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-bold ${r.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' : r.status === 'PENDING' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-3 text-xs">
                  <div>Last seen: {Math.floor((Date.now() - r.lastSeen) / 1000)}s ago</div>
                  <div>Drift: {r.drift}s</div>
                </td>
                <td className="py-3 flex gap-2">
                  {r.status === 'PENDING' && <button onClick={() => approveReader(r.id)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs font-bold">Approve</button>}
                  {r.status !== 'REVOKED' && <button onClick={() => revokeReader(r.id)} className="px-2 py-1 bg-rose-600 text-white rounded text-xs font-bold">Revoke</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
