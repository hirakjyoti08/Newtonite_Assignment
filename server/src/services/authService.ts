import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { UserResponse, TeamRole } from '../shared/types';
import prisma from '../utils/prisma';
import { UnauthorizedError, ConflictError } from '../utils/errors';

export async function register(email: string, password: string, name: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
    },
  });

  return user;
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      teamMemberships: {
        include: { team: true },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const token = jwt.sign({ userId: user.id }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });

  const userResponse: UserResponse = {
    id: user.id,
    email: user.email,
    name: user.name,
    teams: user.teamMemberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      role: m.role as TeamRole,
    })),
  };

  return { token, user: userResponse };
}

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      teamMemberships: {
        include: { team: true },
      },
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    teams: user.teamMemberships.map((m) => ({
      teamId: m.teamId,
      teamName: m.team.name,
      role: m.role as TeamRole,
    })),
  };
}