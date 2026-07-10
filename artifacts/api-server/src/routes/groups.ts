import { and, eq, inArray } from "drizzle-orm";
import { Router } from "express";
import {
  activityEntriesTable,
  db,
  expenseSplitsTable,
  expensesTable,
  groupMembersTable,
  groupsTable,
  settlementsTable,
  userProfilesTable,
} from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

function tagFromSerial(serial: number): string {
  return `#${1000 + serial}`;
}

// ── Load all data for a set of groups ─────────────────────────────────────────

async function buildGroupPayloads(groupIds: string[]) {
  if (groupIds.length === 0) return [];

  const [allMembers, allExpenses, allSplits, allSettlements, allActivities] =
    await Promise.all([
      db.select().from(groupMembersTable).where(inArray(groupMembersTable.groupId, groupIds)),
      db.select().from(expensesTable).where(inArray(expensesTable.groupId, groupIds)),
      db
        .select()
        .from(expenseSplitsTable)
        .where(
          inArray(
            expenseSplitsTable.expenseId,
            (await db.select({ id: expensesTable.id }).from(expensesTable).where(inArray(expensesTable.groupId, groupIds))).map(
              (e) => e.id
            )
          )
        ),
      db.select().from(settlementsTable).where(inArray(settlementsTable.groupId, groupIds)),
      db.select().from(activityEntriesTable).where(inArray(activityEntriesTable.groupId, groupIds)),
    ]);

  const splitsMap = new Map<string, typeof allSplits>();
  for (const s of allSplits) {
    if (!splitsMap.has(s.expenseId)) splitsMap.set(s.expenseId, []);
    splitsMap.get(s.expenseId)!.push(s);
  }

  const ownerEmails = [...new Set(allMembers.map((m) => m.ownerEmail).filter((e): e is string => !!e))];
  const profiles = ownerEmails.length > 0
    ? await db
        .select({ email: userProfilesTable.email, name: userProfilesTable.name, travelStyle: userProfilesTable.travelStyle })
        .from(userProfilesTable)
        .where(inArray(userProfilesTable.email, ownerEmails))
    : [];
  const profileMap = new Map(profiles.map((p) => [p.email, { name: p.name, travelStyle: p.travelStyle }]));

  return groupIds.map((gid) => {
    const members = allMembers
      .filter((m) => m.groupId === gid)
      .map((m) => {
        const profile = m.ownerEmail ? profileMap.get(m.ownerEmail) : undefined;
        const emailUsername = m.ownerEmail ? m.ownerEmail.split("@")[0].replace(/[._]/g, " ") : undefined;
        return {
          id: m.memberLocalId,
          name: profile?.name?.trim() || m.name?.trim() || emailUsername || "Member",
          color: m.color,
          upiId: m.upiId ?? undefined,
          avatar: m.avatar ?? undefined,
          ownerEmail: m.ownerEmail ?? undefined,
          travelStyle: profile?.travelStyle || undefined,
        };
      });

    const expenses = allExpenses
      .filter((e) => e.groupId === gid)
      .map((e) => ({
        id: e.id,
        groupId: e.groupId,
        title: e.title,
        amount: e.amount,
        paidById: e.paidByMemberId,
        splitType: e.splitType,
        category: e.category,
        date: e.date,
        notes: e.notes ?? undefined,
        splits: (splitsMap.get(e.id) ?? []).map((s) => ({
          memberId: s.memberId,
          amount: s.amount,
          percentage: s.percentage ?? undefined,
        })),
      }));

    const settlements = allSettlements
      .filter((s) => s.groupId === gid)
      .map((s) => ({
        id: s.id,
        groupId: s.groupId,
        fromId: s.fromMemberId,
        toId: s.toMemberId,
        amount: s.amount,
        date: s.date,
        mode: s.mode,
      }));

    const activities = allActivities
      .filter((a) => a.groupId === gid)
      .map((a) => ({
        id: a.id,
        type: a.type,
        groupId: a.groupId,
        label: a.label,
        meta: a.meta,
        date: a.date,
      }));

    return { members, expenses, settlements, activities };
  });
}

