import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import crypto from 'node:crypto';
import readline from 'node:readline';

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function bootstrapAdmin(options: {
  phone?: string;
  password?: string;
  generateToken?: boolean;
  name?: string;
} = {}) {
  let phone = options.phone || process.env.ADMIN_BOOTSTRAP_PHONE;
  let password = options.password || process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const name = options.name || process.env.ADMIN_BOOTSTRAP_NAME || 'Platform Super Administrator';

  if (!phone) {
    if (process.stdin.isTTY) {
      phone = await prompt('Enter Super Admin Phone Number (E.164 format, e.g. +919876543210): ');
    } else {
      phone = '+919999999999';
    }
  }

  if (!phone || !/^\+?[1-9]\d{9,14}$/.test(phone)) {
    throw new Error(`INVALID_PHONE_NUMBER: '${phone}' is not a valid E.164 phone number.`);
  }

  let oneTimeToken: string | null = null;

  if (!password) {
    if (options.generateToken || !process.stdin.isTTY) {
      // Generate secure 32-character random one-time activation password/token
      oneTimeToken = crypto.randomBytes(18).toString('base64url');
      password = oneTimeToken;
    } else {
      password = await prompt('Enter Super Admin Password (min 12 chars): ');
    }
  }

  if (!password || password.length < 12) {
    throw new Error('WEAK_PASSWORD: Super Admin password must be at least 12 characters.');
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });

  // Check if admin user already exists
  const [existingUser] = await db
    .select({ id: users.id, platformRole: users.platformRole })
    .from(users)
    .where(eq(users.phoneNumber, phone));

  let userId: string;

  if (existingUser) {
    await db
      .update(users)
      .set({
        passwordHash,
        platformRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));
    userId = existingUser.id;
    console.log(`✅ Existing user ${phone} upgraded to SUPER_ADMIN with refreshed credentials.`);
  } else {
    const [newUser] = await db
      .insert(users)
      .values({
        phoneNumber: phone,
        passwordHash,
        fullName: name,
        platformRole: 'SUPER_ADMIN',
        status: 'ACTIVE',
      })
      .returning({ id: users.id });
    userId = newUser.id;
    console.log(`✅ Super Admin user created: ${phone} (ID: ${userId})`);
  }

  if (oneTimeToken) {
    console.log('\n============================================================');
    console.log(' 🔑 SUPER ADMIN ONE-TIME BOOTSTRAP CREDENTIALS');
    console.log('============================================================');
    console.log(` Phone:    ${phone}`);
    console.log(` Password: ${oneTimeToken}`);
    console.log(' ⚠️  Store this password securely. Update it upon first sign-in.');
    console.log('============================================================\n');
  }

  return { userId, phone, oneTimeToken };
}

// Direct execution from CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const generateToken = args.includes('--token') || args.includes('--generate-token');
  const phoneArg = args.find((a) => a.startsWith('--phone='))?.split('=')[1];
  const passArg = args.find((a) => a.startsWith('--password='))?.split('=')[1];

  bootstrapAdmin({
    phone: phoneArg,
    password: passArg,
    generateToken,
  })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(`❌ Admin bootstrap failed: ${err.message}`);
      process.exit(1);
    });
}
