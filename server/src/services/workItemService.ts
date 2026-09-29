import { ConflictError, NotFoundError, ValidationError } from '../utils/errors';
import { encodeCursor } from '../utils/pagination';
import {
  WorkItemType,
  WorkItemStatus,
  WorkItemPriority,
  EventAction,
  VALID_STATUS_TRANSITIONS,
  WorkItemResponse,
  Permission,
} from '../shared/types';
import { recordEvent } from './auditService';
import { sseService } from './sseService';
import { notificationQueue } from '../jobs/queue';
import prisma from '../utils/prisma';

function formatWorkItemResponse(item: any): WorkItemResponse {
  return {
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type,
    status: item.status,
    priority: item.priority,
    version: item.version,
    assignee: item.assignee
      ? { id: item.assignee.id, name: item.assignee.name, email: item.assignee.email }
      : null,
    reporter: { id: item.reporter.id, name: item.reporter.name, email: item.reporter.email },
    team: { id: item.team.id, name: item.team.name },
    dueDate: item.dueDate?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

function computeChanges(oldItem: any, newData: Record<string, any>) {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, value] of Object.entries(newData)) {
    if (oldItem[key] !== value) {
      changes[key] = { from: oldItem[key], to: value };
    }
  }
  return changes;
}

function decodeCursor(cursor: string) {
  const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
  const [createdAtStr, id] = decoded.split('|');
  return { createdAt: new Date(createdAtStr), id };
}

export async function listWorkItems(
  filters: {
    status?: WorkItemStatus[];
    priority?: WorkItemPriority[];
    type?: WorkItemType[];
    teamId?: string;
    assigneeId?: string;
    search?: string;
  },
  cursor: string | null,
  limit: number,
  userId: string
) {
  const userMemberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const userTeamIds = userMemberships.map((m) => m.teamId);

  const where: any = {
    teamId: { in: userTeamIds },
  };

  if (filters.teamId && userTeamIds.includes(filters.teamId)) {
    where.teamId = filters.teamId;
  }

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }
  if (filters.priority?.length) {
    where.priority = { in: filters.priority };
  }
  if (filters.type?.length) {
    where.type = { in: filters.type };
  }
  if (filters.assigneeId) {
    where.assigneeId = filters.assigneeId;
  }
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const items = await prisma.workItem.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    cursor: cursor ? { id: cursor } : undefined,
    include: {
      assignee: true,
      reporter: true,
      team: true,
    },
  });

  let nextCursor: string | null = null;
  if (items.length > limit) {
    const lastItem = items.pop()!;
    nextCursor = encodeCursor(lastItem.createdAt, lastItem.id);
  }

  const totalCount = await prisma.workItem.count({ where });

  return {
    items: items.map(formatWorkItemResponse),
    nextCursor,
    totalCount,
  };
}

export async function getWorkItemById(id: string, userId: string) {
  const item = await prisma.workItem.findUnique({
    where: { id },
    include: {
      assignee: true,
      reporter: true,
      team: true,
    },
  });

  if (!item) {
    throw new NotFoundError('WorkItem', id);
  }

  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: item.teamId } },
  });

  if (!membership) {
    throw new NotFoundError('WorkItem', id);
  }

  return formatWorkItemResponse(item);
}