// ── GET /groups ───────────────────────────────────────────────────────────────

router.get("/groups", requireAuth, async (req, res) => {
  const email = req.user!.email;
  try {
    // Find groups where user is a member
    const memberRows = await db
      .select({ groupId: groupMembersTable.groupId })
      .from(groupMembersTable)
      .where(eq(groupMembersTable.ownerEmail, email));

    const groupIds = [...new Set(memberRows.map((r) => r.groupId))];
    if (groupIds.length === 0) {
      res.json({ groups: [] });
      return;
    }

    const groups = await db.select().from(groupsTable).where(inArray(groupsTable.id, groupIds));
    const payloads = await buildGroupPayloads(groupIds);

    // Build a map from groupId → payload to avoid index-order mismatch
    // (DB SELECT WHERE id IN (...) does not guarantee same order as groupIds)
    const payloadMap = new Map(groupIds.map((gid, i) => [gid, payloads[i]]));

    const result = groups.map((g) => ({
      id: g.id,
      name: g.name,
      emoji: g.emoji,
      description: g.description ?? undefined,
      tagNumber: tagFromSerial(g.tagSerial),
      createdAt: g.createdAt.toISOString(),
      ...payloadMap.get(g.id),
    }));

    res.json({ groups: result });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch groups");
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

// ── POST /groups ──────────────────────────────────────────────────────────────

router.post("/groups", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { id, name, emoji, description, members } = req.body as {
    id: string;
    name: string;
    emoji: string;
    description?: string;
    members: Array<{
      id: string;
      name: string;
      color: string;
      upiId?: string;
      avatar?: string;
    }>;
  };

  if (!id || !name || !members?.length) {
    res.status(400).json({ error: "id, name, and members are required" });
    return;
  }

  try {
    // Upsert group
    const existing = await db.select().from(groupsTable).where(eq(groupsTable.id, id)).limit(1);
    if (existing.length > 0) {
      res.json({ tagNumber: tagFromSerial(existing[0].tagSerial) });
      return;
    }

    const [group] = await db
      .insert(groupsTable)
      .values({ id, ownerEmail: email, name, emoji, description })
      .returning();

    // Insert members
    for (const m of members) {
      await db.insert(groupMembersTable).values({
        id: `${id}_${m.id}`,
        groupId: id,
        memberLocalId: m.id,
        ownerEmail: email, // The creator's member gets their email
        name: m.name,
        color: m.color,
        upiId: m.upiId,
        avatar: m.avatar,
      });
    }

    req.log.info({ groupId: id, email }, "Group created");
    res.json({ tagNumber: tagFromSerial(group.tagSerial) });
  } catch (err) {
    req.log.error({ err }, "Failed to create group");
    res.status(500).json({ error: "Failed to create group" });
  }
});

// ── PUT /groups/:id ───────────────────────────────────────────────────────────

router.put("/groups/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params.id as string;
  const { name, emoji, description } = req.body as {
    name?: string;
    emoji?: string;
    description?: string;
  };

  try {
    // Verify membership
    const member = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.ownerEmail, email)))
      .limit(1);
    if (member.length === 0) {
      res.status(403).json({ error: "Not a member of this group" });
      return;
    }

    await db
      .update(groupsTable)
      .set({ ...(name && { name }), ...(emoji && { emoji }), ...(description !== undefined && { description }) })
      .where(eq(groupsTable.id, id));

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update group");
    res.status(500).json({ error: "Failed to update group" });
  }
});

// ── DELETE /groups/:id ────────────────────────────────────────────────────────

router.delete("/groups/:id", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const id = req.params.id as string;

  try {
    const group = await db.select().from(groupsTable).where(eq(groupsTable.id, id)).limit(1);
    if (group.length === 0) {
      res.status(404).json({ error: "Group not found" });
      return;
    }
    if (group[0].ownerEmail !== email) {
      // Non-owners: just remove their membership
      await db
        .delete(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.ownerEmail, email)));
      res.json({ success: true });
      return;
    }
    // Owner: delete entire group (cascades)
    await db.delete(groupsTable).where(eq(groupsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete group");
    res.status(500).json({ error: "Failed to delete group" });
  }
});

