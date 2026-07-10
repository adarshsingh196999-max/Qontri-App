import { db, auditLogsTable } from "@workspace/db";

export async function logAudit(
  action: string,
  adminEmail: string | null,
  targetEmail?: string | null,
  details?: string
): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      action,
      adminEmail,
      targetEmail: targetEmail ?? null,
      details: details ?? "",
    });
  } catch {
    // Audit failures must never crash the main flow
  }
}
