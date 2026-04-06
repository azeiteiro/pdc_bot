import type { JobOptions } from 'bree';
import * as dailyMessage from './dailyMessage.js';

export const jobs: JobOptions[] = [
  {
    name: dailyMessage.name,
    path: './src/jobs/dailyMessage.js',
    cron: dailyMessage.cron,
    worker: {
      workerData: {
        jobName: dailyMessage.name,
      },
    },
  },
];

export { dailyMessage };
