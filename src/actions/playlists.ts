"use server";

import { db } from "@/db/client";
import { mutationLogs } from "@/db/schema";
import { assertAdminSecret, type ActionResult } from "@/lib/admin";

export async function logMutation(kind: typeof mutationLogs.$inferInsert.kind, summary: string, entityId?: string) {
  await db.insert(mutationLogs).values({ kind, summary, entityId });
}

export async function verifyWrite(secret: string): Promise<ActionResult> {
  return assertAdminSecret(secret);
}
