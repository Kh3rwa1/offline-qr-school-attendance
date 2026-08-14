import React from 'react';
import CardStatusPanel from '../../components/rfid/CardStatusPanel';

export const CardOperations: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900">Smartcard Directory & Lifecycle</h2>
        <p className="text-xs text-slate-500">Search student smartcards, inspect lock status, and execute secure revocations</p>
      </div>
      <CardStatusPanel studentId="" />
    </div>
  );
};

export default CardOperations;
