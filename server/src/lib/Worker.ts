import * as mediasoup from 'mediasoup';
import { Worker } from 'mediasoup/node/lib/types';
import { config } from '../config/mediasoup';

class MediasoupWorkerManager {
  private workers: Worker[] = [];
  private nextWorkerIndex = 0;

  async init(): Promise<void> {
    const { numWorkers } = config.worker;

    for (let i = 0; i < numWorkers; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: config.worker.logLevel,
        logTags: config.worker.logTags,
        rtcMinPort: config.worker.rtcMinPort,
        rtcMaxPort: config.worker.rtcMaxPort,
      });

      worker.on('died', () => {
        console.error(
          `Mediasoup worker died, exiting in 2 seconds... [pid:${worker.pid}]`
        );
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log(`Mediasoup worker started [pid:${worker.pid}]`);
    }
  }

  getWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];

    // Round-robin load balancing
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;

    return worker;
  }

  close(): void {
    for (const worker of this.workers) {
      worker.close();
    }
  }
}

export const workerManager = new MediasoupWorkerManager();
