import { Request, Response, NextFunction } from 'express';
import prisma from '../utils/prisma';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only apply to mutating methods
  if (req.method !== 'POST' && req.method !== 'PATCH' && req.method !== 'PUT' && req.method !== 'DELETE') {
    return next();
  }

  const idempotencyKey = req.headers['idempotency-key'] as string;

  if (!idempotencyKey) {
    return next();
  }

  if (!req.user) {
    return next();
  }

  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey },
  });

  if (existing) {
    if (existing.expiresAt > new Date()) {
      // Return cached response
      return res.status(existing.statusCode).json(existing.responseBody);
    } else {
      // Expired, delete and continue
      await prisma.idempotencyKey.delete({ where: { key: idempotencyKey } });
    }
  }

  // Monkey-patch res.json to capture response
  const originalJson = res.json.bind(res);
  
  res.json = (body: unknown) => {
    // Save to database (fire and forget)
    prisma.idempotencyKey
      .create({
        data: {
          key: idempotencyKey,
          userId: req.user!.id,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          responseBody: body as any,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
        },
      })
      .catch(() => {}); // Ignore errors in idempotency storage
    
    return originalJson(body);
  };

  next();
}