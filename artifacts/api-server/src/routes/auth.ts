import { Router } from "express";
import { Resend } from "resend";
import { OAuth2Client } from "google-auth-library";
import { db, userProfilesTable, usersTable, otpsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSession } from "../middlewares/requireAuth";

const router = Router();

router.get("/health", (req, res) => {
  return res.json({ status: "ok", message: "Qontri API is online" });
});

const RESEND_API_KEY = process.env["RESEND_API_KEY"]?.trim();
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const FROM_EMAIL =
  process.env["RESEND_FROM_EMAIL"] ?? "Qontri <onboarding@resend.dev>";

function isResendConfigured(): boolean {
  return Boolean(
    RESEND_API_KEY &&
      RESEND_API_KEY.length > 8 &&
      !RESEND_API_KEY.toLowerCase().includes("xxx") &&
      !RESEND_API_KEY.toLowerCase().includes("placeholder")
  );
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function normalizePhoneNumber(input: string): string {
  const cleaned = String(input ?? "").replace(/\s+/g, "").trim();

  if (!cleaned) {
    return "";
  }

  const digits = cleaned.replace(/[^\d+]/g, "");
  const withPlus = digits.startsWith("+")
    ? "+" + digits.replace(/\+/g, "")
    : digits;

  return withPlus;
}

// In-memory OTP fallback for when the database is unavailable (useful in local/test).
const otpInMemory: Map<string, { code: string; expiresAt: Date }> = new Map();

async function saveOtpFallback(
  email: string,
  code: string,
  expiresAt: Date
) {
  try {
    await db
      .insert(otpsTable)
      .values({ email, code, expiresAt })
      .onConflictDoUpdate({
        target: otpsTable.email,
        set: { code, expiresAt },
      });
  } catch (err) {
    console.warn(
      "[AUTH] DB insert failed, using in-memory OTP fallback for",
      email,
      err?.message ?? err
    );
    otpInMemory.set(email, { code, expiresAt });
  }
}

async function getOtpEntry(email: string) {
  try {
    const [entry] = await db
      .select()
      .from(otpsTable)
      .where(eq(otpsTable.email, email));

    if (entry) return entry;
  } catch (err) {
    // ignore DB errors, fallback to in-memory
  }

  const mem = otpInMemory.get(email);

  if (mem) {
    return {
      email,
      code: mem.code,
      expiresAt: mem.expiresAt,
    };
  }

  return null;
}

function phoneAliasEmail(phone: string): string {
  const normalized = normalizePhoneNumber(phone);

  if (!normalized) {
    throw new Error("Phone number is required");
  }

  return `phone_${normalized.replace(
    /[^a-zA-Z0-9]/g,
    "_"
  )}@qontri.local`;
}

/**
 * Ensure the user exists before issuing a session. The user insert is safe for
 * concurrent first logins; profile creation is intentionally non-blocking.
 */
async function ensureUserSetup(email: string): Promise<void> {
  try {
    const [existingUser] = await db
      .select({ email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!existingUser) {
      console.log("[AUTH] New user detected:", email);
    }

    try {
      await db
        .insert(usersTable)
        .values({ email })
        .onConflictDoNothing({ target: usersTable.email });
    } catch (err) {
      console.warn(
        "[AUTH] Could not insert user; continuing anyway:",
        err?.message ?? err
      );
    }

    try {
      await db
        .insert(userProfilesTable)
        .values({ email })
        .onConflictDoNothing({ target: userProfilesTable.email });
    } catch (err) {
      console.warn(
        "[AUTH] Database error creating profile; continuing:",
        err?.message ?? err
      );
      // A profile is created lazily and must not prevent OTP delivery.
    }
  } catch (err) {
    console.warn(
      "[AUTH] Database unavailable during ensureUserSetup; continuing in degraded mode:",
      err?.message ?? err
    );
  }
}

// 1. SEND OTP
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60000);

  try {
    await ensureUserSetup(normalizedEmail);

    await db
      .insert(otpsTable)
      .values({
        email: normalizedEmail,
        code,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: otpsTable.email,
        set: {
          code,
          expiresAt,
        },
      });

    if (!isResendConfigured()) {
      console.log(
        "[AUTH] Resend is not configured; using local email test OTP for:",
        normalizedEmail,
        "code:",
        code
      );

      return res.json({
        success: true,
        mode: "test",
        testCode: String(code),
      });
    }

    await resend?.emails.send({
      from: FROM_EMAIL,
      to: normalizedEmail,
      subject: "Your Qontri Verification Code",
      html: `Your code is <strong>${code}</strong>. It expires in 10 minutes.`,
    });

    return res.json({
      success: true,
      mode: "live",
    });
  } catch (err) {
    console.error("[AUTH] Database error during user setup:", err);

    return res.status(500).json({
      error: "Failed to send OTP",
    });
  }
});

