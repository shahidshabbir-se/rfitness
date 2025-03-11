import type { User } from '~/types/index.ts'

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function getUserByUsername(username: string): Promise<User | null> {
  const user = await prisma.user.findUnique({ where: { name: username } });

  if (!user) return null;

  const role = user.role === "admin" || user.role === "staff" ? user.role : "staff";

  return {
    id: user.id,
    name: user.name,
    password: user.password,
    email: user.email,
    role,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
  };
}

export async function createUser(user: Omit<User, "id" | "createdAt" | "lastLogin">) {
  const hashedPassword = await bcrypt.hash(user.password, 10);
  return await prisma.user.create({
    data: { ...user, password: hashedPassword },
  });
}

export async function updateLastLogin(name: string) {
  await prisma.user.update({
    where: { name },
    data: { lastLogin: new Date() },
  });
}

export async function verifyPassword(user: User, password: string) {
  return bcrypt.compare(password, user.password);
}

export async function getAllUsers() {
  return await prisma.user.findMany({ orderBy: { name: "asc" } });
}

