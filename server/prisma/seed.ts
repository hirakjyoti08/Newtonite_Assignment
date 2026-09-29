import { PrismaClient, TeamRole, WorkItemType, WorkItemStatus, WorkItemPriority, EventAction } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Clear existing data in correct order (respecting foreign keys)
  await prisma.comment.deleteMany();
  await prisma.workItemEvent.deleteMany();
  await prisma.workItem.deleteMany();
  await prisma.teamMember.deleteMany();
  await prisma.team.deleteMany();
  await prisma.idempotencyKey.deleteMany();
  await prisma.user.deleteMany();

  console.log('🗑️  Cleared existing data');

  // Hash password for all users
  const passwordHash = await bcrypt.hash('password123', 10);

  // ─── Create Demo Users ───────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@newtonite.com',
      name: 'Alice Admin',
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@newtonite.com',
      name: 'Bob Manager',
      passwordHash,
    },
  });

  const member = await prisma.user.create({
    data: {
      email: 'member@newtonite.com',
      name: 'Carol Member',
      passwordHash,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      email: 'viewer@newtonite.com',
      name: 'Dave Viewer',
      passwordHash,
    },
  });

  // Create additional random users
  const randomUsers = await Promise.all(
    Array.from({ length: 6 }, () =>
      prisma.user.create({
        data: {
          email: faker.internet.email(),
          name: faker.person.fullName(),
          passwordHash,
        },
      })
    )
  );

  const allUsers = [admin, manager, member, viewer, ...randomUsers];
  console.log(`👥 Created ${allUsers.length} users`);

  // ─── Create Teams ────────────────────────────────────
  const engineering = await prisma.team.create({
    data: {
      name: 'Engineering',
      description: 'Core product development team',
    },
  });

  const customerSupport = await prisma.team.create({
    data: {
      name: 'Customer Support',
      description: 'Customer-facing support and success',
    },
  });

  const finance = await prisma.team.create({
    data: {
      name: 'Finance',
      description: 'Financial operations and reporting',
    },
  });

  const teams = [engineering, customerSupport, finance];
  console.log(`🏢 Created ${teams.length} teams`);

  // ─── Create Team Memberships ─────────────────────────
  await prisma.teamMember.createMany({
    data: [
      // Admin in all teams
      { userId: admin.id, teamId: engineering.id, role: TeamRole.ADMIN },
      { userId: admin.id, teamId: customerSupport.id, role: TeamRole.ADMIN },
      { userId: admin.id, teamId: finance.id, role: TeamRole.ADMIN },

      // Manager in Engineering and Customer Support
      { userId: manager.id, teamId: engineering.id, role: TeamRole.MANAGER },
      { userId: manager.id, teamId: customerSupport.id, role: TeamRole.MANAGER },

      // Member in Engineering, Viewer in Finance
      { userId: member.id, teamId: engineering.id, role: TeamRole.MEMBER },
      { userId: member.id, teamId: finance.id, role: TeamRole.VIEWER },

      // Viewer in Engineering only
      { userId: viewer.id, teamId: engineering.id, role: TeamRole.VIEWER },

      // Random users - assign to 1-3 teams with random roles
      ...randomUsers.flatMap((user) => {
        const userTeams = faker.helpers.shuffle(teams).slice(0, faker.number.int({ min: 1, max: 3 }));
        return userTeams.map((team) => ({
          userId: user.id,
          teamId: team.id,
          role: faker.helpers.arrayElement([TeamRole.MEMBER, TeamRole.VIEWER, TeamRole.MANAGER]),
        }));
      }),
    ],
  });

  console.log('🔗 Created team memberships');

  // ─── Create Work Items ───────────────────────────────
  const workItems = [];

  for (let i = 0; i < 50; i++) {
    const team = faker.helpers.arrayElement(teams);
    const teamMembers = await prisma.teamMember.findMany({ where: { teamId: team.id } });
    const reporter = faker.helpers.arrayElement(teamMembers).userId;
    const assignee = faker.helpers.maybe(() => faker.helpers.arrayElement(teamMembers).userId, { probability: 0.7 });

    const workItem = await prisma.workItem.create({
      data: {
        title: faker.helpers.arrayElement([
          'Fix login authentication flow',
          'Database connection pool exhaustion',
          'API rate limiting implementation',
          'Memory leak in data processing pipeline',
          'Update deprecated npm packages',
          'Add integration tests for payment flow',
          'Optimize slow dashboard queries',
          'Implement dark mode toggle',
          'Fix mobile responsive layout issues',
          'Add audit logging for admin actions',
          'Refactor user permission system',
          'Set up CI/CD pipeline for staging',
          'Migrate to TypeScript strict mode',
          'Implement request validation middleware',
          'Add database backup automation',
        ]),
        description: faker.lorem.paragraphs(2),
        type: faker.helpers.arrayElement(Object.values(WorkItemType)),
        status: faker.helpers.arrayElement(Object.values(WorkItemStatus)),
        priority: faker.helpers.arrayElement(Object.values(WorkItemPriority)),
        teamId: team.id,
        reporterId: reporter,
        assigneeId: assignee,
        dueDate: faker.helpers.maybe(() => faker.date.future({ days: 30 }), { probability: 0.5 }),
      },
    });

    workItems.push(workItem);
  }

  console.log(`📝 Created ${workItems.length} work items`);

  // ─── Create Work Item Events ─────────────────────────
  const events = [];

  for (const item of workItems) {
    // CREATED event
    events.push(
      prisma.workItemEvent.create({
        data: {
          workItemId: item.id,
          userId: item.reporterId,
          action: EventAction.CREATED,
          changes: null,
        },
      })
    );

    // Random additional events (status changes, assignments, etc.)
    const numEvents = faker.number.int({ min: 1, max: 4 });
    const teamMembers = await prisma.teamMember.findMany({ where: { teamId: item.teamId } });

    for (let e = 0; e < numEvents; e++) {
      const action = faker.helpers.arrayElement([
        EventAction.STATUS_CHANGED,
        EventAction.PRIORITY_CHANGED,
        EventAction.ASSIGNED,
        EventAction.UNASSIGNED,
        EventAction.UPDATED,
      ]);

      const user = faker.helpers.arrayElement(teamMembers).userId;

      let changes: Record<string, { from: unknown; to: unknown }> | null = null;

      if (action === EventAction.STATUS_CHANGED) {
        const statuses = Object.values(WorkItemStatus);
        const from = faker.helpers.arrayElement(statuses);
        const to = faker.helpers.arrayElement(statuses.filter((s) => s !== from));
        changes = { status: { from, to } };
      } else if (action === EventAction.PRIORITY_CHANGED) {
        const priorities = Object.values(WorkItemPriority);
        const from = faker.helpers.arrayElement(priorities);
        const to = faker.helpers.arrayElement(priorities.filter((p) => p !== from));
        changes = { priority: { from, to } };
      } else if (action === EventAction.ASSIGNED) {
        const assignee = faker.helpers.arrayElement(teamMembers).userId;
        changes = { assigneeId: { from: null, to: assignee } };
      } else if (action === EventAction.UNASSIGNED) {
        changes = { assigneeId: { from: item.assigneeId, to: null } };
      } else if (action === EventAction.UPDATED) {
        changes = { title: { from: 'Old title', to: item.title } };
      }

      events.push(
        prisma.workItemEvent.create({
          data: {
            workItemId: item.id,
            userId: user,
            action,
            changes,
          },
        })
      );
    }
  }

  await Promise.all(events);
  console.log(`📜 Created ${events.length} work item events`);

  // ─── Create Comments ─────────────────────────────────
  const comments = [];

  for (let i = 0; i < 35; i++) {
    const item = faker.helpers.arrayElement(workItems);
    const teamMembers = await prisma.teamMember.findMany({ where: { teamId: item.teamId } });
    const user = faker.helpers.arrayElement(teamMembers).userId;

    comments.push(
      prisma.comment.create({
        data: {
          workItemId: item.id,
          userId: user,
          body: faker.lorem.paragraph(),
        },
      })
    );
  }

  await Promise.all(comments);
  console.log(`💬 Created ${comments.length} comments`);

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });