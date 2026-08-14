import React from 'react';

export const TrendReports: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Longitudinal Attendance Trends</h2>
        <p className="text-xs text-slate-500">Historical presence distribution and weekday absence analytics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900">7-Day Rolling Trend</h3>
          <p className="text-xs text-slate-500">96.4% average attendance maintained over the past 7 instructional days.</p>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-[96.4%]"></div>
            <div className="bg-rose-400 h-full w-[3.6%]"></div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-slate-900">30-Day Seasonal Trend</h3>
          <p className="text-xs text-slate-500">94.8% average attendance with highest presence recorded on Wednesdays.</p>
          <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="bg-indigo-500 h-full w-[94.8%]"></div>
            <div className="bg-rose-400 h-full w-[5.2%]"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendReports;
