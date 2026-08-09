// 1. SEND OTP (Corrected & Clean)
router.post("/auth/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });
  
  const normalizedEmail = email.toLowerCase().trim();
  const code = generateOtp(); 
  const expiresAt = new Date(Date.now() + 10 * 60000); 

  try {
    // Save to Neon
    await db.insert(otpsTable)
      .values({ email: normalizedEmail, code, expiresAt })
      .onConflictDoUpdate({
        target: otpsTable.email,
        set: { code, expiresAt }
      });

    // Send via Resend
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

// 2. VERIFY OTP (Corrected & Clean)
router.post("/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: "Email and code required" });

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const [entry] = await db.select()
      .from(otpsTable)
      .where(eq(otpsTable.email, normalizedEmail));

    if (!entry || entry.code !== code) {
      return res.status(400).json({ error: "Invalid code. Please request a new one." });
    }

    if (new Date() > entry.expiresAt) {
      return res.status(400).json({ error: "Code expired. Please request a new one." });
    }

    // Success! Delete the OTP
    await db.delete(otpsTable).where(eq(otpsTable.email, normalizedEmail));

    const token = await createSession(normalizedEmail);
    res.json({ success: true, token });

  } catch (err) {
    console.error("OTP Verify Error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});