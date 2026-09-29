import { Router } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth';
import { validate } from '../middleware/validate';
import * as authService from '../services/authService';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8),
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { token, user } = await authService.login(req.body.email, req.body.password);
    res.json({ token, user });
  } catch (e) {
    next(e);
  }
});

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const user = await authService.register(req.body.email, req.body.password, req.body.name);
    const { token, user: userResponse } = await authService.login(req.body.email, req.body.password);
    res.status(201).json({ token, user: userResponse });
  } catch (e) {
    next(e);
  }
});

router.get('/me', authMiddleware, async (req, res, next) => {
  try {
    const user = await authService.getUserById(req.user!.id);
    res.json(user);
  } catch (e) {
    next(e);
  }
});

export default router;