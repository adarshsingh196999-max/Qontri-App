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
        setLocalError(data.error ?? "Failed to send code.");
        return;
      }
      setOtp(["", "", "", "", "", ""]);
      setStep("otp");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch {
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
      const res = await fetch(`${API_BASE}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: entered }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setLocalError(data.error ?? "Incorrect code.");
        return;
      }

      const tok = data.token ?? "";
      let needsOnboarding = true;

      try {
        const profileRes = await fetch(`${API_BASE}/me`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (profileRes.ok) {
          const profile = await profileRes.json();
          needsOnboarding = !profile.name || profile.name.trim().length === 0;
        }
      } catch (err) { console.error(err); }

      // 3. LOG THE USER IN
      // This updates the global state. The "Police" layout will see this and move you.
      const normalizedEmail = email.trim().toLowerCase();
      await signIn(normalizedEmail, tok, needsOnboarding);

    } catch (error) {
      setLocalError("Error verifying code.");
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