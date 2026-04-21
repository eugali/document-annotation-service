import { withRetry } from '../../src/shared/with-retry';

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and succeeds', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');
    const result = await withRetry(fn, { retries: 3, backoffMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after all retries exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('permanent'));
    await expect(
      withRetry(fn, { retries: 2, backoffMs: 0 }),
    ).rejects.toThrow('permanent');
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('applies exponential backoff', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const delaySpy = jest.spyOn(global, 'setTimeout');

    await withRetry(fn, {
      retries: 3,
      backoffMs: 10,
      backoffType: 'exponential',
    });

    const delays = delaySpy.mock.calls
      .filter(([, ms]) => typeof ms === 'number' && ms >= 10)
      .map(([, ms]) => ms);
    expect(delays).toEqual([10, 20]);
    delaySpy.mockRestore();
  });

  it('applies fixed backoff', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const delaySpy = jest.spyOn(global, 'setTimeout');

    await withRetry(fn, {
      retries: 2,
      backoffMs: 15,
      backoffType: 'fixed',
    });

    const delays = delaySpy.mock.calls
      .filter(([, ms]) => typeof ms === 'number' && ms === 15)
      .map(([, ms]) => ms);
    expect(delays).toEqual([15]);
    delaySpy.mockRestore();
  });

  it('retries with no backoff when backoffMs is 0', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok');

    const result = await withRetry(fn, { retries: 2, backoffMs: 0 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
