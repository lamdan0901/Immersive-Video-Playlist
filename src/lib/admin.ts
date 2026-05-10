import "server-only";

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; conflict?: boolean };

export function assertAdminSecret(secret: string | null | undefined): ActionResult {
  const expected = process.env.ADMIN_SECRET;

  if (!expected) {
    return { ok: false, error: "ADMIN_SECRET is not configured" };
  }

  if (!secret || secret !== expected) {
    return { ok: false, error: "Admin unlock required" };
  }

  return { ok: true, data: undefined };
}
