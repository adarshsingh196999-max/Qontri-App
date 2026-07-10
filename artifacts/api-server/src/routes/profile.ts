import { eq } from "drizzle-orm";
import { Router } from "express";
import { db, groupMembersTable, userProfilesTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const email = req.user!.email;
  try {
    const rows = await db
      .select()
      .from(userProfilesTable)
      .where(eq(userProfilesTable.email, email))
      .limit(1);

    if (rows.length === 0) {
      res.json({ email, name: "", upiId: "", avatar: "", travelStyle: "", onboardingDone: false });
      return;
    }
    const p = rows[0];
    res.json({
      email: p.email,
      name: p.name,
      upiId: p.upiId,
      avatar: p.avatar,
      travelStyle: p.travelStyle,
      onboardingDone: p.name.trim().length > 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch profile");
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

router.put("/me", requireAuth, async (req, res) => {
  const email = req.user!.email;
  const { name, upiId, avatar, travelStyle } = req.body as {
    name?: string;
    upiId?: string;
    avatar?: string;
    travelStyle?: string;
  };

  try {
    await db
      .insert(userProfilesTable)
      .values({
        email,
        name: name ?? "",
        upiId: upiId ?? "",
        avatar: avatar ?? "",
        travelStyle: travelStyle ?? "",
      })
      .onConflictDoUpdate({
        target: userProfilesTable.email,
        set: {
          ...(name !== undefined && { name }),
          ...(upiId !== undefined && { upiId }),
          ...(avatar !== undefined && { avatar }),
          ...(travelStyle !== undefined && { travelStyle }),
          updatedAt: new Date(),
        },
      });

    if (name !== undefined && name.trim()) {
      await db
        .update(groupMembersTable)
        .set({ name: name.trim() })
        .where(eq(groupMembersTable.ownerEmail, email));
    }

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
