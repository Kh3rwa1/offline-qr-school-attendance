import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-extrabold text-[#0f172a] font-display">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </section>
);

export const PrivacyPage: React.FC = () => (
  <div className="min-h-screen bg-[#fafbfc] text-[#0f172a] font-sans antialiased flex flex-col">
    <header className="sticky top-0 z-40 px-4 sm:px-12 py-4 flex items-center justify-between bg-white/90 backdrop-blur-md border-b border-slate-200/80">
      <Link to="/" className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center text-white font-black text-sm font-display shadow-md">
          AE
        </div>
        <span className="text-xl font-black text-[#0f172a] font-display tracking-tight">AttendEase</span>
      </Link>
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm font-bold text-slate-600 hover:text-[#14532d] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to home</span>
      </Link>
    </header>

    <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-16 space-y-8 w-full">
      <div className="space-y-2">
        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-slate-500">
          Last updated: August 2026 · Applies to the AttendEase school attendance platform
        </p>
      </div>

      <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm leading-relaxed text-emerald-950">
        <strong>সারসংক্ষেপ (বাংলা):</strong> আমরা শুধুমাত্র দৈনিক হাজিরা চালানোর জন্য প্রয়োজনীয় তথ্য
        সংগ্রহ করি — ছাত্রের নাম, ক্লাস, রোল নম্বর, অভিভাবকের ফোন নম্বর এবং উপস্থিতির সময়। আমরা
        কখনো তথ্য বিক্রি করি না বা বিজ্ঞাপনের জন্য ব্যবহার করি না। প্রতিটি বিদ্যালয়ের তথ্য অন্য সব
        বিদ্যালয় থেকে সম্পূর্ণ আলাদা থাকে এবং ভারতের DPDP আইন অনুযায়ী সুরক্ষিত থাকে।
      </div>

      <Section title="1. What we collect">
        <p>Students: name, class, roll number, guardian phone number, and attendance date and time.</p>
        <p>School staff: name, phone number, and role.</p>
        <p>
          Website demo form: your name, phone number, email, school name, district, and student count
          — used only to contact you about the demo.
        </p>
      </Section>

      <Section title="2. Why we collect it">
        <p>
          To record daily student attendance, to generate UDISE+ format reports for education
          offices, and to send parents absence SMS alerts when the school enables them.
        </p>
      </Section>

      <Section title="3. What we never do">
        <p>
          We never sell student or staff data. We never show advertising. One school can never see
          another school's data. The camera is used only to scan student ID cards — no photos are
          stored.
        </p>
      </Section>

      <Section title="4. Where data is stored">
        <p>
          Each school's data lives in its own separate, protected workspace. Backups are encrypted,
          and important platform actions are recorded in a tamper-proof audit log kept for 7 years as
          per Government of India record-keeping rules.
        </p>
      </Section>

      <Section title="5. Who can see the data">
        <p>
          Only authorized staff of your school. Platform support access is limited, logged, and
          visible in the audit trail.
        </p>
      </Section>

      <Section title="6. Your rights (DPDP Act, 2023)">
        <p>
          You may request correction or deletion of personal data at any time through your school
          administrator, or by writing to us at the address below.
        </p>
      </Section>

      <Section title="7. Contact">
        <p>
          Email:{' '}
          <a href="mailto:founder@tumdah.com" className="text-[#15803d] font-semibold underline">
            founder@tumdah.com
          </a>
        </p>
      </Section>
    </main>

    <footer className="border-t border-slate-200 py-8 px-4 text-center text-xs text-slate-500 mt-auto">
      © {new Date().getFullYear()} AttendEase ·{' '}
      <Link to="/" className="underline hover:text-slate-700">
        Home
      </Link>{' '}
      ·{' '}
      <Link to="/terms" className="underline hover:text-slate-700">
        Terms of Use
      </Link>
    </footer>
  </div>
);

export default PrivacyPage;
