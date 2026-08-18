type QueueJob<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getReportGenerationLimits() {
  return {
    maxConcurrent: positiveInteger(process.env.REPORT_GENERATION_CONCURRENCY, 1),
    maxPending: positiveInteger(process.env.REPORT_GENERATION_MAX_PENDING, 8),
    maxEstimatedCells: positiveInteger(process.env.REPORT_MAX_ESTIMATED_CELLS, 750_000),
    maxPeriodDays: positiveInteger(process.env.REPORT_MAX_PERIOD_DAYS, 370),
    maxStudents: positiveInteger(process.env.REPORT_MAX_STUDENTS, 5_000),
  };
}

class BoundedReportGenerationQueue {
  private running = 0;
  private readonly waiting: QueueJob<unknown>[] = [];

  enqueue<T>(run: () => Promise<T>): Promise<T> {
    const { maxConcurrent, maxPending } = getReportGenerationLimits();
    if (this.running >= maxConcurrent && this.waiting.length >= maxPending) {
      return Promise.reject(new Error('REPORT_GENERATION_QUEUE_FULL'));
    }

    return new Promise<T>((resolve, reject) => {
      this.waiting.push({ run, resolve, reject } as QueueJob<unknown>);
      this.drain();
    });
  }

  snapshot() {
    return { running: this.running, pending: this.waiting.length };
  }

  private drain() {
    const { maxConcurrent } = getReportGenerationLimits();
    while (this.running < maxConcurrent && this.waiting.length > 0) {
      const job = this.waiting.shift()!;
      this.running += 1;
      void job
        .run()
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          this.running -= 1;
          this.drain();
        });
    }
  }
}

export const reportGenerationQueue = new BoundedReportGenerationQueue();

export function assertReportGenerationBounds(params: {
  periodStart: string;
  periodEnd: string;
  studentCount: number;
}) {
  const limits = getReportGenerationLimits();
  const start = new Date(`${params.periodStart}T00:00:00Z`);
  const end = new Date(`${params.periodEnd}T00:00:00Z`);
  const periodDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(periodDays) || periodDays < 1) throw new Error('REPORT_PERIOD_INVALID');
  if (periodDays > limits.maxPeriodDays) throw new Error('REPORT_PERIOD_LIMIT_EXCEEDED');
  if (params.studentCount > limits.maxStudents) throw new Error('REPORT_STUDENT_LIMIT_EXCEEDED');

  const estimatedCells = Math.max(1, params.studentCount) * (periodDays + 12);
  if (estimatedCells > limits.maxEstimatedCells) {
    throw new Error('REPORT_ESTIMATED_SIZE_LIMIT_EXCEEDED');
  }
  return { periodDays, estimatedCells, limits };
}
