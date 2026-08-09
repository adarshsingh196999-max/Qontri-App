import { Router } from "express";
import { Resend } from "resend";
import { db, usersTable, userProfilesTable, otpsTable } from "@workspace/db"; // Add otpsTable hereimport { eq } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { createSession } from "../middlewares/requireAuth";

const router = Router();

const resend = new Resend(process.env["RESEND_API_KEY"]);

const FROM_EMAIL =
  process.env["RESEND_FROM_EMAIL"] ?? "Qontri <onboarding@resend.dev>";

const IS_DEV = process.env["NODE_ENV"] !== "production";

interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

const otpStore = new Map<string, OtpEntry>();

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (entry.expiresAt < now) otpStore.delete(key);
  }
}

// 1. SEND OTP (Saves to Neon Database)
router.post("/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  
  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp(); // your existing generate function
  const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes from now

  try {
    // Save or update the OTP in Neon
    await db.insert(otpsTable)
      .values({ email: normalizedEmail, code, expiresAt })
      .onConflictDoUpdate({
        target: otpsTable.email,
        set: { code, expiresAt }
      });

    console.log(`OTP for ${normalizedEmail}: ${code}`); // Log for testing
    await sendEmail(normalizedEmail, code); // your existing send function
    
    res.json({ success: true });
  } catch (err) {
    console.error("OTP Send Error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 2. VERIFY OTP (Checks Neon Database)
router.post("/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code are required" });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const [entry] = await db.select()
      .from(otpsTable)
      .where(eq(otpsTable.email, normalizedEmail));

    if (!entry || entry.code !== code) {
      return res.status(400).json({ error: "Invalid code found. Please request a new one." });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Success! Delete the OTP so it's a one-time use
    await db.delete(otpsTable).where(eq(otpsTable.email, normalizedEmail));

    // ... Keep your existing user creation/token logic here ...
    // Example:
    const token = await createSession(normalizedEmail);
    res.json({ success: true, token });

  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: normalized,
      subject: "Your Qontri sign-in code",
      html: `
        <div style="font-family: 'Inter', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8faff;">
          <div style="background: #ffffff; border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(30,58,95,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: 800; color: #1E3A5F; letter-spacing: 2px; margin: 0;">QONTRI</h1>
              <p style="color: #6B7280; margin: 8px 0 0; font-size: 14px;">Smart contributions. Simple settlements.</p>
            </div>
            <h2 style="font-size: 18px; color: #111827; margin: 0 0 8px;">Your sign-in code</h2>
            <p style="color: #6B7280; font-size: 14px; margin: 0 0 24px;">Enter this code in the app to continue. It expires in 10 minutes.</p>
            <div style="background: #EFF6FF; border: 1.5px solid #BFDBFE; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 40px; font-weight: 800; letter-spacing: 12px; color: #1E3A5F;">${code}</span>
            </div>
            <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin: 0;">If you didn't request this code, you can safely ignore this email.</p>
          </div>
        </div>
      `,
    });

    req.log.info({ email: normalized }, "OTP sent");
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send OTP email");
    res.status(500).json({ error: "Failed to send code. Please try again." });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    res.status(400).json({ error: "Email and code are required" });
    return;
  }

  const normalized = email.trim().toLowerCase();
  const entry = otpStore.get(normalized);

  if (!entry) {
    res.status(400).json({ error: "No code found for this email. Please request a new code." });
    return;
  }

  if (Date.now() > entry.expiresAt) {
    otpStore.delete(normalized);
    res.status(400).json({ error: "Code expired. Please request a new one." });
    return;
  }

  entry.attempts += 1;
  if (entry.attempts > 5) {
    otpStore.delete(normalized);
    res.status(400).json({ error: "Too many attempts. Please request a new code." });
    return;
  }

  if (entry.code !== code.trim()) {
    res.status(400).json({ error: "Incorrect code. Please try again." });
    return;
  }

  otpStore.delete(normalized);
  req.log.info({ email: normalized }, "OTP verified");

  let isNewUser = false;
  try {
    const rows = await db.select().from(usersTable).where(eq(usersTable.email, normalized)).limit(1);
    if (rows.length === 0) {
      await db.insert(usersTable).values({ email: normalized, lastLoginAt: new Date() });
      req.log.info({ email: normalized }, "New user created");
      isNewUser = true;
    } else {
      await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.email, normalized));
      const profile = await db
        .select()
        .from(userProfilesTable)
        .where(eq(userProfilesTable.email, normalized))
        .limit(1);
      isNewUser = profile.length === 0 || profile[0].name.trim().length === 0;
    }
  } catch (err) {
    req.log.error({ err }, "Failed to upsert user");
  }

  const token = await createSession(normalized);
  res.json({ success: true, token, isNewUser });
});
// NEW: Route to update the user's monthly budget
router.post("/update-budget", async (req, res) => {
  const { userId, amount } = req.body;

  try {
    // This uses Drizzle to update the column we added to Neon
    await db
      .update(usersTable)
      .set({ monthlyBudget: amount.toString() }) // Save as string for decimal safety
      .where(eq(usersTable.id, userId));

    res.status(200).json({ success: true, message: "Budget saved to cloud" });
  } catch (error) {
    console.error("Budget Update Error:", error);
    res.status(500).json({ error: "Failed to update budget" });
  }
});
export default router;
