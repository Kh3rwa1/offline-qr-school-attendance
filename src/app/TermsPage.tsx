import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-extrabold text-[#0f172a] font-display">{title}</h2>
    <div className="text-sm text-slate-600 leading-relaxed space-y-2">{children}</div>
  </section>
);

export const TermsPage: React.FC = () => (
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
        <h1 className="text-3xl sm:text-4xl font-black font-display tracking-tight">Terms of Use</h1>
        <p className="text-sm text-slate-500">Last updated: August 2026 · AttendEase school attendance platform</p>
      </div>

      <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm leading-relaxed text-emerald-950">
        <strong>সারসংক্ষেপ (বাংলা):</strong> AttendEase বিদ্যালয়ের দৈনিক উপস্থিতি পরিচালনার একটি
        সেবা। আপনার বিদ্যালয়ের তথ্যের ১০০% মালিক আপনার বিদ্যালয় — যেকোনো সময় ডাউনলোড করতে
        পারবেন। শুধুমাত্র অনুমোদিত কর্মীরা অ্যাকাউন্ট ব্যবহার করবেন এবং পাসওয়ার্ড গোপন রাখবেন।
        অন্য বিদ্যালয়ের তথ্য দেখার চেষ্টা সম্পূর্ণ নিষিদ্ধ।
      </div>

      <Section title="1. The service">
        <p>
          AttendEase is an attendance recording and reporting service for schools. It works offline
          on school devices and syncs to the server when internet becomes available.
        </p>
      </Section>

      <Section title="2. Your school owns its data">
        <p>
          One hundred percent of student and attendance data belongs to your school. You can export
          it at any time from the reports section, in UDISE+ compatible formats.
        </p>
      </Section>

      <Section title="3. Who may use it">
        <p>
          Only staff members authorized by your school. Please keep passwords private, and ask your
          administrator to stop access promptly for anyone who leaves the school.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>
          Use the service only for your own school's attendance. Attempting to access another
          school's workspace is strictly prohibited and is recorded in the platform audit log.
        </p>
      </Section>

      <Section title="5. Availability">
        <p>
          The system is designed to keep working during internet and power interruptions. We work
          hard to keep it reliable, but we cannot promise uninterrupted service at all times.
        </p>
      </Section>

      <Section title="6. Changes to these terms">
        <p>
          If we make important changes to these terms, we will inform your school before they take
          effect.
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
      <Link to="/privacy" className="underline hover:text-slate-700">
        Privacy Policy
      </Link>
    </footer>
  </div>
);

export default TermsPage;
