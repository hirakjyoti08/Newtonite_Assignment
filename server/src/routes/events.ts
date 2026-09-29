import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { authorizeWorkItem } from '../middleware/authorize';
import { Permission } from '../shared/types';
import { sseService } from '../services/sseService';
import prisma from '../utils/prisma';

const router = Router();

// GET /api/events/work-items/:id - SSE stream for a specific work item
router.get('/work-items/:id', authMiddleware, authorizeWorkItem(Permission.VIEW_WORK_ITEM), (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const channel = `work-item:${req.params.id}`;
  const unsubscribe = sseService.subscribe(channel, (data: string) => {
    res.write(`data: ${data}\n\n`);
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  req.on('close', () => {
    unsubscribe();
  });
});

// GET /api/events/team/:id - SSE stream for all work items in a team
router.get('/team/:id', authMiddleware, async (req: Request, res: Response, next) => {
  try {
    // Verify user is member of team
    const teamId = req.params.id as string;
    const membership = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: req.user!.id, teamId } },
    });
    if (!membership) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const channel = `team:${teamId}`;
    const unsubscribe = sseService.subscribe(channel, (data: string) => {
      res.write(`data: ${data}\n\n`);
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

    req.on('close', () => {
      unsubscribe();
    });
  } catch (e) {
    next(e);
  }
});

export default router;