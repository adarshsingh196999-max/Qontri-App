import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { and, gt, eq } from "drizzle-orm";
import { db, userSessionsTable } from "@workspace/db";

const SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";

export interface AuthPayload {
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const SESSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Create a DB-backed session. Survives any server restart. */
export async function createSession(email: string): Promise<string> {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 365 days
  await db.insert(userSessionsTable).values({ id, email, expiresAt });
  return id;
}

/** Legacy JWT signing — kept only for backward compat; new logins use createSession. */
export function signToken(email: string): string {
  return jwt.sign({ email }, SECRET, { expiresIn: "90d" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers["authorization"];
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = header.slice(7);

  // ── 1. DB session (new tokens) ─────────────────────────────────────────────
  if (SESSION_ID_RE.test(token)) {
    try {
      const rows = await db
        .select({ email: userSessionsTable.email })
        .from(userSessionsTable)
        .where(
          and(
            eq(userSessionsTable.id, token),
            gt(userSessionsTable.expiresAt, new Date()),
          ),
        )
        .limit(1);

      if (rows.length > 0) {
        req.user = { email: rows[0].email };
        next();
        return;
      }
    } catch (err) {
      req.log?.warn({ err }, "DB session lookup failed, falling through to JWT");
    }
  }

  // ── 2. Legacy JWT fallback (existing logged-in users) ─────────────────────
  try {
    const payload = jwt.verify(token, SECRET) as AuthPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
