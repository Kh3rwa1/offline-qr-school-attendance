import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { Download } from 'lucide-react';

export default function RfidReports({ schoolId }: { schoolId: string }) {
  const [data, setData] = useState<any[]>([]);
  const [filter, setFilter] = useState({ date: new Date().toISOString().slice(0,10), method: 'ALL' });

  useEffect(() => {
    // Mock load
    setData([
      { student: 'Alice Smith', time: '08:01:23', method: 'RFID_SECURE', reader: 'Main Gate In', location: 'Gate A', direction: 'IN', online: true },
      { student: 'Bob Jones', time: '08:05:11', method: 'QR', reader: 'Tablet 1', location: 'Class 10A', direction: 'IN', online: false },
      { student: 'Charlie Brown', time: '08:12:45', method: 'RFID_UID_LEGACY', reader: 'Main Gate In', location: 'Gate A', direction: 'IN', online: true }
    ]);
  }, [schoolId, filter]);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-black">Attendance Capture Report</h2>
        <button className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-xl font-bold text-sm">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <input type="date" value={filter.date} onChange={e => setFilter({...filter, date: e.target.value})} className="border p-2 rounded-xl text-sm" />
        <select value={filter.method} onChange={e => setFilter({...filter, method: e.target.value})} className="border p-2 rounded-xl text-sm">
          <option value="ALL">All Methods</option>
          <option value="QR">QR Code</option>
          <option value="RFID_SECURE">RFID Secure</option>
          <option value="RFID_UID_LEGACY">RFID Legacy</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-50 p-4 rounded-xl text-center"><div className="text-2xl font-black">350</div><div className="text-xs text-slate-500">Total Scans</div></div>
        <div className="bg-blue-50 p-4 rounded-xl text-center"><div className="text-2xl font-black text-blue-700">210</div><div className="text-xs text-slate-500">RFID SECURE</div></div>
        <div className="bg-amber-50 p-4 rounded-xl text-center"><div className="text-2xl font-black text-amber-700">40</div><div className="text-xs text-slate-500">RFID LEGACY</div></div>
        <div className="bg-purple-50 p-4 rounded-xl text-center"><div className="text-2xl font-black text-purple-700">100</div><div className="text-xs text-slate-500">QR Code</div></div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="pb-2">Time</th>
              <th className="pb-2">Student</th>
              <th className="pb-2">Method</th>
              <th className="pb-2">Reader / Location</th>
              <th className="pb-2">Network</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-3">{row.time}</td>
                <td className="py-3 font-bold">{row.student}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    row.method === 'RFID_SECURE' ? 'bg-blue-100 text-blue-800' :
                    row.method === 'RFID_UID_LEGACY' ? 'bg-amber-100 text-amber-800' :
                    'bg-purple-100 text-purple-800'
                  }`}>{row.method}</span>
                </td>
                <td className="py-3">{row.reader} <span className="text-slate-400 text-xs">({row.location})</span></td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs ${row.online ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                    {row.online ? 'Online' : 'Offline'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
