"use server";

import { assertAdminSecret, type ActionResult } from "@/lib/admin";

export async function validateAdminSecret(secret: string): Promise<ActionResult> {
  return assertAdminSecret(secret);
}
