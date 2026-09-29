import { Queue } from 'bullmq';
import { config } from '../config';

const connection = { url: config.redisUrl };

export const notificationQueue = new Queue('notifications', { connection });