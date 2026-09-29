import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app';
import prisma from '../src/utils/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const request = supertest(app);

describe('Idempotent Mutations', () => {
  let adminToken: string;
  let adminUserId: string;
  let testTeamId: string;
  const idempotencyKey = 'test-idempotency-key-' + Date.now();

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@newtonite.com' } });
    adminUserId = admin!.id;
    const membership = await prisma.teamMember.findFirst({ where: { userId: adminUserId } });
    testTeamId = membership!.teamId;

    adminToken = jwt.sign({ userId: adminUserId }, config.jwtSecret, { expiresIn: '8h' });

    await prisma.idempotencyKey.deleteMany({ where: { key: idempotencyKey } });
  });

  afterAll(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { key: idempotencyKey } });
    const items = await prisma.workItem.findMany({ where: { title: { startsWith: 'Idempotency Test' } } });
    for (const item of items) {
      await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
      await prisma.workItem.delete({ where: { id: item.id } });
    }
  });

  it('should return same response for duplicate POST with same idempotency key', async () => {
    const payload = {
      title: 'Idempotency Test Item',
      description: 'Testing idempotent creation',
      type: 'TASK',
      priority: 'MEDIUM',
      teamId: testTeamId,
    };

    const response1 = await request
      .post('/api/work-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    const response2 = await request
      .post('/api/work-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(payload)
      .expect(201);

    expect(response1.body.id).toBe(response2.body.id);
    expect(response1.body.title).toBe(response2.body.title);
    expect(response1.body.version).toBe(response2.body.version);

    const items = await prisma.workItem.findMany({
      where: { title: 'Idempotency Test Item', teamId: testTeamId },
    });
    expect(items.length).toBe(1);
  });

  it('should return same response for duplicate PATCH with same idempotency key', async () => {
    const item = await prisma.workItem.create({
      data: {
        title: 'Idempotency Patch Test',
        type: 'TASK',
        status: 'OPEN',
        priority: 'MEDIUM',
        teamId: testTeamId,
        reporterId: adminUserId,
        version: 1,
      },
    });

    const patchKey = 'patch-' + idempotencyKey;

    const response1 = await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', patchKey)
      .send({ title: 'Patched Title', version: 1 })
      .expect(200);

    const response2 = await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', patchKey)
      .send({ title: 'Patched Title', version: 1 })
      .expect(200);

    expect(response1.body.id).toBe(response2.body.id);
    expect(response1.body.version).toBe(response2.body.version);
    expect(response1.body.title).toBe('Patched Title');

    await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
    await prisma.workItem.delete({ where: { id: item.id } });
  });

  it('should not apply idempotency when key is not provided', async () => {
    const item = await prisma.workItem.create({
      data: {
        title: 'Idempotency No Key Test',
        type: 'TASK',
        status: 'OPEN',
        priority: 'MEDIUM',
        teamId: testTeamId,
        reporterId: adminUserId,
        version: 1,
      },
    });

    await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'First Patch', version: 1 })
      .expect(200);

    await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Second Patch', version: 2 })
      .expect(200);

    const finalItem = await prisma.workItem.findUnique({ where: { id: item.id } });
    expect(finalItem!.title).toBe('Second Patch');
    expect(finalItem!.version).toBe(3);

    await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
    await prisma.workItem.delete({ where: { id: item.id } });
  });

  it('should cache error responses with idempotency key', async () => {
    const payload = {
      title: 'Invalid Item',
      description: 'Missing required fields',
      type: 'INVALID_TYPE',
      priority: 'MEDIUM',
      teamId: testTeamId,
    };

    const response1 = await request
      .post('/api/work-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', 'error-key-' + idempotencyKey)
      .send(payload)
      .expect(400);

    const response2 = await request
      .post('/api/work-items')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', 'error-key-' + idempotencyKey)
      .send(payload)
      .expect(400);

    expect(response1.body.error.code).toBe(response2.body.error.code);
    expect(response1.body.error.message).toBe(response2.body.error.message);
  });

  it('should work with different users having different keys for same operation', async () => {
    const viewer = await prisma.user.findUnique({ where: { email: 'viewer@newtonite.com' } });
    const viewerToken = jwt.sign({ userId: viewer!.id }, config.jwtSecret, { expiresIn: '8h' });

    const item = await prisma.workItem.create({
      data: {
        title: 'Multi User Idempotency',
        type: 'TASK',
        status: 'OPEN',
        priority: 'MEDIUM',
        teamId: testTeamId,
        reporterId: adminUserId,
        version: 1,
      },
    });

    await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .set('Idempotency-Key', 'user1-key')
      .send({ title: 'User 1 Update', version: 1 })
      .expect(200);

    const response2 = await request
      .patch(`/api/work-items/${item.id}`)
      .set('Authorization', `Bearer ${viewerToken}`)
      .set('Idempotency-Key', 'user2-key')
      .send({ title: 'User 2 Update', version: 2 })
      .expect(403);

    expect(response2.body.error.code).toBe('FORBIDDEN');

    await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
    await prisma.workItem.delete({ where: { id: item.id } });
  });
});