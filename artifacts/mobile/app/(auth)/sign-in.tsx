import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMockAuth } from "@/context/MockAuthContext";
import { API_BASE } from "@/constants/api";
const PRIMARY = "#1E3A5F";
const ERROR = "#EF4444";
type Step = "email" | "otp";

export default function SignInPage() {
  const { signIn } = useMockAuth();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [localError, setLocalError] = useState("");
  const [loading, setLoading] = useState(false);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const handleSendCode = async () => {
    setLocalError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) {
      setLocalError("Enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Failed to send code. Please try again.");
        return;
      }
      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
      setLocalError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError("");
    const entered = otp.join("");
    if (entered.length < 6) {
      setLocalError("Enter the 6-digit code from your email");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: entered }),
      });
      const data = await res.json() as { success?: boolean; error?: string; token?: string };
      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Incorrect code. Please try again.");
        return;
      }
      const tok = data.token ?? "";
      let needsOnboarding = true;
      try {
        const profileRes = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json() as { onboardingDone?: boolean; name?: string };
          needsOnboarding = profile.onboardingDone === false || !profile.name?.trim();
        }
      } catch {}
      await signIn(email.trim().toLowerCase(), tok, needsOnboarding);
    } catch {
      setLocalError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
    } else {
      newOtp[index] = value.replace(/\D/g, "");
      setOtp(newOtp);
      if (value && index < 5) otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResend = async () => {
    setOtp(["", "", "", "", "", ""]);
    setLocalError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Failed to resend code.");
      }
    } catch {
      setLocalError("Network error. Try again.");
    } finally {
      setLoading(false);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
  };

  return (
    <ImageBackground
      source={require("@/assets/images/splash.png")}
      style={styles.bg}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.spacer} />

          <View style={styles.card}>
            {step === "email" ? (
              <>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.subtitle}>
                  Enter your email to get a sign-in code
                </Text>

                <Text style={styles.inputLabel}>Email address</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={email}
                  onChangeText={(t) => { setLocalError(""); setEmail(t); }}
                  returnKeyType="done"
                  onSubmitEditing={handleSendCode}
                  editable={!loading}
                />

                {localError ? <Text style={styles.error}>{localError}</Text> : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (email.length < 4 || loading) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleSendCode}
                  disabled={email.length < 4 || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Send Code</Text>
                  )}
                </Pressable>

                <Text style={styles.terms}>
                  By continuing, you agree to our Terms & Privacy Policy
                </Text>
              </>
            ) : (
              <>
                <Pressable
                  style={styles.backBtn}
                  onPress={() => { setStep("email"); setOtp(["", "", "", "", "", ""]); setLocalError(""); }}
                >
                  <Text style={styles.backBtnText}>← Change email</Text>
                </Pressable>

                <Text style={styles.title}>Check your email</Text>
                <Text style={styles.subtitle}>
                  We sent a 6-digit code to{"\n"}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>

                <View style={styles.otpRow}>
                  {otp.map((digit, i) => (
                    <TextInput
                      key={i}
                      ref={(ref) => { otpRefs.current[i] = ref; }}
                      style={[styles.otpBox, digit ? styles.otpBoxFilled : null]}
                      value={digit}
                      onChangeText={(v) => handleOtpChange(v, i)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                      keyboardType="number-pad"
                      maxLength={6}
                      selectTextOnFocus
                      autoFocus={i === 0}
                      editable={!loading}
                    />
                  ))}
                </View>

                {localError ? <Text style={styles.error}>{localError}</Text> : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryBtn,
                    (loading || otp.join("").length < 6) && styles.btnDisabled,
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.join("").length < 6}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verify & Sign In</Text>
                  )}
                </Pressable>

                <Pressable style={styles.resendBtn} onPress={handleResend} disabled={loading}>
                  <Text style={styles.resendBtnText}>Resend code</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  spacer: { flex: 1 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 28,
    margin: 16,
    marginBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 24,
    color: "#111827",
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 20,
  },
  emailHighlight: {
    fontFamily: "Inter_600SemiBold",
    color: PRIMARY,
  },
  inputLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    color: "#374151",
    marginBottom: 8,
  },
  emailInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  otpBox: {
    width: 44,
    height: 54,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    fontFamily: "Inter_600SemiBold",
    fontSize: 22,
    color: "#111827",
    textAlign: "center",
    padding: 0,
  },
  otpBoxFilled: {
    borderColor: PRIMARY,
    backgroundColor: "#EFF6FF",
  },
  error: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: ERROR,
    marginBottom: 12,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    backgroundColor: "#9CA3AF",
    shadowOpacity: 0,
    elevation: 0,
  },
  btnPressed: { opacity: 0.9 },
  primaryBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 16,
    color: "#FFFFFF",
  },
  terms: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 18,
  },
  backBtn: { marginBottom: 16 },
  backBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: PRIMARY,
  },
  resendBtn: {
    alignItems: "center",
    marginTop: 16,
    padding: 8,
  },
  resendBtnText: {
    fontFamily: "Inter_500Medium",
    fontSize: 14,
    color: PRIMARY,
  },
});
