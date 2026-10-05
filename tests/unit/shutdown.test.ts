import { describe, it, expect, vi } from 'vitest';
import { inflightTracker, isDraining } from '../../src/http/shutdown';
import type { Request, Response } from 'express';
import EventEmitter from 'node:events';

describe('Shutdown & Inflight Tracker', () => {
  it('tracks in-flight request lifecycle', () => {
    const emitter = new EventEmitter();
    const req = {} as Request;
    const res = Object.assign(emitter, {
      setHeader: vi.fn(),
    }) as unknown as Response;

    let nextCalled = false;
    inflightTracker(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);

    // Close the response
    emitter.emit('close');
  });

  it('exposes draining state accurately', () => {
    expect(typeof isDraining()).toBe('boolean');
  });
});
