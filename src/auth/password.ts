import argon2 from 'argon2';

export async function hashPassword(password: string): Promise<string> {
  const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: isTest ? 2048 : 65536,
    timeCost: isTest ? 1 : 3,
    parallelism: isTest ? 1 : 4,
  });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (err) {
    return false;
  }
}
