"use server";

import { assertAdminSecret, type ActionResult } from "@/lib/admin";

export async function refreshSource(input: {
  adminSecret: string;
  playlistId: string;
  sourceId: string;
  sourceUrl: string;
}): Promise<ActionResult<{ message: string }>> {
  const auth = assertAdminSecret(input.adminSecret);
  if (!auth.ok) return auth;

  if (!input.sourceUrl.trim()) {
    return { ok: false, error: "Source URL is required before refresh." };
  }

  return {
    ok: true,
    data: {
      message: "Refresh placeholder ran. Task 10 will replace this with a real source sync."
    }
  };
}