export async function createWorkItem(
  data: {
    title: string;
    description?: string;
    type: WorkItemType;
    priority: WorkItemPriority;
    teamId: string;
    assigneeId?: string;
    dueDate?: string;
  },
  userId: string
) {
  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: data.teamId } },
  });

  if (!membership) {
    throw new NotFoundError('Team', data.teamId);
  }

  let assigneeId = data.assigneeId;
  if (assigneeId) {
    const assigneeMembership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: assigneeId, teamId: data.teamId } },
    });
    if (!assigneeMembership) {
      throw new ValidationError({ assigneeId: 'Assignee must be a member of the team' });
    }
  }

  const item = await prisma.workItem.create({
    data: {
      title: data.title,
      description: data.description,
      type: data.type,
      priority: data.priority,
      teamId: data.teamId,
      reporterId: userId,
      assigneeId,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      version: 1,
    },
    include: {
      assignee: true,
      reporter: true,
      team: true,
    },
  });

  await recordEvent(item.id, userId, EventAction.CREATED);
  await enqueueNotification('WORK_ITEM_CREATED', item.id, userId, {});
  sseService.publish(`work-item:${item.id}`, {
    type: 'WORK_ITEM_CREATED',
    workItem: formatWorkItemResponse(item),
    timestamp: new Date().toISOString(),
  });
  sseService.publish(`team:${data.teamId}`, {
    type: 'WORK_ITEM_CREATED',
    workItem: formatWorkItemResponse(item),
    timestamp: new Date().toISOString(),
  });

  return formatWorkItemResponse(item);
}

export async function updateWorkItem(
  id: string,
  data: {
    title?: string;
    description?: string;
    priority?: WorkItemPriority;
    dueDate?: string | null;
    version: number;
  },
  userId: string
) {
  const { version, ...fieldsToUpdate } = data;

  const oldItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  if (!oldItem) {
    throw new NotFoundError('WorkItem', id);
  }

  const updateData: any = { ...fieldsToUpdate };
  if (fieldsToUpdate.dueDate === null) {
    updateData.dueDate = null;
  } else if (fieldsToUpdate.dueDate) {
    updateData.dueDate = new Date(fieldsToUpdate.dueDate);
  }

  const updated = await prisma.workItem.updateMany({
    where: {
      id,
      version,
    },
    data: {
      ...updateData,
      version: { increment: 1 },
    },
  });

  if (updated.count === 0) {
    const currentItem = await prisma.workItem.findUnique({
      where: { id },
      include: { assignee: true, reporter: true, team: true },
    });
    throw new ConflictError(
      'This work item has been modified by another user. Please review the changes.',
      formatWorkItemResponse(currentItem!)
    );
  }

  const newItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  const changes = computeChanges(oldItem, fieldsToUpdate);
  if (Object.keys(changes).length > 0) {
    await recordEvent(id, userId, EventAction.UPDATED, changes);
    await enqueueNotification('WORK_ITEM_UPDATED', id, userId, changes);
    sseService.publish(`work-item:${id}`, {
      type: 'WORK_ITEM_UPDATED',
      workItemId: id,
      updatedBy: userId,
      updatedByName: newItem!.reporter.name,
      version: newItem!.version,
      changes,
      timestamp: new Date().toISOString(),
    });
    sseService.publish(`team:${newItem!.teamId}`, {
      type: 'WORK_ITEM_UPDATED',
      workItemId: id,
      updatedBy: userId,
      updatedByName: newItem!.reporter.name,
      version: newItem!.version,
      changes,
      timestamp: new Date().toISOString(),
    });
  }

  return formatWorkItemResponse(newItem!);
}

