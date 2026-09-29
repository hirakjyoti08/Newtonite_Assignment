import { Worker, Job } from 'bullmq';
import { config } from '../../config';

const worker = new Worker(
  'notifications',
  async (job: Job) => {
    const { type, workItemId, userId, changes } = job.data;
    console.log(`[Notification] ${type} for work item ${workItemId} by user ${userId}`);
    console.log(`[Notification] Changes:`, JSON.stringify(changes));
    // In production: send email, Slack message, push notification
  },
  {
    connection: { url: config.redisUrl },
    concurrency: 5,
    limiter: { max: 10, duration: 1000 },
  }
);

worker.on('failed', (job, error) => {
  console.error(`[Notification] Job ${job?.id} failed:`, error?.message);
});

worker.on('completed', (job) => {
  console.log(`[Notification] Job ${job.id} completed`);
});

console.log('[Notification Worker] Started');