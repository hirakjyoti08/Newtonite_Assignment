import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as workItemService from '../services/workItemService';

const router = Router();

// GET /api/dashboard/summary - Get dashboard summary
router.get('/summary', authMiddleware, async (req, res, next) => {
  try {
    const summary = await workItemService.getDashboardSummary(req.user!.id);
    res.json(summary);
  } catch (e) {
    next(e);
  }
});

// GET /api/dashboard/my-items - Get work items assigned to current user
router.get('/my-items', authMiddleware, async (req, res, next) => {
  try {
    const items = await workItemService.getMyItems(req.user!.id);
    res.json({ items });
  } catch (e) {
    next(e);
  }
});

export default router;