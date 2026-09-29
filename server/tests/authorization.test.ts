import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { app } from '../src/app';
import prisma from '../src/utils/prisma';
import jwt from 'jsonwebtoken';
import { config } from '../src/config';

const request = supertest(app);

describe('Resource-Level Authorization', () => {
  let adminToken: string;
  let adminUserId: string;
  let managerToken: string;
  let managerUserId: string;
  let memberToken: string;
  let memberUserId: string;
  let viewerToken: string;
  let viewerUserId: string;
  let testTeamId: string;
  let testWorkItemId: string;

  beforeAll(async () => {
    const admin = await prisma.user.findUnique({ where: { email: 'admin@newtonite.com' } });
    adminUserId = admin!.id;
    adminToken = jwt.sign({ userId: adminUserId }, config.jwtSecret, { expiresIn: '8h' });

    const manager = await prisma.user.findUnique({ where: { email: 'manager@newtonite.com' } });
    managerUserId = manager!.id;
    managerToken = jwt.sign({ userId: managerUserId }, config.jwtSecret, { expiresIn: '8h' });

    const member = await prisma.user.findUnique({ where: { email: 'member@newtonite.com' } });
    memberUserId = member!.id;
    memberToken = jwt.sign({ userId: memberUserId }, config.jwtSecret, { expiresIn: '8h' });

    const viewer = await prisma.user.findUnique({ where: { email: 'viewer@newtonite.com' } });
    viewerUserId = viewer!.id;
    viewerToken = jwt.sign({ userId: viewerUserId }, config.jwtSecret, { expiresIn: '8h' });

    const adminMembership = await prisma.teamMember.findFirst({ where: { userId: adminUserId } });
    testTeamId = adminMembership!.teamId;

    const item = await prisma.workItem.create({
      data: {
        title: 'Auth Test Item',
        description: 'Test for authorization',
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

  beforeEach(async () => {
    // Reset the test work item to OPEN status before each test
    await prisma.workItem.update({
      where: { id: testWorkItemId },
      data: { status: 'OPEN', version: 1 },
    });
    // Clean up events for this item
    await prisma.workItemEvent.deleteMany({ where: { workItemId: testWorkItemId } });
  });

  afterAll(async () => {
    await prisma.workItemEvent.deleteMany({ where: { workItemId: testWorkItemId } });
    await prisma.workItem.delete({ where: { id: testWorkItemId } });
  });

  describe('VIEWER role', () => {
    it('should allow viewing work items', async () => {
      await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('should allow listing work items', async () => {
      await request
        .get('/api/work-items')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(200);
    });

    it('should NOT allow creating work items', async () => {
      await request
        .post('/api/work-items')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          title: 'Viewer Create Test',
          type: 'TASK',
          priority: 'MEDIUM',
          teamId: testTeamId,
        })
        .expect(403);
    });

    it('should NOT allow updating work items', async () => {
      await request
        .patch(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ title: 'Viewer Update', version: 1 })
        .expect(403);
    });

    it('should NOT allow transitioning work items', async () => {
      await request
        .post(`/api/work-items/${testWorkItemId}/transition`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ status: 'IN_PROGRESS', version: 1 })
        .expect(403);
    });

    it('should NOT allow assigning work items', async () => {
      await request
        .post(`/api/work-items/${testWorkItemId}/assign`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ assigneeId: viewerUserId, version: 1 })
        .expect(403);
    });

    it('should allow adding comments', async () => {
      await request
        .post(`/api/work-items/${testWorkItemId}/comments`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ body: 'Viewer comment' })
        .expect(201);
    });
  });

  describe('MEMBER role', () => {
    it('should allow creating work items', async () => {
      await request
        .post('/api/work-items')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          title: 'Member Create Test',
          type: 'TASK',
          priority: 'MEDIUM',
          teamId: testTeamId,
        })
        .expect(201);
    });

    it('should allow updating own work items', async () => {
      const item = await prisma.workItem.create({
        data: {
          title: 'Member Own Item',
          type: 'TASK',
          status: 'OPEN',
          priority: 'MEDIUM',
          teamId: testTeamId,
          reporterId: memberUserId,
          version: 1,
        },
      });

      const getItem = await request
        .get(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request
        .patch(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Member Updated', version: getItem.body.version })
        .expect(200);

      await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
      await prisma.workItem.delete({ where: { id: item.id } });
    });

    it('should NOT allow updating other users work items', async () => {
      const getItem = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request
        .patch(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ title: 'Member Unauthorized Update', version: getItem.body.version })
        .expect(403);
    });

    it('should allow transitioning work items', async () => {
      const getItem = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${testWorkItemId}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'IN_PROGRESS', version: getItem.body.version })
        .expect(200);
    });

    it('should allow assigning work items', async () => {
      const getItem = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${testWorkItemId}/assign`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ assigneeId: memberUserId, version: getItem.body.version })
        .expect(200);
    });

    it('should allow closing own work items', async () => {
      const item = await prisma.workItem.create({
        data: {
          title: 'Member Close Test',
          type: 'TASK',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          teamId: testTeamId,
          reporterId: memberUserId,
          version: 1,
        },
      });

      const getItem = await request
        .get(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${item.id}/transition`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'CLOSED', version: getItem.body.version })
        .expect(200);

      await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
      await prisma.workItem.delete({ where: { id: item.id } });
    });
  });

  describe('MANAGER role', () => {
    it('should allow updating any work item in team', async () => {
      const getItem = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      await request
        .patch(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ title: 'Manager Updated Any', version: getItem.body.version })
        .expect(200);
    });

    it('should allow closing any work item in team', async () => {
      const item = await prisma.workItem.create({
        data: {
          title: 'Manager Close Any Test',
          type: 'TASK',
          status: 'RESOLVED',
          priority: 'MEDIUM',
          teamId: testTeamId,
          reporterId: adminUserId,
          version: 1,
        },
      });

      const getItem = await request
        .get(`/api/work-items/${item.id}`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${item.id}/transition`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ status: 'CLOSED', version: getItem.body.version })
        .expect(200);

      await prisma.workItemEvent.deleteMany({ where: { workItemId: item.id } });
      await prisma.workItem.delete({ where: { id: item.id } });
    });

    it('should allow managing team members', async () => {
      await request
        .get(`/api/teams/${testTeamId}/members`)
        .set('Authorization', `Bearer ${managerToken}`)
        .expect(200);
    });
  });

  describe('ADMIN role', () => {
    it('should allow all operations', async () => {
      await request
        .post('/api/work-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Admin Create',
          type: 'TASK',
          priority: 'MEDIUM',
          teamId: testTeamId,
        })
        .expect(201);

      const getItem = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request
        .patch(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Update', version: getItem.body.version })
        .expect(200);

      const getItem2 = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${testWorkItemId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'IN_PROGRESS', version: getItem2.body.version })
        .expect(200);

      const getItem3 = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${testWorkItemId}/transition`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED', version: getItem3.body.version })
        .expect(200);

      const getItem4 = await request
        .get(`/api/work-items/${testWorkItemId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await request
        .post(`/api/work-items/${testWorkItemId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: adminUserId, version: getItem4.body.version })
        .expect(200);
    });

    it('should allow team management', async () => {
      await request
        .get(`/api/teams/${testTeamId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('Cross-team access', () => {
    it('should NOT allow access to work items in teams user is not a member of', async () => {
      const financeTeam = await prisma.team.findFirst({ where: { name: 'Finance' } });
      if (!financeTeam) return;

      const financeItem = await prisma.workItem.create({
        data: {
          title: 'Finance Team Item',
          type: 'TASK',
          status: 'OPEN',
          priority: 'MEDIUM',
          teamId: financeTeam.id,
          reporterId: adminUserId,
          version: 1,
        },
      });

      await request
        .get(`/api/work-items/${financeItem.id}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      await prisma.workItemEvent.deleteMany({ where: { workItemId: financeItem.id } });
      await prisma.workItem.delete({ where: { id: financeItem.id } });
    });
  });
});