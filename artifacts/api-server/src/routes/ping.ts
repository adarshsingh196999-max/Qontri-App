import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import { db, userAppOpensTable } from "@workspace/db";

const router = Router();

router.post("/ping", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const date = new Date().toISOString().slice(0, 10);
  const now = new Date();

  try {
    await db
      .insert(userAppOpensTable)
      .values({ email, date, lastSeenAt: now })
      .onConflictDoUpdate({
        target: [userAppOpensTable.email, userAppOpensTable.date],
        set: { lastSeenAt: now },
      });
    res.json({ ok: true });
  } catch (err) {
    req.log.warn({ err }, "Ping upsert failed");
    res.json({ ok: false });
  }
});

export default router;
