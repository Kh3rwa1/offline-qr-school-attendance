import React from 'react';
import { useActiveSchool } from '../../app/ActiveSchoolProvider';
import CardEnrollmentWizard from '../../components/rfid/CardEnrollmentWizard';
import { StatCard } from '../../components/shared/StatCard';
import { motion } from 'motion/react';
import { CreditCard, Sparkles, Key, CheckCircle2 } from 'lucide-react';

export const EnrollmentOperations: React.FC = () => {
  const { activeSchoolId, activeSchoolName } = useActiveSchool();
  return (
    <div className="space-y-8" id="enrollment-operations-view">
      {/* Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-display">
          Card Personalization & Key Injection
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Issue brand-new MIFARE DESFire EV3 smartcards with AES-128 student keys at {activeSchoolName}.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Personalization Station"
          value="USB PC/SC Ready"
          trend={{ value: "ACR122U / HID Omnikey", isPositive: true }}
          variant="hero-forest"
        />
        <StatCard
          title="Cards Programmed"
          value="45 This Month"
          trend={{ value: "New Student Admissions", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Cryptographic Standard"
          value="AES-128 CMAC"
          trend={{ value: "Hardware Level Security", isPositive: true }}
          variant="default"
        />
        <StatCard
          title="Blank Card Stock"
          value="150 Available"
          trend={{ value: "Ready in Supply Room", isPositive: true }}
          variant="default"
        />
      </div>

      {/* Wizard */}
      {activeSchoolId && <CardEnrollmentWizard schoolId={activeSchoolId} />}
    </div>
  );
};

export default EnrollmentOperations;
