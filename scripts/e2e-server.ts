process.env.NODE_ENV = 'test';
process.env.TEST_SERVER_STATIC = 'true';
process.env.PORT = '3100';
process.env.FEATURE_RFID = process.env.FEATURE_RFID || 'true';
process.env.RFID_HMAC_SECRET = process.env.RFID_HMAC_SECRET || 'ci_rfid_hmac_secret_key_32bytes_long';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'ci-session-secret-01234567890123456789';
process.env.REDIS_KEY_HMAC_SECRET = process.env.REDIS_KEY_HMAC_SECRET || 'ci_redis_hmac_secret_32bytes_long';

const [{ createApp }, { seedDatabase }, { runMigrations }, { createStudent }, { createQrCredential }, { db }] = await Promise.all([
  import('../server'),
  import('../src/db/seed'),
  import('../src/db/migrate'),
  import('../src/services/studentService'),
  import('../src/services/qrService'),
  import('../src/db'),
]);

await runMigrations();
const seeded = await seedDatabase();
// The browser proof needs real active roster credentials, but this fixture is
// created only in the dedicated E2E process and never during production boot.
for (const [rollNumber, name] of [[1, 'E2E Student One'], [2, 'E2E Student Two']] as const) {
  const created = await createStudent({
    schoolId: seeded.schoolA.id,
    studentCode: `E2E-${rollNumber}`,
    name,
    classSectionId: seeded.schoolAClass5A.id,
    academicYearId: seeded.academicYearA.id,
    rollNumber,
    guardian: { name: `${name} Guardian`, phoneNumber: `+9198765432${rollNumber}0` },
  });
  await createQrCredential(db, { schoolId: seeded.schoolA.id, studentId: created.student.id });
}
const app = await createApp();
const server = app.listen(3100, '127.0.0.1', () => console.log('E2E server listening on http://127.0.0.1:3100'));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