// 2. VERIFY OTP (With Reviewer Bypass)
router.post("/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(400).json({
      error: "Email and code are required",
    });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // --- REVIEWER BYPASS ---
    if (
      normalizedEmail === "testuser@qontri.in" &&
      code === "999999"
    ) {
      const token = await createSession("testuser@qontri.in");

      return res.json({
        success: true,
        token,
      });
    }

    await ensureUserSetup(normalizedEmail);

    const [entry] = await db
      .select()
      .from(otpsTable)
      .where(eq(otpsTable.email, normalizedEmail));

    if (!entry || entry.code !== code) {
      return res.status(400).json({
        error: "Invalid code. Please request a new one.",
      });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({
        error: "Code has expired. Please request a new one.",
      });
    }

    await db
      .delete(otpsTable)
      .where(eq(otpsTable.email, normalizedEmail));

    const token = await createSession(normalizedEmail);

    return res.json({
      success: true,
      token,
    });
  } catch (err) {
    console.error("[AUTH] Database error during user setup:", err);

    return res.status(500).json({
      error: "Verification failed",
    });
  }
});

// 3. WHATSAPP OTP TEST LOGIN
router.post("/send-whatsapp-otp", async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    return res.status(400).json({
      error: "Phone number is required",
    });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60000);
  const aliasEmail = phoneAliasEmail(normalizedPhone);

  try {
    try {
      await ensureUserSetup(aliasEmail);
    } catch (err) {
      console.warn(
        "[AUTH] ensureUserSetup failed, continuing in degraded mode:",
        err?.message ?? err
      );
    }

    await saveOtpFallback(aliasEmail, code, expiresAt);

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM;

    if (twilioSid && twilioToken && twilioFrom) {
      // Real Twilio WhatsApp delivery path.
      // For Twilio WhatsApp, a message must use a pre-approved template via ContentSid,
      // so plain free-form text messages fail with "ContentSid Required" until approved.
      const twilioUrl =
        `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

      const basicAuth = Buffer.from(
        `${twilioSid}:${twilioToken}`
      ).toString("base64");

      const body = new URLSearchParams({
        From: twilioFrom,
        To: `whatsapp:${normalizedPhone}`,
        Body: `Your Qontri code is ${code}. It expires in 10 minutes.`,
      });

      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");

        console.warn(
          "[AUTH] Twilio WhatsApp send failed; falling back to local test mode:",
          text
        );

        return res.json({
          success: true,
          phone: normalizedPhone,
          testCode: String(code),
          mode: "test",
          warning:
            "Twilio WhatsApp requires an approved template. Local test mode is active.",
        });
      }
    } else {
      console.log(
        "[AUTH] Test WhatsApp OTP enabled. Phone:",
        normalizedPhone,
        "Code:",
        code
      );
    }

    return res.json({
      success: true,
      phone: normalizedPhone,
      testCode: String(code),
      mode: "test",
    });
  } catch (err) {
    console.error("[AUTH] WhatsApp OTP send failed:", err);

    return res.status(500).json({
      error: "Failed to send WhatsApp OTP",
    });
  }
});

router.post("/verify-whatsapp-otp", async (req, res) => {
  const { phone, code } = req.body;
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone || !code) {
    return res.status(400).json({
      error: "Phone number and code are required",
    });
  }

  const aliasEmail = phoneAliasEmail(normalizedPhone);

  try {
    const entry = await getOtpEntry(aliasEmail);

    if (!entry || entry.code !== String(code)) {
      return res.status(400).json({
        error: "Invalid code. Please request a new one.",
      });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({
        error: "Code has expired. Please request a new one.",
      });
    }

    try {
      await db
        .delete(otpsTable)
        .where(eq(otpsTable.email, aliasEmail));
    } catch (err) {
      // ignore DB delete errors and remove from in-memory fallback
    }

    otpInMemory.delete(aliasEmail);

    const token = await createSession(aliasEmail);

    return res.json({
      success: true,
      token,
      phone: normalizedPhone,
      email: aliasEmail,
    });
  } catch (err) {
    console.error("[AUTH] WhatsApp OTP verification failed:", err);

    return res.status(500).json({
      error: "Verification failed",
    });
  }
});

// 4. SMS OTP (Renflair) - generic HTTP provider
router.post("/send-sms-otp", async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone) {
    return res.status(400).json({
      error: "Phone number is required",
    });
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60000);
  const aliasEmail = phoneAliasEmail(normalizedPhone);

  try {
    try {
      await ensureUserSetup(aliasEmail);
    } catch (err) {
      console.warn(
        "[AUTH] ensureUserSetup failed, continuing in degraded mode:",
        err?.message ?? err
      );
    }

    // Save the OTP before sending it. This allows the verification endpoint
    // to validate the exact code that was sent to this phone number.
    await saveOtpFallback(aliasEmail, code, expiresAt);

    const smsApiKey = process.env.SMS_API_KEY?.trim();
    const smsProviderUrl = process.env.SMS_PROVIDER_URL?.trim();
    const smsTestMode =
      (process.env.SMS_TEST_MODE ?? "false").trim().toLowerCase() === "true";

    // Explicit local test mode: do not contact the provider.
    if (smsTestMode) {
      return res.json({
        success: true,
        phone: normalizedPhone,
        testCode: String(code),
        mode: "test",
      });
    }

    // Live mode must have both provider settings. Never report success when
    // there is no real SMS provider configured.
    if (!smsApiKey || !smsProviderUrl) {
      console.error("[AUTH] SMS provider is not configured for live mode.");
      return res.status(500).json({
        error: "SMS service is not configured",
      });
    }

    // Renflair expects Indian mobile numbers in domestic format
    // (10 digits, e.g. 8905475048). The international format (+91...) is
    // rejected with "PHONE NUMBER INCORRECT FORMAT".
    const phoneDigits = normalizedPhone.replace(/[^\d]/g, "");
    const phoneForProvider =
      phoneDigits.length === 12 && phoneDigits.startsWith("91")
        ? phoneDigits.slice(2)
        : phoneDigits;

    const url = smsProviderUrl
      .replace("$API", encodeURIComponent(smsApiKey))
      .replace("$PHONE", encodeURIComponent(phoneForProvider))
      .replace("$OTP", encodeURIComponent(code));

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json, text/plain, */*",
        },
      });

      const providerBody = await resp.text().catch(() => "");

      // Do not log the URL: it contains the private SMS API key.
      console.log("[AUTH] Renflair HTTP status:", resp.status);
      console.log("[AUTH] Renflair response:", providerBody);

      if (!resp.ok) {
        console.error(
          "[AUTH] Renflair returned a non-2xx response:",
          resp.status
        );
        return res.status(502).json({
          error: "SMS provider rejected the request",
        });
      }

      let providerResult: { status?: string; message?: string } | null = null;
      try {
        providerResult = JSON.parse(providerBody);
      } catch {
        // Some providers return plain text. A non-JSON 200 response is not
        // treated as successful because we cannot verify delivery acceptance.
      }

      if (providerResult?.status?.toUpperCase() !== "SUCCESS") {
        console.error(
          "[AUTH] Renflair did not confirm SMS delivery acceptance."
        );
        return res.status(502).json({
          error: "SMS provider did not confirm the message",
        });
      }
    } catch (err) {
      console.error(
        "[AUTH] Renflair request failed:",
        err?.message ?? err
      );

      return res.status(502).json({
        error: "SMS provider request failed",
      });
    }

    // Live mode: never expose the OTP to the mobile application.
    return res.json({
      success: true,
      phone: normalizedPhone,
      mode: "live",
    });
  } catch (err) {
    console.error("[AUTH] SMS OTP send failed:", err);

    return res.status(500).json({
      error: "Failed to send SMS OTP",
    });
  }
});

router.post("/verify-sms-otp", async (req, res) => {
  const { phone, code } = req.body;
  const normalizedPhone = normalizePhoneNumber(phone);

  if (!normalizedPhone || !code) {
    return res.status(400).json({
      error: "Phone number and code are required",
    });
  }

  const aliasEmail = phoneAliasEmail(normalizedPhone);

  try {
    const entry = await getOtpEntry(aliasEmail);

    if (!entry || entry.code !== String(code)) {
      return res.status(400).json({
        error: "Invalid code. Please request a new one.",
      });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({
        error: "Code has expired. Please request a new one.",
      });
    }

    try {
      await db
        .delete(otpsTable)
        .where(eq(otpsTable.email, aliasEmail));
    } catch (err) {
      // ignore DB delete errors
    }

    otpInMemory.delete(aliasEmail);

    const token = await createSession(aliasEmail);

    return res.json({
      success: true,
      token,
      phone: normalizedPhone,
      email: aliasEmail,
    });
  } catch (err) {
    console.error("[AUTH] SMS OTP verification failed:", err);

    return res.status(500).json({
      error: "Verification failed",
    });
  }
});

// 3. GOOGLE LOGIN
router.post("/google", async (req, res) => {
  const { idToken } = req.body;

  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({
      error: "Google ID token is required",
    });
  }

  const defaultGoogleClientIds = [
    "720730707427-neieucme9h4pn8c1ndqc4iksef4jiqel.apps.googleusercontent.com",
    "720730707427-7oe97r2vr566sg7tslt4opnelpi9ra9o.apps.googleusercontent.com",
    "720730707427-g543ehrt7konujpf1pl80jne50ru3jlv.apps.googleusercontent.com",
    "720730707427-q1ltq5e6qjlrbo4eecm68mmk3r1nk09e.apps.googleusercontent.com",
  ];

  const allowedClientIds = Array.from(
    new Set(
      (
        process.env.GOOGLE_CLIENT_IDS ??
        process.env.GOOGLE_CLIENT_ID ??
        defaultGoogleClientIds.join(",")
      )
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .concat(defaultGoogleClientIds)
    )
  );

  if (allowedClientIds.length === 0) {
    console.error("[AUTH] Google client IDs are not configured");

    return res.status(500).json({
      error: "Google login is not configured",
    });
  }

  try {
    const googleClient = new OAuth2Client();

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: allowedClientIds,
    });

    const payload = ticket.getPayload();
    const email = payload?.email?.toLowerCase().trim();

    if (payload?.aud && !allowedClientIds.includes(payload.aud)) {
      console.error("[AUTH] Google token audience mismatch", {
        aud: payload.aud,
        allowedClientIds,
      });
    }

    if (!email || payload?.email_verified !== true) {
      return res.status(401).json({
        error: "Google account email could not be verified",
      });
    }

    await ensureUserSetup(email);

    const token = await createSession(email);

    return res.json({
      success: true,
      token,
      email,
    });
  } catch (err) {
    console.error("[AUTH] Google verification failed:", err);

    return res.status(401).json({
      error: "Invalid Google sign-in",
    });
  }
});

// 3. UPDATE BUDGET
router.post("/update-budget", async (req, res) => {
  const { userId, amount } = req.body;

  try {
    await db
      .update(usersTable)
      .set({ monthlyBudget: amount.toString() })
      .where(eq(usersTable.id, userId));

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error("Budget Update Error:", error);

    res.status(500).json({
      error: "Failed to save budget",
    });
  }
});

export default router;

// force sync
// force sync 2

// Final Force Sync for Google Review