export class AsyncEventQueue {
  private queue: (() => Promise<void>)[] = [];
  private processing = false;

  async enqueue(task: () => Promise<void>): Promise<void> {
    this.queue.push(task);
    if (!this.processing) {
      await this.processQueue();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task();
      } catch (error) {
        console.error('Error processing task:', error);
      }
    }

    this.processing = false;

    // Если за время обработки появились новые задачи — обработать их
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }
}
