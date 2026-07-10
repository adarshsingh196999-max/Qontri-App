import { Router } from "express";
import { Resend } from "resend";
import { db, usersTable, userProfilesTable } from "@workspace/db";
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

router.post("/auth/send-otp", async (req, res) => {
  console.log("========== SEND OTP ROUTE HIT ==========");

  const { email } = req.body as { email?: string };

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "Valid email required" });
    return;
  }

  const normalized = email.trim().toLowerCase();
  cleanupExpired();

  const code = generateOtp();
  otpStore.set(normalized, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    attempts: 0,
  });

  if (IS_DEV) {
    req.log.info({ email: normalized, code }, "DEV: OTP code (check logs to verify)");
  }

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

export default router;
