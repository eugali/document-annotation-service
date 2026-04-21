export interface RetryOptions {
  retries: number;
  backoffMs?: number;
  backoffType?: 'none' | 'fixed' | 'exponential';
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { retries, backoffMs = 0, backoffType = 'none' } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < retries && backoffMs > 0) {
        const waitMs =
          backoffType === 'exponential'
            ? backoffMs * Math.pow(2, attempt)
            : backoffMs;
        await delay(waitMs);
      }
    }
  }

  throw lastError;
}
