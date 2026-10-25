import { prismadb } from "@/lib/prisma";

export type MailboxDelegate = {
  id: string;
  name: string;
  email: string;
  workEmail: string | null;
};

export async function loadMailboxDelegates(ids: string[]): Promise<MailboxDelegate[]> {
  const unique = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
  if (unique.length === 0) return [];
  const users = await prismadb.users.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true, workEmail: true },
  });
  const byId = new Map(
    users.map((u) => [
      u.id,
      {
        id: u.id,
        name: u.name?.trim() || u.email,
        email: u.email,
        workEmail: u.workEmail,
      } satisfies MailboxDelegate,
    ])
  );
  return unique.flatMap((id) => {
    const person = byId.get(id);
    return person ? [person] : [];
  });
}
