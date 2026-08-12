import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  COMPONENT: z.enum(['web', 'worker', 'migrate']).default('web'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().optional(),
  SYSTEM_DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  APP_URL: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.parse(process.env);
if (parsedEnv.NODE_ENV === 'production' && parsedEnv.COMPONENT === 'web' && !parsedEnv.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be provided in production');
}

export const env = parsedEnv;
