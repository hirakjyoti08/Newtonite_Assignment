import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { authorizeWorkItem } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { Permission } from '../shared/types';
import { recordEvent } from '../services/auditService';
import { sseService } from '../services/sseService';
import { EventAction } from '../shared/types';
import { encodeCursor } from '../utils/pagination';
import prisma from '../utils/prisma';

const router = Router();

const createCommentSchema = z.object({
  body: z.string().min(1),
});

const listQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
});

// GET /api/work-items/:id/comments - List comments
router.get('/:id/comments', authMiddleware, authorizeWorkItem(Permission.VIEW_WORK_ITEM), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const workItemId = req.params.id as string;
    const cursor = query.cursor;

    const comments = await prisma.comment.findMany({
      where: { workItemId },
      orderBy: { createdAt: 'desc' },
      take: query.limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      include: { user: true },
    });

    let nextCursor: string | null = null;
    if (comments.length > query.limit) {
      const last = comments.pop()!;
      nextCursor = last.id;
    }

    res.json({
      items: comments.map((c: typeof comments[0]) => ({
        id: c.id,
        body: c.body,
        user: { id: c.user.id, name: c.user.name, email: c.user.email },
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
      nextCursor,
    });
  } catch (e) {
    next(e);
  }
});

// POST /api/work-items/:id/comments - Add comment
router.post(
  '/:id/comments',
  authMiddleware,
  authorizeWorkItem(Permission.ADD_COMMENT),
  validate(createCommentSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workItemId = req.params.id as string;
      const comment = await prisma.comment.create({
        data: {
          workItemId,
          userId: req.user!.id,
          body: req.body.body,
        },
        include: { user: true },
      });

      await recordEvent(workItemId, req.user!.id, EventAction.COMMENTED);

      sseService.publish(`work-item:${workItemId}`, {
        type: 'WORK_ITEM_UPDATED',
        workItemId,
        updatedBy: req.user!.id,
        updatedByName: req.user!.name,
        version: 0,
        changes: { comment: { from: null, to: req.body.body } },
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        id: comment.id,
        body: comment.body,
        user: { id: comment.user.id, name: comment.user.name, email: comment.user.email },
        createdAt: comment.createdAt.toISOString(),
        updatedAt: comment.updatedAt.toISOString(),
      });
    } catch (e) {
      next(e);
    }
  }
);

export default router;