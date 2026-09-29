import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authorizeTeam } from '../middleware/authorize';
import { Permission, TeamRole } from '../shared/types';
import { z } from 'zod';
import { validate } from '../middleware/validate';
import prisma from '../utils/prisma';

const router = Router();

const addMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.nativeEnum(TeamRole).default(TeamRole.MEMBER),
});

// GET /api/teams - List teams for current user
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const memberships = await prisma.teamMember.findMany({
      where: { userId: req.user!.id },
      include: { team: true },
    });
    res.json(
      memberships.map((m) => ({
        teamId: m.team.id,
        teamName: m.team.name,
        role: m.role,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// GET /api/teams/:id - Get team details
router.get('/:id', authMiddleware, async (req, res, next) => {
  try {
    const teamId = req.params.id as string;
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId } },
      include: { team: true },
    });
    if (!membership) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
    });

    res.json({
      id: membership.team.id,
      name: membership.team.name,
      description: membership.team.description,
      members: members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// GET /api/teams/:id/members - List team members
router.get('/:id/members', authMiddleware, async (req, res, next) => {
  try {
    const teamId = req.params.id as string;
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId } },
    });
    if (!membership) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    }

    const members = await prisma.teamMember.findMany({
      where: { teamId },
      include: { user: true },
    });

    res.json(
      members.map((m) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// POST /api/teams/:id/members - Add member (ADMIN only)
router.post(
  '/:id/members',
  authMiddleware,
  authorizeTeam(Permission.MANAGE_TEAM, (req) => req.params.id as string),
  validate(addMemberSchema),
  async (req, res, next) => {
    try {
      const teamId = req.params.id as string;
      const existing = await prisma.teamMember.findUnique({
        where: { userId_teamId: { userId: req.body.userId, teamId } },
      });
      if (existing) {
        return res.status(400).json({ error: { code: 'CONFLICT', message: 'User is already a member' } });
      }

      const membership = await prisma.teamMember.create({
        data: {
          userId: req.body.userId,
          teamId,
          role: req.body.role,
        },
        include: { user: true },
      });

      res.status(201).json({
        userId: membership.userId,
        name: membership.user.name,
        email: membership.user.email,
        role: membership.role,
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;