// ── POST /groups/:id/members ──────────────────────────────────────────────────

router.post("/groups/:id/members", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const { memberId, name, color, upiId } = req.body as {
    memberId: string;
    name: string;
    color: string;
    upiId?: string;
  };

  try {
    await db.insert(groupMembersTable).values({
      id: `${id}_${memberId}`,
      groupId: id,
      memberLocalId: memberId,
      ownerEmail: null,
      name,
      color,
      upiId,
    }).onConflictDoNothing();

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add member");
    res.status(500).json({ error: "Failed to add member" });
  }
});

// ── DELETE /groups/:id/members/:memberId ─────────────────────────────────────

router.delete("/groups/:id/members/:memberId", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const memberId = req.params.memberId as string;

  try {
    await db
      .delete(groupMembersTable)
      .where(
        and(eq(groupMembersTable.groupId, id), eq(groupMembersTable.memberLocalId, memberId))
      );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove member");
    res.status(500).json({ error: "Failed to remove member" });
  }
});

// ── POST /groups/join ─────────────────────────────────────────────────────────

router.post("/groups/join", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { tag, memberLocalId, name, color } = req.body as {
    tag: string;
    memberLocalId: string;
    name: string;
    color: string;
  };

  const raw = tag.replace(/^#/, "");
  const serial = parseInt(raw, 10) - 1000;

  try {
    // Find group by tagSerial
    const groups = await db
      .select()
      .from(groupsTable)
      .where(eq(groupsTable.tagSerial, serial))
      .limit(1);

    if (groups.length === 0) {
      res.status(404).json({ error: "Group not found. Check the tag number." });
      return;
    }

    const group = groups[0];

    // Check already a member
    const existing = await db
      .select()
      .from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.ownerEmail, email)))
      .limit(1);

    if (existing.length > 0) {
      // Already a member — return full group data
      const [payload] = await buildGroupPayloads([group.id]);
      res.json({
        group: {
          id: group.id,
          name: group.name,
          emoji: group.emoji,
          description: group.description ?? undefined,
          tagNumber: tagFromSerial(group.tagSerial),
          createdAt: group.createdAt.toISOString(),
          ...payload,
        },
      });
      return;
    }

    // Add user as new member
    await db.insert(groupMembersTable).values({
      id: `${group.id}_${memberLocalId}`,
      groupId: group.id,
      memberLocalId,
      ownerEmail: email,
      name,
      color,
    });

    // Log activity
    const actId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    await db.insert(activityEntriesTable).values({
      id: actId,
      groupId: group.id,
      type: "group_joined",
      label: `${name} joined "${group.emoji} ${group.name}"`,
      meta: "",
      date: new Date().toISOString(),
    });

    const [payload] = await buildGroupPayloads([group.id]);
    res.json({
      group: {
        id: group.id,
        name: group.name,
        emoji: group.emoji,
        description: group.description ?? undefined,
        tagNumber: tagFromSerial(group.tagSerial),
        createdAt: group.createdAt.toISOString(),
        ...payload,
      },
    });
  } catch (err) {
    req.log.error({ err }, "Failed to join group");
    res.status(500).json({ error: "Failed to join group" });
  }
});

// ── POST /groups/:id/expenses ─────────────────────────────────────────────────

