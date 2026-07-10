import { eq } from "drizzle-orm";
import { Router } from "express";
import { db, tripsTable, usersTable } from "@workspace/db";

const router = Router();

function tagFromId(id: number): string {
  return `#${1000 + id}`;
}

router.post("/trips/register", async (req, res) => {
  const { localId, ownerEmail, name, emoji, memberCount } = req.body as {
    localId?: string;
    ownerEmail?: string;
    name?: string;
    emoji?: string;
    memberCount?: number;
  };

  if (!localId || !ownerEmail || !name) {
    res.status(400).json({ error: "localId, ownerEmail and name are required" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.localId, localId))
      .limit(1);

    if (existing.length > 0) {
      res.json({ tagNumber: tagFromId(existing[0].id) });
      return;
    }

    const [trip] = await db
      .insert(tripsTable)
      .values({
        localId,
        ownerEmail: ownerEmail.trim().toLowerCase(),
        name,
        emoji: emoji ?? "🧳",
        memberCount: String(memberCount ?? 1),
      })
      .returning();

    req.log.info({ tripId: trip.id, tagNumber: tagFromId(trip.id), ownerEmail }, "Trip registered");
    res.json({ tagNumber: tagFromId(trip.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to register trip");
    res.status(500).json({ error: "Failed to register trip" });
  }
});

router.get("/trips/lookup/:tag", async (req, res) => {
  const raw = req.params.tag.replace(/^#/, "");
  const numeric = parseInt(raw, 10);
  const rowId = isNaN(numeric) ? NaN : numeric - 1000;

  if (isNaN(rowId) || rowId < 1) {
    res.status(400).json({ error: "Invalid tag number" });
    return;
  }

  try {
    const rows = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.id, rowId))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: "Trip not found" });
      return;
    }

    const trip = rows[0];
    res.json({
      tagNumber: tagFromId(trip.id),
      name: trip.name,
      emoji: trip.emoji,
      ownerEmail: trip.ownerEmail,
      memberCount: trip.memberCount,
      createdAt: trip.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to lookup trip");
    res.status(500).json({ error: "Failed to lookup trip" });
  }
});

router.get("/trips/by-email/:email", async (req, res) => {
  const email = decodeURIComponent(req.params.email).trim().toLowerCase();
  try {
    const rows = await db
      .select()
      .from(tripsTable)
      .where(eq(tripsTable.ownerEmail, email));

    res.json(
      rows.map((t) => ({
        tagNumber: tagFromId(t.id),
        name: t.name,
        emoji: t.emoji,
        memberCount: t.memberCount,
        createdAt: t.createdAt,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch trips by email");
    res.status(500).json({ error: "Failed to fetch trips" });
  }
});

export { usersTable };
export default router;
