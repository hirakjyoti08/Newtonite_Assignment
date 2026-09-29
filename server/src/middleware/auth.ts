import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';
import { config } from '../config';
import { TeamRole } from '../shared/types';
import prisma from '../utils/prisma';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        memberships: Array<{
          teamId: string;
          teamName: string;
          role: TeamRole;
        }>;
      };
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError();
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: {
        teamMemberships: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      memberships: user.teamMemberships.map((m): { teamId: string; teamName: string; role: TeamRole } => ({
        teamId: m.teamId,
        teamName: m.team.name,
        role: m.role as TeamRole,
      })),
    };

    next();
  } catch (e) {
    if (e instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token');
    }
    throw e;
  }
}