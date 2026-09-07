import { prisma } from "@/lib/prisma";

// This is a single-user application (PRD section 33/44). There is exactly one
// User row, created lazily on first access, identified by APP_USER_EMAIL.

const DEFAULT_EMAIL = process.env.APP_USER_EMAIL || "sysadmin@ispirt.in";

let cachedUserId: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  if (cachedUserId) return cachedUserId;

  const user = await prisma.user.upsert({
    where: { email: DEFAULT_EMAIL },
    update: {},
    create: { email: DEFAULT_EMAIL, name: "Inbound Ideas User" },
  });

  cachedUserId = user.id;
  return user.id;
}
