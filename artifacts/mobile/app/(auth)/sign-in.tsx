import React, { useRef, useState } from "react";
import * as Sentry from '@sentry/react-native';
import {
  ActivityIndicator,
  Alert,
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

// Helper: fetch with timeout using AbortController
async function fetchWithTimeout(input: RequestInfo, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// quick external probe to check if device has general connectivity
async function externalConnectivityProbe() {
  try {
    const probe = await fetchWithTimeout("https://www.google.com/generate_204", {}, 5000);
    return probe && probe.status === 204;
  } catch (e) {
    return false;
  }
}

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
      const url = `${API_BASE}/auth/send-otp`;
      Alert.alert('Debug URL', 'Sending request to: ' + url);

      // 0. quick local connectivity probe
      const hasExternal = await externalConnectivityProbe();
      if (!hasExternal) {
        const msg = 'No general internet connectivity detected (external probe failed).';
        Sentry.captureMessage(msg);
        Alert.alert('Network Debug', msg);
        setLocalError('Network error. Check connection.');
        return;
      }

      // 1. try health endpoint first to get quick server-level visibility
      try {
        const health = await fetchWithTimeout(`${API_BASE}/auth/health`, {}, 4000);
        if (!health.ok) {
          const text = await health.text().catch(() => 'no-body');
          Sentry.captureMessage(`Health check failed: ${health.status} ${text}`);
          Alert.alert('Network Debug', `Server health check returned ${health.status}`);
        }
      } catch (e: any) {
        // health check failed; continue to main request but record
        Sentry.captureException(e, { level: 'warning' });
      }

      // 2. primary request with timeout and one retry for transient failures
      let attempt = 0;
      let lastErr: any = null;
      let data: any = null;
      while (attempt < 2) {
        attempt += 1;
        try {
          const res = await fetchWithTimeout(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed }),
          }, 10000);

          try { data = await res.json(); } catch (e) { data = null; }

          if (!res.ok) {
            const errText = data?.error ?? `status ${res.status}`;
            setLocalError(errText ?? "Failed to send code.");
            Sentry.captureMessage(`Send-OTP failed (attempt ${attempt}): ${errText}`);
            return;
          }
          if (!data || !data.success) {
            setLocalError(data?.error ?? "Failed to send code.");
            return;
          }
          // success -> break retry loop
          break;
        } catch (error: any) {
          lastErr = error;
          Sentry.captureException(error);
          // wait briefly before retrying on transient network errors
          if (attempt < 2) await new Promise((r) => setTimeout(r, 700));
        }
      }
      if (lastErr) {
        const errMsg = lastErr?.message ?? String(lastErr);
        Alert.alert('Network Debug', `Failed to reach: ${url}\nError: ${errMsg}`);
        setLocalError('Network error. Check connection.');
        return;
      }
      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      Sentry.captureException(error);
      const url = `${API_BASE}/auth/send-otp`;
      Alert.alert('Network Debug', 'Failed to reach: ' + url + '\nError: ' + (error?.message ?? String(error)));
      setLocalError("Network error. Check connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setLocalError("");
    const entered = otp.join("");
    if (entered.length < 6) {
      setLocalError("Enter 6 digits");
      return;
    }

    setLoading(true);
    try {
      const url = `${API_BASE}/auth/verify-otp`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: entered }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Incorrect code.");
        return;
      }

      const tok = typeof data?.token === "string" ? data.token.trim() : "";
      if (!tok) {
        setLocalError("Verification failed. Please request a new code.");
        return;
      }

      let needsOnboarding = true;

      try {
        const profileRes = await fetch(`${API_BASE}/me`, {
          headers: {
            "Accept": "application/json",
            Authorization: `Bearer ${tok}`,
          },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          needsOnboarding = !profile.name || profile.name.trim().length === 0;
        }
      } catch (err) { console.error(err); }

      // 3. LOG THE USER IN
      const normalizedEmail = email.trim().toLowerCase();
      await signIn(normalizedEmail, tok, needsOnboarding);

    } catch (error: any) {
      Sentry.captureException(error);
      console.error("OTP verification network error:", error);
      setLocalError(error?.message ? `Network error: ${error.message}` : "Error verifying code.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    const newOtp = [...otp];
    if (value.length > 1) {
      const digits = value.replace(/\D/g, "").slice(0, 6).split("");
      digits.forEach((d, i) => { if (index + i < 6) newOtp[index + i] = d; });
      setOtp(newOtp);
      otpRefs.current[Math.min(index + digits.length, 5)]?.focus();
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

  return (
    <ImageBackground source={require("@/assets/images/splash.png")} style={styles.bg} resizeMode="cover">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.spacer} />
          <View style={styles.card}>
            {step === "email" ? (
              <>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.subtitle}>Enter your email to sign in</Text>
                <TextInput
                  style={styles.emailInput}
                  placeholder="you@example.com"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(t) => { setLocalError(""); setEmail(t); }}
                  editable={!loading}
                />
                {localError ? <Text style={styles.error}>{localError}</Text> : null}
                <Pressable style={styles.primaryBtn} onPress={handleSendCode} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send Code</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => { setStep("email"); setLocalError(""); }} style={styles.backBtn}>
                  <Text style={styles.backBtnText}>← Change email</Text>
                </Pressable>
                <Text style={styles.title}>Check your email</Text>
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
                      maxLength={1}
                      editable={!loading}
                    />
                  ))}
                </View>
                {localError ? <Text style={styles.error}>{localError}</Text> : null}
                <Pressable style={styles.primaryBtn} onPress={handleVerifyOtp} disabled={loading}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Verify & Sign In</Text>}
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
  bg: { flex: 1 }, flex: { flex: 1 }, scroll: { flexGrow: 1 }, spacer: { flex: 1 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 24, padding: 28, margin: 16, marginBottom: 40, elevation: 4 },
  title: { fontFamily: "Inter_700Bold", fontSize: 24, color: "#111827", marginBottom: 6 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "#6B7280", marginBottom: 20 },
  emailInput: { backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, fontSize: 16 },
  otpRow: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: 12 },
  otpBox: { width: 44, height: 54, backgroundColor: "#F9FAFB", borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, fontSize: 22, textAlign: "center" },
  otpBoxFilled: { borderColor: "#1E3A5F", backgroundColor: "#EFF6FF" },
  error: { fontSize: 12, color: "#EF4444", marginBottom: 12, marginTop: 4 },
  primaryBtn: { backgroundColor: "#1E3A5F", borderRadius: 14, padding: 16, alignItems: "center", marginTop: 8 },
  primaryBtnText: { fontSize: 16, color: "#FFFFFF", fontWeight: "600" },
  backBtn: { marginBottom: 16 },
  backBtnText: { fontSize: 14, color: "#1E3A5F" },
});