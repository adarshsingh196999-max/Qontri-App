import { Router } from "express";
import { Resend } from "resend";
import { db, userProfilesTable, usersTable, otpsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession } from "../middlewares/requireAuth";

const router = Router();
router.get("/health", (req, res) => {
  return res.json({ status: "ok", message: "Qontri API is online" });
});
const resend = new Resend(process.env["RESEND_API_KEY"]);

const FROM_EMAIL = process.env["RESEND_FROM_EMAIL"] ?? "Qontri <onboarding@resend.dev>";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Ensure the user exists before issuing a session. The user insert is safe for
 * concurrent first logins; profile creation is intentionally non-blocking.
 */
async function ensureUserSetup(email: string): Promise<void> {
  const [existingUser] = await db
    .select({ email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.email, email))
    .limit(1);

  if (!existingUser) {
    console.log("[AUTH] New user detected:", email);
  }

  await db
    .insert(usersTable)
    .values({ email })
    .onConflictDoNothing({ target: usersTable.email });

  try {
    await db
      .insert(userProfilesTable)
      .values({ email })
      .onConflictDoNothing({ target: userProfilesTable.email });
  } catch (err) {
    console.error("[AUTH] Database error during user setup:", err);
    // A profile is created lazily and must not prevent OTP delivery.
  }
}

// 1. SEND OTP
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60000); 

  try {
    await ensureUserSetup(normalizedEmail);

    await db.insert(otpsTable)
      .values({ email: normalizedEmail, code, expiresAt })
      .onConflictDoUpdate({
        target: otpsTable.email,
        set: { code, expiresAt }
      });

    await resend.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: "Your Qontri Verification Code",
      html: `Your code is <strong>${code}</strong>. It expires in 10 minutes.`,
    });

    return res.json({ success: true });
  } catch (err) {
    console.error("[AUTH] Database error during user setup:", err);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 2. VERIFY OTP (With Reviewer Bypass)
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // --- REVIEWER BYPASS ---
    if (normalizedEmail === "testuser@qontri.in" && code === "999999") {
      const token = await createSession("testuser@qontri.in");
      return res.json({ success: true, token });
    }

    await ensureUserSetup(normalizedEmail);

    const [entry] = await db.select()
      .from(otpsTable)
      .where(eq(otpsTable.email, normalizedEmail));

    if (!entry || entry.code !== code) {
      return res.status(400).json({ error: "Invalid code. Please request a new one." });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    await db.delete(otpsTable).where(eq(otpsTable.email, normalizedEmail));

    const token = await createSession(normalizedEmail);
    return res.json({ success: true, token });

  } catch (err) {
    console.error("[AUTH] Database error during user setup:", err);
    return res.status(500).json({ error: "Verification failed" });
  }
});

// 3. UPDATE BUDGET
router.post("/update-budget", async (req, res) => {
  const { userId, amount } = req.body;
  try {
    await db.update(usersTable)
      .set({ monthlyBudget: amount.toString() })
      .where(eq(usersTable.id, userId));

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Budget Update Error:", error);
    res.status(500).json({ error: "Failed to save budget" });
  }
});

export default router;
// force sync
// force sync 2
// Final Force Sync for Google Review