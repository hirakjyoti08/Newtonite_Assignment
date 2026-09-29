import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, NotFoundError } from '../utils/errors';
import { Permission, ROLE_PERMISSIONS, TeamRole } from '../shared/types';
import prisma from '../utils/prisma';

interface UserWithMemberships {
  id: string;
  email: string;
  name: string;
  memberships: Array<{
    teamId: string;
    teamName: string;
    role: TeamRole;
  }>;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserWithMemberships;
      workItem?: { teamId: string; assigneeId: string | null; reporterId: string };
    }
  }
}

function hasPermission(userRole: TeamRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[userRole]?.includes(permission) ?? false;
}

function getUserRoleInTeam(
  memberships: UserWithMemberships['memberships'] | undefined,
  teamId: string
): TeamRole | null {
  const membership = memberships?.find((m: { teamId: string }) => m.teamId === teamId);
  return membership?.role ?? null;
}

export function authorizeTeam(permission: Permission, teamIdExtractor: (req: Request) => string | Promise<string>) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const teamId = await teamIdExtractor(req);
    const userRole = getUserRoleInTeam(req.user.memberships, teamId);

    if (!userRole || !hasPermission(userRole, permission)) {
      throw new ForbiddenError(`Required permission: ${permission}`);
    }

    next();
  };
}

export function authorizeWorkItem(permission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const workItemId = req.params.id as string;

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { teamId: true },
    });

    if (!workItem) {
      throw new NotFoundError('WorkItem', workItemId);
    }

    const userRole = getUserRoleInTeam(req.user.memberships, workItem.teamId);

    if (!userRole || !hasPermission(userRole, permission)) {
      throw new ForbiddenError(`Required permission: ${permission}`);
    }

    req.workItem = { teamId: workItem.teamId, assigneeId: null, reporterId: '' };
    next();
  };
}

export function authorizeWorkItemOwnership(permission: Permission, ownershipPermission: Permission) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const workItemId = req.params.id as string;

    const workItem = await prisma.workItem.findUnique({
      where: { id: workItemId },
      select: { teamId: true, assigneeId: true, reporterId: true },
    });

    if (!workItem) {
      throw new NotFoundError('WorkItem', workItemId);
    }

    const userRole = getUserRoleInTeam(req.user.memberships, workItem.teamId);

    if (!userRole) {
      throw new ForbiddenError('Not a member of this team');
    }

    const isOwner = workItem.assigneeId === req.user.id || workItem.reporterId === req.user.id;
    const hasAnyPermission = hasPermission(userRole, permission) || (isOwner && hasPermission(userRole, ownershipPermission));

    if (!hasAnyPermission) {
      throw new ForbiddenError(`Required permission: ${permission}`);
    }

    req.workItem = { teamId: workItem.teamId, assigneeId: workItem.assigneeId, reporterId: workItem.reporterId };
    next();
  };
}