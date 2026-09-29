import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { authorizeTeam, authorizeWorkItem, authorizeWorkItemOwnership } from '../middleware/authorize';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { validate } from '../middleware/validate';
import { Permission, WorkItemType, WorkItemStatus, WorkItemPriority } from '../shared/types';
import * as workItemService from '../services/workItemService';

const router = Router();

const createWorkItemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.nativeEnum(WorkItemType).default(WorkItemType.TASK),
  priority: z.nativeEnum(WorkItemPriority).default(WorkItemPriority.MEDIUM),
  teamId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

const updateWorkItemSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  priority: z.nativeEnum(WorkItemPriority).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  version: z.number().int().positive(),
});

const transitionSchema = z.object({
  status: z.nativeEnum(WorkItemStatus),
  version: z.number().int().positive(),
});

const assignSchema = z.object({
  assigneeId: z.string().uuid().nullable(),
  version: z.number().int().positive(),
});

const listQuerySchema = z.object({
  status: z.array(z.nativeEnum(WorkItemStatus)).optional(),
  priority: z.array(z.nativeEnum(WorkItemPriority)).optional(),
  type: z.array(z.nativeEnum(WorkItemType)).optional(),
  teamId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  search: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// GET /api/work-items - List work items
router.get('/', authMiddleware, async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const result = await workItemService.listWorkItems(query, query.cursor || null, query.limit, req.user!.id);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

// POST /api/work-items - Create work item
router.post(
  '/',
  authMiddleware,
  idempotencyMiddleware,
  validate(createWorkItemSchema),
  authorizeTeam(Permission.CREATE_WORK_ITEM, (req) => req.body.teamId),
  async (req, res, next) => {
    try {
      const item = await workItemService.createWorkItem(req.body, req.user!.id);
      res.status(201).json(item);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/work-items/:id - Get work item detail
router.get('/:id', authMiddleware, authorizeWorkItem(Permission.VIEW_WORK_ITEM), async (req, res, next) => {
  try {
    const item = await workItemService.getWorkItemById(req.params.id as string, req.user!.id);
    res.json(item);
  } catch (e) {
    next(e);
  }
});

// PATCH /api/work-items/:id - Update work item
router.patch(
  '/:id',
  authMiddleware,
  idempotencyMiddleware,
  validate(updateWorkItemSchema),
  authorizeWorkItemOwnership(Permission.EDIT_ANY_WORK_ITEM, Permission.EDIT_OWN_WORK_ITEM),
  async (req, res, next) => {
    try {
      const item = await workItemService.updateWorkItem(req.params.id as string, req.body, req.user!.id);
      res.json(item);
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/work-items/:id/transition - Transition work item status
router.post(
  '/:id/transition',
  authMiddleware,
  idempotencyMiddleware,
  validate(transitionSchema),
  authorizeWorkItemOwnership(Permission.TRANSITION_WORK_ITEM, Permission.TRANSITION_WORK_ITEM),
  async (req, res, next) => {
    try {
      const item = await workItemService.transitionWorkItem(req.params.id as string, req.body.status, req.body.version, req.user!.id);
      res.json(item);
    } catch (e) {
      next(e);
    }
  }
);

// POST /api/work-items/:id/assign - Assign work item
router.post(
  '/:id/assign',
  authMiddleware,
  idempotencyMiddleware,
  validate(assignSchema),
  authorizeWorkItem(Permission.ASSIGN_WORK_ITEM),
  async (req, res, next) => {
    try {
      const item = await workItemService.assignWorkItem(req.params.id as string, req.body.assigneeId, req.body.version, req.user!.id);
      res.json(item);
    } catch (e) {
      next(e);
    }
  }
);

// GET /api/work-items/:id/timeline - Get timeline (events + comments)
router.get('/:id/timeline', authMiddleware, authorizeWorkItem(Permission.VIEW_WORK_ITEM), async (req, res, next) => {
  try {
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const result = await workItemService.getTimeline(req.params.id as string, req.user!.id, cursor || null, limit);
    res.json(result);
  } catch (e) {
    next(e);
  }
});

export default router;