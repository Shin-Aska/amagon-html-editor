export type ProjectReadLease = {
  readonly release: () => void;
};

export class ProjectReadLeaseManager {
  private activeCount = 0;
  private readonly drainWaiters = new Set<() => void>();

  get count(): number {
    return this.activeCount;
  }

  acquire(): ProjectReadLease {
    this.activeCount += 1;
    let active = true;
    return {
      release: () => {
        if (!active) return;
        active = false;
        this.activeCount -= 1;
        if (this.activeCount === 0) {
          for (const resolve of this.drainWaiters) resolve();
          this.drainWaiters.clear();
        }
      },
    };
  }

  waitForDrain(): Promise<void> {
    if (this.activeCount === 0) return Promise.resolve();
    return new Promise((resolve) => this.drainWaiters.add(resolve));
  }
}

export class ProjectMutationQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(guard: () => void, task: () => Promise<T> | T): Promise<T> {
    const result = this.tail.then(() => {
      guard();
      return task();
    });
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
