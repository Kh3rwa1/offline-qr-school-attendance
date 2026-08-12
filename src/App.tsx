import React, { useState } from 'react';
import {
  Student,
  ClassSession,
  AttendanceEvent,
  Language,
  NetworkStatus,
} from './types';
import { INITIAL_SESSION, INITIAL_STUDENTS } from './data/mockData';
import { Header } from './components/Header';
import { NetworkSyncBar } from './components/NetworkSyncBar';
import { BentoScannerGrid } from './components/BentoScannerGrid';
import { StudentRosterModal } from './components/StudentRosterModal';
import { SyncOutboxModal } from './components/SyncOutboxModal';
import { ReportsModal } from './components/ReportsModal';
import { HeadmasterDashboard } from './components/HeadmasterDashboard';
import { Footer } from './components/Footer';

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>('OFFLINE');
  const [activeView, setActiveView] = useState<'scanner' | 'roster' | 'outbox' | 'reports' | 'admin'>('scanner');

  const [session, setSession] = useState<ClassSession>(INITIAL_SESSION);
  const [students, setStudents] = useState<Student[]>(INITIAL_STUDENTS);
  const [lastScannedStudent, setLastScannedStudent] = useState<Student | null>(
    INITIAL_STUDENTS[0]
  );
  const [events, setEvents] = useState<AttendanceEvent[]>([
    {
      clientEventId: 'evt-20260811-001',
      sessionId: INITIAL_SESSION.id,
      studentId: 'stu-001',
      eventType: 'QR_SCANNED',
      statusValue: 'PRESENT',
      clientTimestamp: '10:14:02 AM',
      syncStatus: 'PENDING',
    },
    {
      clientEventId: 'evt-20260811-002',
      sessionId: INITIAL_SESSION.id,
      studentId: 'stu-002',
      eventType: 'QR_SCANNED',
      statusValue: 'PRESENT',
      clientTimestamp: '10:12:45 AM',
      syncStatus: 'PENDING',
    },
  ]);

  const [scanFeedback, setScanFeedback] = useState<{
    type: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
    message: string;
  } | null>(null);

  // Toggle simulated network status
  const toggleNetworkStatus = () => {
    setNetworkStatus((prev) => (prev === 'OFFLINE' ? 'ONLINE' : 'OFFLINE'));
  };

  // Perform QR scan logic
  const handleScanStudent = (studentId: string, source: 'CAMERA' | 'USB') => {
    const studentIndex = students.findIndex((s) => s.id === studentId);
    if (studentIndex === -1) return;

    const student = students[studentIndex];
    const nowTime = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    if (student.status === 'PRESENT' || student.status === 'LATE') {
      // Duplicate scan detected
      setScanFeedback({
        type: 'DUPLICATE',
        message:
          language === 'bn'
            ? `সতর্কতা: ${student.nameBn} (${student.name}) ইতোমধ্যে ${
                student.scannedAt || '১০:১৪ AM'
              }-এ উপস্থিত হিসেবে রেকর্ড করা হয়েছে!`
            : `Duplicate Warning: ${student.name} was already marked PRESENT at ${
                student.scannedAt || '10:14 AM'
              }!`,
      });
      setTimeout(() => setScanFeedback(null), 3500);
      return;
    }

    // Mark present
    const updatedStudent: Student = {
      ...student,
      status: 'PRESENT',
      scannedAt: nowTime,
    };

    const newStudents = [...students];
    newStudents[studentIndex] = updatedStudent;
    setStudents(newStudents);
    setLastScannedStudent(updatedStudent);

    // Record Event in Offline Outbox
    const newEvent: AttendanceEvent = {
      clientEventId: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      sessionId: session.id,
      studentId: student.id,
      eventType: 'QR_SCANNED',
      statusValue: 'PRESENT',
      clientTimestamp: nowTime,
      syncStatus: 'PENDING',
    };

    setEvents((prev) => [newEvent, ...prev]);

    // Show scan success alert
    setScanFeedback({
      type: 'SUCCESS',
      message:
        language === 'bn'
          ? `সফল স্ক্যান: ${student.nameBn} (${student.name}) - রোল: ${student.rollNumber}`
          : `Scan Successful: ${student.name} (${student.nameBn}) - ROLL: ${student.rollNumber}`,
    });
    setTimeout(() => setScanFeedback(null), 3000);
  };

  // Update student status manually
  const handleUpdateStudentStatus = (
    studentId: string,
    status: Student['status']
  ) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s))
    );
  };

  // Sync Outbox
  const handleSyncNow = () => {
    if (networkStatus === 'OFFLINE') {
      setScanFeedback({
        type: 'DUPLICATE',
        message:
          language === 'bn'
            ? 'ডিভাইস অফলাইনে আছে। নেটওয়ার্ক ফিরলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে।'
            : 'Device is OFFLINE. Events remain stored in IndexedDB until connection restores.',
      });
      setTimeout(() => setScanFeedback(null), 3000);
      return;
    }

    // Process pending outbox
    setEvents((prev) =>
      prev.map((e) => ({ ...e, syncStatus: 'ACCEPTED' }))
    );

    setScanFeedback({
      type: 'SUCCESS',
      message:
        language === 'bn'
          ? 'আউটবক্স ইভেন্টগুলি সফলভাবে সার্ভারে সিঙ্ক হয়েছে!'
          : 'All outbox events successfully synchronized to server idempotently!',
    });
    setTimeout(() => setScanFeedback(null), 3000);
  };

  // Finalize Session
  const handleFinalizeSession = () => {
    // Mark remaining unmarked students as ABSENT
    const finalStudents = students.map((s) =>
      s.status === 'UNMARKED' ? { ...s, status: 'ABSENT' as const } : s
    );
    setStudents(finalStudents);
    setSession((prev) => ({ ...prev, status: 'FINALIZED' }));

    const absentCount = finalStudents.filter((s) => s.status === 'ABSENT').length;

    setScanFeedback({
      type: 'SUCCESS',
      message:
        language === 'bn'
          ? `উপস্থিতি চড়ান্ত করা হয়েছে! ${absentCount} টি অনুপস্থিতির SMS জব কিউ করা হয়েছে।`
          : `Session Finalized! ${absentCount} SMS alert jobs queued for absent student guardians.`,
    });
    setTimeout(() => setScanFeedback(null), 4000);
  };

  // Simulate Force Close / Application Reboot
  const handleSimulateForceClose = () => {
    setScanFeedback({
      type: 'SUCCESS',
      message:
        'PWA process force-closed and restarted. 100% of pending IndexedDB events recovered!',
    });
    setTimeout(() => setScanFeedback(null), 3000);
  };

  const pendingSyncCount = events.filter((e) => e.syncStatus === 'PENDING').length;

  return (
    <div className="min-h-screen bg-[#F1F5F9] font-sans p-4 sm:p-6 flex flex-col justify-between overflow-x-hidden">
      <div className="flex flex-col flex-1 max-w-7xl w-full mx-auto">
        <Header
          language={language}
          setLanguage={setLanguage}
          networkStatus={networkStatus}
          toggleNetworkStatus={toggleNetworkStatus}
          activeView={activeView}
          setActiveView={setActiveView}
          pendingSyncCount={pendingSyncCount}
        />

        <NetworkSyncBar schoolId={session.schoolId} />

        {activeView === 'scanner' && (
          <BentoScannerGrid
            session={session}
            students={students}
            lastScannedStudent={lastScannedStudent}
            language={language}
            networkStatus={networkStatus}
            pendingSyncCount={pendingSyncCount}
            onScanStudent={handleScanStudent}
            onSyncNow={handleSyncNow}
            onOpenManualModal={() => setActiveView('roster')}
            onFinalizeSession={handleFinalizeSession}
            scanFeedback={scanFeedback}
          />
        )}

        {activeView === 'roster' && (
          <StudentRosterModal
            students={students}
            language={language}
            onUpdateStatus={handleUpdateStudentStatus}
          />
        )}

        {activeView === 'outbox' && (
          <SyncOutboxModal
            events={events}
            language={language}
            networkStatus={networkStatus}
            onSyncNow={handleSyncNow}
            onSimulateForceClose={handleSimulateForceClose}
          />
        )}

        {activeView === 'reports' && (
          <ReportsModal students={students} language={language} />
        )}

        {activeView === 'admin' && (
          <HeadmasterDashboard
            students={students}
            language={language}
            onReissueQr={(studentId) => {
              console.log('Reissuing QR for student:', studentId);
            }}
            onRevokeQr={(studentId) => {
              console.log('Revoking QR for student:', studentId);
            }}
          />
        )}

        <Footer language={language} />
      </div>
    </div>
  );
}
