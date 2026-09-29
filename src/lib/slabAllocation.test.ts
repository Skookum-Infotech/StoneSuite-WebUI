import { describe, it, expect, vi } from 'vitest';
import { AllocationInterrupted, allocateInOrder } from './slabAllocation';

describe('allocateInOrder', () => {
  it('allocates each slab in turn and reports them all', async () => {
    const order: string[] = [];
    const allocate = vi.fn(async (id: string) => { order.push(id); });

    await expect(allocateInOrder(['a', 'b', 'c'], allocate)).resolves.toEqual(['a', 'b', 'c']);

    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('does one at a time, never in parallel', async () => {
    let running = 0;
    let peak = 0;
    const allocate = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
    };

    await allocateInOrder(['a', 'b', 'c'], allocate);

    expect(peak).toBe(1);
  });

  it('stops at the first failure and says what was already allocated', async () => {
    const boom = new Error('Slab is reserved and cannot be allocated.');
    const allocate = vi.fn(async (id: string) => { if (id === 'b') throw boom; });

    const err = await allocateInOrder(['a', 'b', 'c'], allocate).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AllocationInterrupted);
    const interrupted = err as AllocationInterrupted;
    expect(interrupted.allocated).toEqual(['a']);
    expect(interrupted.failedId).toBe('b');
    expect(interrupted.reason).toBe(boom);
    expect(allocate).toHaveBeenCalledTimes(2); // c was never tried
  });

  it('reports nothing allocated when the first one fails', async () => {
    const err = await allocateInOrder(['a', 'b'], async () => { throw new Error('no'); }).catch((e: unknown) => e);

    expect((err as AllocationInterrupted).allocated).toEqual([]);
  });

  it('does nothing for an empty list', async () => {
    await expect(allocateInOrder([], vi.fn())).resolves.toEqual([]);
  });
});