export async function transitionWorkItem(
  id: string,
  newStatus: WorkItemStatus,
  version: number,
  userId: string
) {
  const oldItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  if (!oldItem) {
    throw new NotFoundError('WorkItem', id);
  }

  const allowedTransitions = VALID_STATUS_TRANSITIONS[oldItem.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new ValidationError({
      status: `Cannot transition from ${oldItem.status} to ${newStatus}`,
    });
  }

  let eventAction: EventAction = EventAction.STATUS_CHANGED;
  if (newStatus === WorkItemStatus.RESOLVED) eventAction = EventAction.RESOLVED;
  else if (newStatus === WorkItemStatus.CLOSED) eventAction = EventAction.CLOSED;
  else if (oldItem.status === WorkItemStatus.CLOSED && newStatus === WorkItemStatus.OPEN) eventAction = EventAction.REOPENED;

  const updated = await prisma.workItem.updateMany({
    where: { id, version },
    data: { status: newStatus, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    const currentItem = await prisma.workItem.findUnique({
      where: { id },
      include: { assignee: true, reporter: true, team: true },
    });
    throw new ConflictError(
      'This work item has been modified by another user. Please review the changes.',
      formatWorkItemResponse(currentItem!)
    );
  }

  const newItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  const changes = { status: { from: oldItem.status, to: newStatus } };
  await recordEvent(id, userId, eventAction, changes);
  await enqueueNotification('WORK_ITEM_UPDATED', id, userId, changes);
  sseService.publish(`work-item:${id}`, {
    type: 'WORK_ITEM_UPDATED',
    workItemId: id,
    updatedBy: userId,
    updatedByName: newItem!.reporter.name,
    version: newItem!.version,
    changes,
    timestamp: new Date().toISOString(),
  });
  sseService.publish(`team:${newItem!.teamId}`, {
    type: 'WORK_ITEM_UPDATED',
    workItemId: id,
    updatedBy: userId,
    updatedByName: newItem!.reporter.name,
    version: newItem!.version,
    changes,
    timestamp: new Date().toISOString(),
  });

  return formatWorkItemResponse(newItem!);
}

export async function assignWorkItem(
  id: string,
  assigneeId: string | null,
  version: number,
  userId: string
) {
  const oldItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  if (!oldItem) {
    throw new NotFoundError('WorkItem', id);
  }

  if (assigneeId) {
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: assigneeId, teamId: oldItem.teamId } },
    });
    if (!membership) {
      throw new ValidationError({ assigneeId: 'Assignee must be a member of the team' });
    }
  }

  const eventAction = assigneeId ? EventAction.ASSIGNED : EventAction.UNASSIGNED;

  const updated = await prisma.workItem.updateMany({
    where: { id, version },
    data: { assigneeId, version: { increment: 1 } },
  });

  if (updated.count === 0) {
    const currentItem = await prisma.workItem.findUnique({
      where: { id },
      include: { assignee: true, reporter: true, team: true },
    });
    throw new ConflictError(
      'This work item has been modified by another user. Please review the changes.',
      formatWorkItemResponse(currentItem!)
    );
  }

  const newItem = await prisma.workItem.findUnique({
    where: { id },
    include: { assignee: true, reporter: true, team: true },
  });

  const changes = { assigneeId: { from: oldItem.assigneeId, to: assigneeId } };
  await recordEvent(id, userId, eventAction, changes);
  await enqueueNotification('WORK_ITEM_UPDATED', id, userId, changes);
  sseService.publish(`work-item:${id}`, {
    type: 'WORK_ITEM_UPDATED',
    workItemId: id,
    updatedBy: userId,
    updatedByName: newItem!.reporter.name,
    version: newItem!.version,
    changes,
    timestamp: new Date().toISOString(),
  });
  sseService.publish(`team:${newItem!.teamId}`, {
    type: 'WORK_ITEM_UPDATED',
    workItemId: id,
    updatedBy: userId,
    updatedByName: newItem!.reporter.name,
    version: newItem!.version,
    changes,
    timestamp: new Date().toISOString(),
  });

  return formatWorkItemResponse(newItem!);
}

