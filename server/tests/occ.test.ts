import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app';
import prisma from '../src/utils/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const request = supertest(app);

describe('Optimistic Concurrency Control (OCC)', () => {
  let adminToken: string;
  let adminUserId: string;
  let testWorkItemId: string;
  let testTeamId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@newtonite.com' } });
    adminUserId = admin!.id;
    const membership = await prisma.teamMember.findFirst({ where: { userId: adminUserId } });
    testTeamId = membership!.teamId;

    adminToken = jwt.sign({ userId: adminUserId }, config.jwtSecret, { expiresIn: '8h' });

    const item = await prisma.workItem.create({
      data: {
        title: 'OCC Test Item',
        description: 'Test for optimistic concurrency control',
        type: 'TASK',
        status: 'OPEN',
        priority: 'MEDIUM',
        teamId: testTeamId,
        reporterId: adminUserId,
        version: 1,
      },
    });
    testWorkItemId = item.id;
  });

  afterAll(async () => {
    await prisma.workItemEvent.deleteMany({ where: { workItemId: testWorkItemId } });
    await prisma.workItem.delete({ where: { id: testWorkItemId } });
  });

  beforeEach(async () => {
    await prisma.workItem.update({
      where: { id: testWorkItemId },
      data: { version: 1, title: 'OCC Test Item' },
    });
  });

  it('should reject second update with stale version (409 Conflict)', async () => {
    const getItem = await request
      .get(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const version = getItem.body.version;
    expect(version).toBe(1);

    await request
      .patch(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'First Update', version })
      .expect(200);

    const conflictResponse = await request
      .patch(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Second Update (stale)', version })
      .expect(409);

    expect(conflictResponse.body.error.code).toBe('CONFLICT');
    expect(conflictResponse.body.error.currentState).toBeDefined();
    expect(conflictResponse.body.error.currentState.version).toBe(2);
    expect(conflictResponse.body.error.currentState.title).toBe('First Update');
  });

  it('should reject transition with stale version', async () => {
    const getItem = await request
      .get(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const version = getItem.body.version;

    await request
      .post(`/api/work-items/${testWorkItemId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS', version })
      .expect(200);

    const conflictResponse = await request
      .post(`/api/work-items/${testWorkItemId}/transition`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED', version })
      .expect(409);

    expect(conflictResponse.body.error.code).toBe('CONFLICT');
    expect(conflictResponse.body.error.currentState.status).toBe('IN_PROGRESS');
    expect(conflictResponse.body.error.currentState.version).toBe(version + 1);
  });

  it('should reject assign with stale version', async () => {
    const getItem = await request
      .get(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const version = getItem.body.version;

    await request
      .post(`/api/work-items/${testWorkItemId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: adminUserId, version })
      .expect(200);

    const conflictResponse = await request
      .post(`/api/work-items/${testWorkItemId}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assigneeId: null, version })
      .expect(409);

    expect(conflictResponse.body.error.code).toBe('CONFLICT');
    expect(conflictResponse.body.error.currentState.assignee.id).toBe(adminUserId);
    expect(conflictResponse.body.error.currentState.version).toBe(version + 1);
  });

  it('should increment version on successful update', async () => {
    const getItem = await request
      .get(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const version = getItem.body.version;

    const update1 = await request
      .patch(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Update 1', version })
      .expect(200);

    expect(update1.body.version).toBe(version + 1);

    const getItem2 = await request
      .get(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const update2 = await request
      .patch(`/api/work-items/${testWorkItemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ title: 'Update 2', version: update1.body.version })
      .expect(200);

    expect(update2.body.version).toBe(version + 2);
  });
});