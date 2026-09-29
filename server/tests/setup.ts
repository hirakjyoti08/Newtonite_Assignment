/**
 * Shared test setup for Vitest.
 *
 * This file runs before each test suite. It:
 * 1. Loads environment variables (ensures test DB connection works)
 * 2. Verifies the database is seeded with required test users
 * 3. Exports helper utilities for common test operations
 *
 * Prerequisites:
 *   - PostgreSQL running (via Docker Compose)
 *   - Database migrated and seeded (`npm run db:migrate && npm run db:seed`)
 */

import { beforeAll, afterAll } from 'vitest';
import prisma from '../src/utils/prisma';

// Verify database connectivity and seed data before running any tests
beforeAll(async () => {
  try {
    // Verify DB connection
    await prisma.$connect();

    // Verify required seed users exist
    const requiredUsers = [
      'admin@newtonite.com',
      'manager@newtonite.com',
      'member@newtonite.com',
      'viewer@newtonite.com',
    ];

    for (const email of requiredUsers) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error(
          `Required seed user '${email}' not found. Run 'npm run db:seed' before running tests.`
        );
      }
    }

    // Verify at least one team exists
    const teamCount = await prisma.team.count();
    if (teamCount === 0) {
      throw new Error(
        'No teams found in database. Run \'npm run db:seed\' before running tests.'
      );
    }
  } catch (error) {
    console.error('Test setup failed:', error);
    throw error;
  }
});

// Disconnect Prisma after all tests complete
afterAll(async () => {
  await prisma.$disconnect();
});
