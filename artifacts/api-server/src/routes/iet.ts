import { and, desc, eq } from "drizzle-orm";
import { Router } from "express";
import { db, ietExpensesTable, userProfilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/iet", requireAuth, async (req, res) => {
  const email = req.user!.email;
  try {
    const rows = await db
      .select()
      .from(ietExpensesTable)
      .where(eq(ietExpensesTable.userEmail, email))
      .orderBy(desc(ietExpensesTable.date));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch IET expenses");
    res.status(500).json({ error: "Failed to fetch IET expenses" });
  }
});

router.post("/iet", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { id, title, amount, category, date } = req.body as {
    id?: string;
    title?: string;
    amount?: number;
    category?: string;
    date?: string;
  };

  if (!title?.trim()) {
    res.status(400).json({ error: "title is required" });
    return;
  }
  if (typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }
  if (!date) {
    res.status(400).json({ error: "date is required" });
    return;
  }

  const expenseId = id ?? `iet_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    await db.insert(ietExpensesTable).values({
      id: expenseId,
      userEmail: email,
      title: title.trim(),
      amount,
      category: category ?? "Other",
      date,
    });
    const rows = await db
      .select()
      .from(ietExpensesTable)
      .where(eq(ietExpensesTable.id, expenseId))
      .limit(1);
    res.status(201).json(rows[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to create IET expense");
    res.status(500).json({ error: "Failed to create IET expense" });
  }
});

router.put("/iet/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;
  const { title, amount, category, date } = req.body as {
    title?: string;
    amount?: number;
    category?: string;
    date?: string;
  };

  if (!title?.trim()) { res.status(400).json({ error: "title is required" }); return; }
  if (typeof amount !== "number" || amount <= 0) { res.status(400).json({ error: "amount must be positive" }); return; }
  if (!date) { res.status(400).json({ error: "date is required" }); return; }

  try {
    const rows = await db.select().from(ietExpensesTable)
      .where(and(eq(ietExpensesTable.id, id), eq(ietExpensesTable.userEmail, email))).limit(1);
    if (rows.length === 0) { res.status(404).json({ error: "Expense not found" }); return; }

    await db.update(ietExpensesTable)
      .set({ title: title.trim(), amount, category: category ?? "Other", date })
      .where(and(eq(ietExpensesTable.id, id), eq(ietExpensesTable.userEmail, email)));

    const updated = await db.select().from(ietExpensesTable).where(eq(ietExpensesTable.id, id)).limit(1);
    res.json(updated[0]);
  } catch (err) {
    req.log.error({ err }, "Failed to update IET expense");
    res.status(500).json({ error: "Failed to update expense" });
  }
});

router.delete("/iet/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params["id"] as string;

  try {
    const rows = await db
      .select()
      .from(ietExpensesTable)
      .where(and(eq(ietExpensesTable.id, id), eq(ietExpensesTable.userEmail, email)))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Expense not found" });
      return;
    }

    await db
      .delete(ietExpensesTable)
      .where(and(eq(ietExpensesTable.id, id), eq(ietExpensesTable.userEmail, email)));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete IET expense");
    res.status(500).json({ error: "Failed to delete IET expense" });
  }
});

// ── Budget ────────────────────────────────────────────────────────────────────

router.get("/iet/budget", requireAuth, async (req, res) => {
  const email = req.user!.email;
  try {
    const rows = await db
      .select({ ietBudget: userProfilesTable.ietBudget })
      .from(userProfilesTable)
      .where(eq(userProfilesTable.email, email))
      .limit(1);
    res.json({ budget: rows[0]?.ietBudget ?? 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch IET budget");
    res.status(500).json({ error: "Failed to fetch budget" });
  }
});

router.put("/iet/budget", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { budget } = req.body as { budget?: number };
  if (typeof budget !== "number" || budget < 0) {
    res.status(400).json({ error: "budget must be a non-negative number" });
    return;
  }
  try {
    await db
      .insert(userProfilesTable)
      .values({ email, ietBudget: budget })
      .onConflictDoUpdate({
        target: userProfilesTable.email,
        set: { ietBudget: budget, updatedAt: new Date() },
      });
    res.json({ budget });
  } catch (err) {
    req.log.error({ err }, "Failed to update IET budget");
    res.status(500).json({ error: "Failed to update budget" });
  }
});

export default router;
