import { PrismaClient } from '@prisma/client';
import { EventAction } from '../shared/types';
import prisma from '../utils/prisma';

export async function recordEvent(
  workItemId: string,
  userId: string,
  action: EventAction,
  changes?: Record<string, { from: unknown; to: unknown }>,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.workItemEvent.create({
    data: {
      workItemId,
      userId,
      action,
      changes: changes as any,
      metadata: metadata as any,
    },
  });
}