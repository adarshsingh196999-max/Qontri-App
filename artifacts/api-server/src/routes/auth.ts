import { Router } from "express";
import { Resend } from "resend";
import { db, usersTable, otpsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession } from "../middlewares/requireAuth";

const router = Router();
const resend = new Resend(process.env["RESEND_API_KEY"]);

const FROM_EMAIL = process.env["RESEND_FROM_EMAIL"] ?? "Qontri <onboarding@resend.dev>";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 1. SEND OTP (Database Backed)
router.post("/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60000); // 10 mins

  try {
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

    res.json({ success: true });
  } catch (err) {
    console.error("OTP Send Error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

// 2. VERIFY OTP (Database Backed)
router.post("/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

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

    await db.delete(otpsTable).where(eq(otpsTable.email, normalizedEmail));

    const token = await createSession(normalizedEmail);
    res.json({ success: true, token });

  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

// 3. UPDATE BUDGET (Database Backed)
router.post("/update-budget", async (req, res) => {
  const { userId, amount } = req.body;

  try {
    await db.update(usersTable)
      .set({ monthlyBudget: amount.toString() })
      .where(eq(usersTable.id, userId));

    res.status(200).json({ success: true, message: "Budget saved to cloud" });
  } catch (error) {
    console.error("Budget Update Error:", error);
    res.status(500).json({ error: "Failed to update budget" });
  }
});

export default router;