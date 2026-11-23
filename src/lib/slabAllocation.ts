// Allocating several slabs to a job. Each is its own request (and its own
// transaction on the server), so a run can stop part-way: the slabs before the
// failure ARE allocated and must stay so, and the caller needs to know which.

/** Thrown when allocating a set of slabs stopped early. */
export class AllocationInterrupted extends Error {
  readonly allocated: string[];
  readonly failedId: string;
  readonly reason: unknown;

  constructor(allocated: string[], failedId: string, reason: unknown) {
    super(`Allocated ${allocated.length} slab(s) before slab ${failedId} failed.`);
    this.name = 'AllocationInterrupted';
    this.allocated = allocated;
    this.failedId = failedId;
    this.reason = reason;
  }
}

/** Allocates the slabs one at a time, in order, stopping at the first failure.
 *  Resolves with the ids allocated; rejects with AllocationInterrupted (carrying
 *  those already done) rather than the bare error, so nothing done is forgotten. */
export async function allocateInOrder(
  ids: string[],
  allocate: (slabId: string) => Promise<void>,
): Promise<string[]> {
  const done: string[] = [];
  for (const id of ids) {
    try {
      await allocate(id);
    } catch (err) {
      throw new AllocationInterrupted(done, id, err);
    }
    done.push(id);
  }
  return done;
}