export async function getTimeline(id: string, userId: string, cursor: string | null, limit: number) {
  const item = await prisma.workItem.findUnique({ where: { id }, select: { teamId: true } });
  if (!item) throw new NotFoundError('WorkItem', id);

  const membership = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId: item.teamId } },
  });
  if (!membership) throw new NotFoundError('WorkItem', id);

  const [events, comments] = await Promise.all([
    prisma.workItemEvent.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: true },
    }),
    prisma.comment.findMany({
      where: { workItemId: id },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: true },
    }),
  ]);

  const timeline = [
    ...events.map((e) => ({
      id: e.id,
      type: 'event' as const,
      userId: e.userId,
      userName: e.user.name,
      createdAt: e.createdAt.toISOString(),
      action: e.action,
      changes: e.changes as Record<string, { from: unknown; to: unknown }> | undefined,
    })),
    ...comments.map((c) => ({
      id: c.id,
      type: 'comment' as const,
      userId: c.userId,
      userName: c.user.name,
      createdAt: c.createdAt.toISOString(),
      body: c.body,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  let nextCursor: string | null = null;
  if (timeline.length > limit) {
    const last = timeline.pop()!;
    nextCursor = encodeCursor(new Date(last.createdAt), last.id);
  }

  return { items: timeline.slice(0, limit), nextCursor };
}

async function enqueueNotification(type: string, workItemId: string, userId: string, changes: any) {
  try {
    await notificationQueue.add(
      'work-item-updated',
      { type, workItemId, userId, changes },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
  } catch (e) {
    console.error('[Notification] Failed to enqueue:', e);
  }
}

export async function getDashboardSummary(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    select: { teamId: true },
  });
  const teamIds = memberships.map((m) => m.teamId);

  const [totalOpen, totalCritical, totalAssignedToMe, byStatus, byPriority, recentActivity] = await Promise.all([
    prisma.workItem.count({ where: { teamId: { in: teamIds }, status: { not: WorkItemStatus.CLOSED } } }),
    prisma.workItem.count({ where: { teamId: { in: teamIds }, priority: WorkItemPriority.CRITICAL } }),
    prisma.workItem.count({ where: { assigneeId: userId, status: { not: WorkItemStatus.CLOSED } } }),
    prisma.workItem.groupBy({ by: ['status'], where: { teamId: { in: teamIds } }, _count: true }),
    prisma.workItem.groupBy({ by: ['priority'], where: { teamId: { in: teamIds } }, _count: true }),
    getTimelineForDashboard(teamIds, userId),
  ]);

  const statusMap: Record<WorkItemStatus, number> = {
    OPEN: 0,
    TRIAGED: 0,
    IN_PROGRESS: 0,
    BLOCKED: 0,
    RESOLVED: 0,
    CLOSED: 0,
  };
  byStatus.forEach((s) => { statusMap[s.status as WorkItemStatus] = s._count; });

  const priorityMap: Record<WorkItemPriority, number> = {
    CRITICAL: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
  byPriority.forEach((p) => { priorityMap[p.priority as WorkItemPriority] = p._count; });

  return {
    totalOpen,
    totalCritical,
    totalAssignedToMe,
    byStatus: statusMap,
    byPriority: priorityMap,
    recentActivity,
  };
}

async function getTimelineForDashboard(teamIds: string[], userId: string) {
  const items = await prisma.workItem.findMany({
    where: { teamId: { in: teamIds } },
    select: { id: true },
    take: 50,
    orderBy: { updatedAt: 'desc' },
  });
  const itemIds = items.map((i) => i.id);

  const [events, comments] = await Promise.all([
    prisma.workItemEvent.findMany({
      where: { workItemId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true, workItem: { select: { title: true } } },
    }),
    prisma.comment.findMany({
      where: { workItemId: { in: itemIds } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: true, workItem: { select: { title: true } } },
    }),
  ]);

  const timeline = [
    ...events.map((e) => ({
      id: e.id,
      type: 'event' as const,
      userId: e.userId,
      userName: e.user.name,
      createdAt: e.createdAt.toISOString(),
      action: e.action,
      changes: e.changes as Record<string, { from: unknown; to: unknown }> | undefined,
    })),
    ...comments.map((c) => ({
      id: c.id,
      type: 'comment' as const,
      userId: c.userId,
      userName: c.user.name,
      createdAt: c.createdAt.toISOString(),
      body: c.body,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return timeline.slice(0, 10);
}

export async function getMyItems(userId: string) {
  const items = await prisma.workItem.findMany({
    where: { assigneeId: userId, status: { not: WorkItemStatus.CLOSED } },
    orderBy: { updatedAt: 'desc' },
    include: { assignee: true, reporter: true, team: true },
  });
  return items.map(formatWorkItemResponse);
}