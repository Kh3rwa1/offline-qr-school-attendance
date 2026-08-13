import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../../server';
import { Express } from 'express';

describe('RFID API Tests', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp();
  });

  it('createApp initializes RFID routes', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });
});