router.post("/groups/:id/expenses", requireAuth, async (req, res) => {
  const groupId = req.params.id as string;
  const { id, title, amount, paidById, splitType, category, date, notes, splits } = req.body as {
    id: string;
    title: string;
    amount: number;
    paidById: string;
    splitType: string;
    category: string;
    date: string;
    notes?: string;
    splits: Array<{ memberId: string; amount: number; percentage?: number }>;
  };

  try {
    await db.insert(expensesTable).values({
      id,
      groupId,
      title,
      amount,
      paidByMemberId: paidById,
      splitType,
      category,
      date,
      notes,
    });

    for (const s of splits) {
      await db.insert(expenseSplitsTable).values({
        id: `${id}_${s.memberId}`,
        expenseId: id,
        memberId: s.memberId,
        amount: s.amount,
        percentage: s.percentage,
      });
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add expense");
    res.status(500).json({ error: "Failed to add expense" });
  }
});

// ── PUT /expenses/:id ─────────────────────────────────────────────────────────

router.put("/expenses/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  const { title, amount, paidById, splitType, category, date, notes, splits } = req.body as {
    title?: string;
    amount?: number;
    paidById?: string;
    splitType?: string;
    category?: string;
    date?: string;
    notes?: string;
    splits?: Array<{ memberId: string; amount: number; percentage?: number }>;
  };

  try {
    await db
      .update(expensesTable)
      .set({
        ...(title !== undefined && { title }),
        ...(amount !== undefined && { amount }),
        ...(paidById !== undefined && { paidByMemberId: paidById }),
        ...(splitType !== undefined && { splitType }),
        ...(category !== undefined && { category }),
        ...(date !== undefined && { date }),
        ...(notes !== undefined && { notes }),
      })
      .where(eq(expensesTable.id, id));

    if (splits) {
      await db.delete(expenseSplitsTable).where(eq(expenseSplitsTable.expenseId, id));
      for (const s of splits) {
        await db.insert(expenseSplitsTable).values({
          id: `${id}_${s.memberId}`,
          expenseId: id,
          memberId: s.memberId,
          amount: s.amount,
          percentage: s.percentage,
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update expense");
    res.status(500).json({ error: "Failed to update expense" });
  }
});

// ── DELETE /expenses/:id ──────────────────────────────────────────────────────

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  const id = req.params.id as string;
  try {
    await db.delete(expensesTable).where(eq(expensesTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete expense");
    res.status(500).json({ error: "Failed to delete expense" });
  }
});

// ── POST /groups/:id/settlements ──────────────────────────────────────────────

router.post("/groups/:id/settlements", requireAuth, async (req, res) => {
  const groupId = req.params.id as string;
  const { id, fromId, toId, amount, date, mode } = req.body as {
    id: string;
    fromId: string;
    toId: string;
    amount: number;
    date: string;
    mode: string;
  };

  try {
    await db.insert(settlementsTable).values({
      id,
      groupId,
      fromMemberId: fromId,
      toMemberId: toId,
      amount,
      date,
      mode,
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to add settlement");
    res.status(500).json({ error: "Failed to add settlement" });
  }
});

// ── POST /groups/:id/activities ───────────────────────────────────────────────

router.post("/groups/:id/activities", requireAuth, async (req, res) => {
  const groupId = req.params.id as string;
  const { id, type, label, meta, date } = req.body as {
    id: string;
    type: string;
    label: string;
    meta: string;
    date: string;
  };

  try {
    await db.insert(activityEntriesTable).values({ id, groupId, type, label, meta, date });
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to log activity");
    res.status(500).json({ error: "Failed to log activity" });
  }
});

// ── PUT /groups/:id/members/:memberId ─────────────────────────────────────────

router.put("/groups/:id/members/:memberId", requireAuth, async (req, res) => {
  const groupId = req.params.id as string;
  const memberId = req.params.memberId as string;
  const { name, upiId, avatar } = req.body as {
    name?: string;
    upiId?: string;
    avatar?: string;
  };

  try {
    await db
      .update(groupMembersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(upiId !== undefined && { upiId }),
        ...(avatar !== undefined && { avatar }),
      })
      .where(
        and(
          eq(groupMembersTable.groupId, groupId),
          eq(groupMembersTable.memberLocalId, memberId)
        )
      );
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update member");
    res.status(500).json({ error: "Failed to update member" });
  }
});

export default router;
