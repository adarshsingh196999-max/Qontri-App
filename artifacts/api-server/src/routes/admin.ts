import { count, desc, eq, gte, isNotNull, sql, and, inArray, sum, max } from "drizzle-orm";
import { Router } from "express";
import {
  db,
  tripsTable,
  usersTable,
  userProfilesTable,
  groupsTable,
  groupMembersTable,
  expensesTable,
  settlementsTable,
  ietExpensesTable,
  businessTripsTable,
  businessTripBillsTable,
  auditLogsTable,
  userAppOpensTable,
} from "@workspace/db";
import { logAudit } from "../utils/audit";
import { getMetrics } from "../middlewares/metrics";

const router = Router();

function requireAdmin(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"] as string | undefined;
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  const secret = process.env["ADMIN_SECRET"];

  if (!secret) {
    res.status(500).json({ error: "ADMIN_SECRET not configured" });
    return;
  }

  if (!token || token !== secret) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

// ── Login ──────────────────────────────────────────────────────────────────────

router.post("/admin/login", async (req, res) => {
  const { password } = req.body as { password?: string };
  const secret = process.env["ADMIN_SECRET"];

  if (!secret) {
    res.status(500).json({ error: "ADMIN_SECRET not configured on server" });
    return;
  }

  if (!password || password !== secret) {
    await logAudit("admin_login_failed", null, null, "Invalid password attempt");
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  await logAudit("admin_login", "admin", null, "Successful admin login");
  req.log.info("Admin login successful");
  res.json({ success: true });
});

// ── Analytics ─────────────────────────────────────────────────────────────────

router.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const now = new Date();

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOf30Days = new Date(now);
    startOf30Days.setDate(now.getDate() - 29);
    startOf30Days.setHours(0, 0, 0, 0);

    // ISO date strings for user_app_opens (text column, lexicographic comparison works)
    const todayDate = now.toISOString().slice(0, 10);
    const weekAgoDate = startOfWeek.toISOString().slice(0, 10);
    const monthAgoDate = startOf30Days.toISOString().slice(0, 10);

    const [
      totalUsersRows,
      newTodayRows,
      usersThisWeekRows,
      blockedRows,
      verifiedRows,
      dauRows,
      wauRows,
      mauRows,
      totalGroupsRows,
      totalIetRows,
      totalBizRows,
      signupsByDayRows,
      topGroupOwnersRows,
      expensesTodayRows,
      settledTodayRows,
      ietTodayRows,
      dauUsersRows,
      wauUsersRows,
    ] = await Promise.all([
      db.select({ count: count() }).from(usersTable),
      db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startOfToday)),
      db.select({ count: count() }).from(usersTable).where(gte(usersTable.createdAt, startOfWeek)),
      db.select({ count: count() }).from(usersTable).where(isNotNull(usersTable.blockedAt)),
      db.select({ count: count() }).from(userProfilesTable).where(sql`name != ''`),
      // True DAU: distinct users who opened the app today (via /ping)
      db.select({ count: count() }).from(userAppOpensTable).where(eq(userAppOpensTable.date, todayDate)),
      // True WAU: distinct users active in the last 7 days
      db.select({ count: sql<number>`COUNT(DISTINCT email)` }).from(userAppOpensTable).where(gte(userAppOpensTable.date, weekAgoDate)),
      // True MAU: distinct users active in the last 30 days
      db.select({ count: sql<number>`COUNT(DISTINCT email)` }).from(userAppOpensTable).where(gte(userAppOpensTable.date, monthAgoDate)),
      db.select({ count: count() }).from(groupsTable),
      db.select({ count: count() }).from(ietExpensesTable),
      db.select({ count: count() }).from(businessTripsTable),
      db
        .select({ date: sql<string>`DATE(created_at)::text`, count: count() })
        .from(usersTable)
        .where(gte(usersTable.createdAt, startOf30Days))
        .groupBy(sql`DATE(created_at)`)
        .orderBy(sql`DATE(created_at)`),
      db
        .select({ email: groupsTable.ownerEmail, groupCount: count() })
        .from(groupsTable)
        .groupBy(groupsTable.ownerEmail)
        .orderBy(desc(count()))
        .limit(10),
      // Today's activity
      db.select({ count: count() }).from(expensesTable).where(gte(expensesTable.createdAt, startOfToday)),
      db.select({ total: sum(settlementsTable.amount) }).from(settlementsTable).where(gte(settlementsTable.createdAt, startOfToday)),
      db.select({ count: count() }).from(ietExpensesTable).where(gte(ietExpensesTable.createdAt, startOfToday)),
      // Who was active today (for list view)
      db
        .select({ email: userAppOpensTable.email, lastSeen: userAppOpensTable.lastSeenAt })
        .from(userAppOpensTable)
        .where(eq(userAppOpensTable.date, todayDate))
        .orderBy(desc(userAppOpensTable.lastSeenAt))
        .limit(100),
      // Who was active this week (most recent session per user)
      db
        .select({ email: userAppOpensTable.email, lastSeen: max(userAppOpensTable.lastSeenAt) })
        .from(userAppOpensTable)
        .where(gte(userAppOpensTable.date, weekAgoDate))
        .groupBy(userAppOpensTable.email)
        .orderBy(desc(max(userAppOpensTable.lastSeenAt)))
        .limit(50),
    ]);

    const metrics = getMetrics();

    res.json({
      totalUsers: Number(totalUsersRows[0]?.count ?? 0),
      newUsersToday: Number(newTodayRows[0]?.count ?? 0),
      newUsersThisWeek: Number(usersThisWeekRows[0]?.count ?? 0),
      blockedUsers: Number(blockedRows[0]?.count ?? 0),
      verifiedUsers: Number(verifiedRows[0]?.count ?? 0),
      dau: Number(dauRows[0]?.count ?? 0),
      wau: Number(wauRows[0]?.count ?? 0),
      mau: Number(mauRows[0]?.count ?? 0),
      totalGroups: Number(totalGroupsRows[0]?.count ?? 0),
      totalIetExpenses: Number(totalIetRows[0]?.count ?? 0),
      totalBusinessTrips: Number(totalBizRows[0]?.count ?? 0),
      signupsByDay: signupsByDayRows.map((r) => ({ date: r.date, count: Number(r.count) })),
      topGroupOwners: topGroupOwnersRows.map((r) => ({ email: r.email, groupCount: Number(r.groupCount) })),
      // Today's summary extras
      expensesToday: Number(expensesTodayRows[0]?.count ?? 0),
      settledAmountToday: Number(settledTodayRows[0]?.total ?? 0),
      ietToday: Number(ietTodayRows[0]?.count ?? 0),
      serverErrors: metrics.requests.errors,
      uptimeSeconds: metrics.uptimeSeconds,
      // Active user lists
      dauUsers: dauUsersRows.map((r) => ({ email: r.email, lastSeen: r.lastSeen?.toISOString() ?? "" })),
      wauUsers: wauUsersRows.map((r) => ({ email: r.email, lastSeen: r.lastSeen?.toISOString() ?? "" })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin analytics");
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ── Users list ─────────────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (req, res) => {
  try {
    const rows = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        createdAt: usersTable.createdAt,
        blockedAt: usersTable.blockedAt,
        lastLoginAt: usersTable.lastLoginAt,
        groupsOwned: sql<number>`COALESCE((SELECT COUNT(*) FROM groups WHERE owner_email = users.email), 0)`,
        groupMemberships: sql<number>`COALESCE((SELECT COUNT(*) FROM group_members WHERE owner_email = users.email), 0)`,
        ietExpenses: sql<number>`COALESCE((SELECT COUNT(*) FROM iet_expenses WHERE user_email = users.email), 0)`,
        businessTrips: sql<number>`COALESCE((SELECT COUNT(*) FROM business_trips WHERE user_email = users.email), 0)`,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    res.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        createdAt: r.createdAt.toISOString(),
        isBlocked: r.blockedAt !== null,
        lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
        groupsOwned: Number(r.groupsOwned),
        groupMemberships: Number(r.groupMemberships),
        ietExpenses: Number(r.ietExpenses),
        businessTrips: Number(r.businessTrips),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin users");
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ── User detail ────────────────────────────────────────────────────────────────

router.get("/admin/users/:email/detail", requireAdmin, async (req, res) => {
  const email = req.params["email"] as string;

  try {
    const [profileRows, userRows, groupRows, membershipRows, ietRows, tripRows] = await Promise.all([
      db.select().from(userProfilesTable).where(eq(userProfilesTable.email, email)).limit(1),
      db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1),
      db.select().from(groupsTable).where(eq(groupsTable.ownerEmail, email)).orderBy(desc(groupsTable.createdAt)),
      db
        .select({ groupId: groupMembersTable.groupId, groupName: groupsTable.name, memberName: groupMembersTable.name })
        .from(groupMembersTable)
        .innerJoin(groupsTable, eq(groupMembersTable.groupId, groupsTable.id))
        .where(eq(groupMembersTable.ownerEmail, email)),
      db.select().from(ietExpensesTable).where(eq(ietExpensesTable.userEmail, email)).orderBy(desc(ietExpensesTable.createdAt)),
      db.select().from(businessTripsTable).where(eq(businessTripsTable.userEmail, email)).orderBy(desc(businessTripsTable.createdAt)),
    ]);

    const groupIds = groupRows.map((g) => g.id);

    const [billCountRows, expenseRows, settlementRows] = await Promise.all([
      Promise.all(
        tripRows.map((t) => db.select({ cnt: count() }).from(businessTripBillsTable).where(eq(businessTripBillsTable.tripId, t.id)))
      ),
      groupIds.length > 0
        ? db.select({
            id: expensesTable.id,
            title: expensesTable.title,
            amount: expensesTable.amount,
            category: expensesTable.category,
            date: expensesTable.date,
            groupId: expensesTable.groupId,
            groupName: groupsTable.name,
          })
          .from(expensesTable)
          .innerJoin(groupsTable, eq(expensesTable.groupId, groupsTable.id))
          .where(inArray(expensesTable.groupId, groupIds))
          .orderBy(desc(expensesTable.createdAt))
          .limit(30)
        : Promise.resolve([]),
      groupIds.length > 0
        ? db.select({
            id: settlementsTable.id,
            amount: settlementsTable.amount,
            date: settlementsTable.date,
            mode: settlementsTable.mode,
            groupId: settlementsTable.groupId,
            groupName: groupsTable.name,
          })
          .from(settlementsTable)
          .innerJoin(groupsTable, eq(settlementsTable.groupId, groupsTable.id))
          .where(inArray(settlementsTable.groupId, groupIds))
          .orderBy(desc(settlementsTable.createdAt))
          .limit(30)
        : Promise.resolve([]),
    ]);

    const user = userRows[0];
    const profile = profileRows[0];

    res.json({
      isBlocked: user ? user.blockedAt !== null : false,
      lastLoginAt: user?.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      profile: {
        name: profile?.name ?? "",
        upiId: profile?.upiId ?? "",
        travelStyle: profile?.travelStyle ?? "",
        avatar: profile?.avatar ?? "",
      },
      groups: groupRows.map((g) => ({
        id: g.id,
        name: g.name,
        emoji: g.emoji,
        createdAt: g.createdAt.toISOString(),
      })),
      groupMemberships: membershipRows.map((m) => ({
        groupId: m.groupId,
        groupName: m.groupName,
        memberName: m.memberName,
      })),
      expenses: expenseRows.map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: e.date,
        groupName: e.groupName,
      })),
      settlements: settlementRows.map((s) => ({
        id: s.id,
        amount: s.amount,
        date: s.date,
        mode: s.mode,
        groupName: s.groupName,
      })),
      ietExpenses: ietRows.map((e) => ({
        id: e.id,
        title: e.title,
        amount: e.amount,
        category: e.category,
        date: e.date,
      })),
      businessTrips: tripRows.map((t, i) => ({
        id: t.id,
        name: t.name,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        billCount: Number(billCountRows[i]?.[0]?.cnt ?? 0),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user detail");
    res.status(500).json({ error: "Failed to fetch user detail" });
  }
});

// ── Block / Unblock ───────────────────────────────────────────────────────────

router.post("/admin/users/:email/block", requireAdmin, async (req, res) => {
  const email = req.params["email"] as string;
  const { reason } = req.body as { reason?: string };

  try {
    const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.update(usersTable).set({ blockedAt: new Date() }).where(eq(usersTable.email, email));
    await logAudit("user_blocked", "admin", email, reason ?? "Blocked by admin");

    req.log.info({ email }, "User blocked");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to block user");
    res.status(500).json({ error: "Failed to block user" });
  }
});

router.post("/admin/users/:email/unblock", requireAdmin, async (req, res) => {
  const email = req.params["email"] as string;

  try {
    const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.update(usersTable).set({ blockedAt: null }).where(eq(usersTable.email, email));
    await logAudit("user_unblocked", "admin", email, "Unblocked by admin");

    req.log.info({ email }, "User unblocked");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to unblock user");
    res.status(500).json({ error: "Failed to unblock user" });
  }
});

// ── Delete user ────────────────────────────────────────────────────────────────

router.delete("/admin/users/:email", requireAdmin, async (req, res) => {
  const email = req.params["email"] as string;

  try {
    const rows = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email)).limit(1);
    if (rows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    await db.delete(ietExpensesTable).where(eq(ietExpensesTable.userEmail, email));
    await db.delete(businessTripsTable).where(eq(businessTripsTable.userEmail, email));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.email, email));
    await db.delete(usersTable).where(eq(usersTable.email, email));

    await logAudit("user_deleted", "admin", email, "Account deleted by admin");

    req.log.info({ email }, "User deleted");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete user");
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ── Export user data ──────────────────────────────────────────────────────────

router.get("/admin/users/:email/export", requireAdmin, async (req, res) => {
  const email = req.params["email"] as string;

  try {
    const [userRows, profileRows, groupRows, ietRows, tripRows] = await Promise.all([
      db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1),
      db.select().from(userProfilesTable).where(eq(userProfilesTable.email, email)).limit(1),
      db.select().from(groupsTable).where(eq(groupsTable.ownerEmail, email)).orderBy(desc(groupsTable.createdAt)),
      db.select().from(ietExpensesTable).where(eq(ietExpensesTable.userEmail, email)).orderBy(desc(ietExpensesTable.createdAt)),
      db.select().from(businessTripsTable).where(eq(businessTripsTable.userEmail, email)).orderBy(desc(businessTripsTable.createdAt)),
    ]);

    if (userRows.length === 0) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const exportData = {
      exportedAt: new Date().toISOString(),
      user: { email: userRows[0]?.email, createdAt: userRows[0]?.createdAt, lastLoginAt: userRows[0]?.lastLoginAt },
      profile: profileRows[0] ?? null,
      groups: groupRows,
      ietExpenses: ietRows,
      businessTrips: tripRows,
    };

    await logAudit("user_data_exported", "admin", email, "User data exported by admin");

    res.setHeader("Content-Disposition", `attachment; filename="user-export-${email}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportData);
  } catch (err) {
    req.log.error({ err }, "Failed to export user data");
    res.status(500).json({ error: "Failed to export user data" });
  }
});

// ── Performance dashboard ──────────────────────────────────────────────────────

router.get("/admin/performance", requireAdmin, (_req, res) => {
  res.json(getMetrics());
});

// ── Audit logs ────────────────────────────────────────────────────────────────

router.get("/admin/audit-logs", requireAdmin, async (req, res) => {
  try {
    const limitParam = req.query["limit"];
    const pageParam = req.query["page"];
    const actionFilter = req.query["action"] as string | undefined;

    const limit = Math.min(Number(limitParam) || 50, 200);
    const page = Math.max(Number(pageParam) || 1, 1);
    const offset = (page - 1) * limit;

    const whereClause = actionFilter ? eq(auditLogsTable.action, actionFilter) : undefined;

    const [rows, totalRows] = await Promise.all([
      db
        .select()
        .from(auditLogsTable)
        .where(whereClause)
        .orderBy(desc(auditLogsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(auditLogsTable).where(whereClause),
    ]);

    res.json({
      total: Number(totalRows[0]?.count ?? 0),
      page,
      limit,
      logs: rows.map((r) => ({
        id: r.id,
        action: r.action,
        adminEmail: r.adminEmail,
        targetEmail: r.targetEmail,
        details: r.details,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch audit logs");
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
});

// ── Legacy trips ──────────────────────────────────────────────────────────────

router.get("/admin/trips", requireAdmin, async (req, res) => {
  try {
    const rows = await db.select().from(tripsTable).orderBy(desc(tripsTable.createdAt));

    res.json(
      rows.map((t) => ({
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        ownerEmail: t.ownerEmail,
        memberCount: t.memberCount,
        createdAt: t.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch admin trips");
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

// One-time backfill endpoint: inserts historical activity into user_app_opens
// from users, groups, iet_expenses, business_trips tables.
router.post("/admin/backfill-activity", requireAdmin, async (req, res) => {
  try {
    const upsert = `ON CONFLICT (email, date) DO UPDATE SET last_seen_at = GREATEST(user_app_opens.last_seen_at, EXCLUDED.last_seen_at)`;

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT email, DATE(created_at)::text, created_at FROM users
      ${sql.raw(upsert)}`);

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT email, DATE(last_login_at)::text, last_login_at FROM users
      WHERE last_login_at IS NOT NULL
      ${sql.raw(upsert)}`);

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT owner_email, DATE(created_at)::text, created_at FROM groups
      ${sql.raw(upsert)}`);

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT user_email, DATE(created_at)::text, MAX(created_at) FROM iet_expenses
      GROUP BY user_email, DATE(created_at)::text
      ${sql.raw(upsert)}`);

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT user_email, DATE(created_at)::text, MAX(created_at) FROM business_trips
      GROUP BY user_email, DATE(created_at)::text
      ${sql.raw(upsert)}`);

    await db.execute(sql`INSERT INTO user_app_opens (email, date, last_seen_at)
      SELECT user_email, DATE(created_at)::text, MAX(created_at) FROM business_trip_bills
      GROUP BY user_email, DATE(created_at)::text
      ${sql.raw(upsert)}`);

    const countResult = await db.execute(
      sql`SELECT COUNT(*) as rows, COUNT(DISTINCT email) as users, COUNT(DISTINCT date) as days FROM user_app_opens`
    );
    res.json({ ok: true, table: countResult.rows[0] });
  } catch (err) {
    req.log.error({ err }, "Backfill failed");
    res.status(500).json({ error: "Backfill failed" });
  }
});

export default router;
