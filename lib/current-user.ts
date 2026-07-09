import { prisma } from "@/lib/prisma";

/**
 * Stand-in for auth (login method is still an open decision — see
 * SETUP.md). Every mutation needs *some* acting person, so this
 * resolves to the seeded admin until real sessions exist.
 */
export async function getCurrentUser() {
  const user = await prisma.person.findFirst({
    where: { role: "Admin" },
    orderBy: { createdAt: "asc" },
  });
  if (!user) {
    throw new Error("No seeded user found — run `npx prisma db seed`.");
  }
  return user;
}
